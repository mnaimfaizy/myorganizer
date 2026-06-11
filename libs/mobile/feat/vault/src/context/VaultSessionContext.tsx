import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { VaultApi } from '@myorganizer/app-api-client';
import { mobileVaultCrypto, base64ToBytes } from '../crypto';
import { PBKDF2_ITERATIONS } from '../constants';

export type VaultStatus = 'locked' | 'unlocked';

interface VaultSessionValue {
  status: VaultStatus;
  /** The decrypted Master Key bytes, held in memory only while unlocked. */
  masterKey: Uint8Array | null;
  /** Vault API client (shares the auth Axios instance) for downstream fetches. */
  vaultApi: VaultApi;
  /**
   * Derives the Master Key from the passphrase and the server's vault meta,
   * then unwraps it in memory. Throws on a wrong passphrase (AES-GCM auth-tag
   * failure) or on a fetch failure — the caller maps the error to UI copy.
   */
  unlock: (passphrase: string) => Promise<void>;
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

  const unlock = useCallback(
    async (passphrase: string): Promise<void> => {
      const response = await vaultApi.getVaultMeta();
      const meta = response.data.meta;

      const salt = base64ToBytes(meta.kdf_salt);
      const params = meta.kdf_params as Record<string, unknown>;
      const iterations = Number(params?.['iterations']) || PBKDF2_ITERATIONS;

      const wrappingKey = await mobileVaultCrypto.deriveKeyFromPassphrase({
        passphrase,
        salt,
        iterations,
      });

      const wrapped = meta.wrapped_mk_passphrase as {
        iv: string;
        ciphertext: string;
      };

      // A wrong passphrase yields a wrong wrapping key, so the GCM auth tag
      // fails to verify and this rejects — no plaintext key is ever produced.
      const masterKeyBytes = await mobileVaultCrypto.aesGcmDecrypt({
        key: wrappingKey,
        ciphertext: base64ToBytes(wrapped.ciphertext),
        iv: base64ToBytes(wrapped.iv),
      });

      setMasterKey(masterKeyBytes);
      setStatus('unlocked');
    },
    [vaultApi],
  );

  const lock = useCallback((): void => {
    setMasterKey(null);
    setStatus('locked');
  }, []);

  const value = useMemo<VaultSessionValue>(
    () => ({ status, masterKey, vaultApi, unlock, lock }),
    [status, masterKey, vaultApi, unlock, lock],
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
