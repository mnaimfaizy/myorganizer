import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { VaultApi, VaultMetaV1 } from '@myorganizer/app-api-client';
import { mobileVaultCrypto } from '../crypto';
import {
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryKey,
  type VaultUnlockSecret,
} from '../unlock';

export type VaultStatus = 'locked' | 'unlocked';
export type { VaultUnlockSecret };

interface VaultSessionValue {
  status: VaultStatus;
  /** The decrypted Master Key bytes, held in memory only while unlocked. */
  masterKey: Uint8Array | null;
  /**
   * Which secret produced the current Vault Unlock (CONTEXT.md, "Vault
   * Unlock Secret"). `null` while locked; a later lock clears it.
   */
  unlockSecret: VaultUnlockSecret | null;
  /** Vault API client (shares the auth Axios instance) for downstream fetches. */
  vaultApi: VaultApi;
  /**
   * Derives the Master Key from the passphrase and the server's vault meta,
   * then unwraps it in memory. Throws on a wrong passphrase (AES-GCM auth-tag
   * failure) or on a fetch failure — the caller maps the error to UI copy.
   */
  unlock: (passphrase: string) => Promise<void>;
  /**
   * Unwraps the Master Key with a Recovery Key instead of a passphrase.
   * Throws on a wrong key (AES-GCM auth-tag failure) or on a fetch failure —
   * same contract as `unlock`, and the same 404 means the same "no vault yet".
   */
  unlockWithRecoveryKey: (recoveryKey: string) => Promise<void>;
  /** Drops the in-memory Master Key and returns to the locked state. */
  lock: () => void;
}

const VaultSessionContext = createContext<VaultSessionValue | null>(null);

interface VaultProviderProps {
  vaultApi: VaultApi;
  children: ReactNode;
}

export function VaultProvider({
  vaultApi,
  children,
}: VaultProviderProps): React.JSX.Element {
  const [status, setStatus] = useState<VaultStatus>('locked');
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  const [unlockSecret, setUnlockSecret] = useState<VaultUnlockSecret | null>(
    null,
  );

  const applyUnlockOutcome = useCallback(
    (outcome: { masterKey: Uint8Array; secret: VaultUnlockSecret }): void => {
      setMasterKey(outcome.masterKey);
      setUnlockSecret(outcome.secret);
      setStatus('unlocked');
    },
    [],
  );

  const unlock = useCallback(
    async (passphrase: string): Promise<void> => {
      const response = await vaultApi.getVaultMeta();
      const meta = response.data.meta as VaultMetaV1;
      const outcome = await unlockVaultWithPassphrase(
        meta,
        passphrase,
        mobileVaultCrypto,
      );
      applyUnlockOutcome(outcome);
    },
    [vaultApi, applyUnlockOutcome],
  );

  const unlockWithRecoveryKey = useCallback(
    async (recoveryKey: string): Promise<void> => {
      const response = await vaultApi.getVaultMeta();
      const meta = response.data.meta as VaultMetaV1;
      const outcome = await unlockVaultWithRecoveryKey(
        meta,
        recoveryKey,
        mobileVaultCrypto,
      );
      applyUnlockOutcome(outcome);
    },
    [vaultApi, applyUnlockOutcome],
  );

  const lock = useCallback((): void => {
    setMasterKey(null);
    setUnlockSecret(null);
    setStatus('locked');
  }, []);

  const value = useMemo<VaultSessionValue>(
    () => ({
      status,
      masterKey,
      unlockSecret,
      vaultApi,
      unlock,
      unlockWithRecoveryKey,
      lock,
    }),
    [
      status,
      masterKey,
      unlockSecret,
      vaultApi,
      unlock,
      unlockWithRecoveryKey,
      lock,
    ],
  );

  return (
    <VaultSessionContext.Provider value={value}>
      {children}
    </VaultSessionContext.Provider>
  );
}

export function useVaultSession(): VaultSessionValue {
  const context = useContext(VaultSessionContext);
  if (!context) {
    throw new Error('useVaultSession must be used within a VaultProvider');
  }
  return context;
}
