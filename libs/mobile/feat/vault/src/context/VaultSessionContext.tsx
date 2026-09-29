import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { VaultApi, VaultMetaV1 } from '@myorganizer/app-api-client';
import { mobileVaultCrypto } from '../crypto';
import { nativeBiometricKeystore } from '../biometric/nativeKeystore';
import type { BiometricKeystore, BiometricMethod } from '../biometric/keystore';
import {
  disableBiometricUnlock,
  enableBiometricUnlock,
  readBiometricUnlockState,
  unlockWithBiometrics,
  type BiometricEnrolment,
  type BiometricUnlockAttempt,
  type BiometricUnlockState,
} from '../biometric/biometricPolicy';
import { storedKeyOpensVault } from '../biometric/keyCheck';
import {
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryKey,
  type VaultUnlockSecret,
} from '../unlock';

export type VaultStatus = 'locked' | 'unlocked';
export type { VaultUnlockSecret };

/**
 * Why the Vault is locked. `auto-lock` is the app having locked itself after
 * its Auto-Lock Delay in the background; `manual` is the User having asked.
 * The Unlock screen states the first and says nothing about the second, because
 * a User who just pressed Lock knows why they are here.
 */
export type LockReason = 'manual' | 'auto-lock';

/** Biometric Unlock for the signed-in User, as a screen uses it. */
export interface BiometricUnlockController {
  /** Where it stands, or `null` until the keystore has been asked. */
  state: BiometricUnlockState | null;
  /**
   * Which biometric the prompt asks for, so copy can say "Face ID" or
   * "fingerprint". `null` until the keystore has been asked.
   */
  method: BiometricMethod | null;
  /**
   * Raise the platform prompt and unlock from the stored Master Key. On
   * `unlocked` the session is already unlocked by the time this resolves; every
   * other outcome leaves it locked and is the caller's to explain.
   */
  unlock: () => Promise<BiometricUnlockAttempt>;
  /**
   * Turn it on straight after a passphrase unlock — the offer. Refused unless
   * that unlock is recent (`ENROLMENT_FRESHNESS_MS`).
   */
  enable: () => Promise<BiometricEnrolment>;
  /**
   * Turn it on from Account: the passphrase is asked for again and checked
   * against the Vault, then the biometric check runs — an unlocked session
   * alone is never enough to add a way into the Vault (ADR 0108 decision 1).
   * Throws, like `unlock`, on a wrong passphrase or a fetch failure.
   */
  enableWithPassphrase: (passphrase: string) => Promise<BiometricEnrolment>;
  /** Turn it off and delete the stored key. */
  disable: () => Promise<void>;
}

interface VaultSessionValue {
  status: VaultStatus;
  /** The decrypted Master Key bytes, held in memory only while unlocked. */
  masterKey: Uint8Array | null;
  /**
   * Which secret produced the current Vault Unlock (CONTEXT.md, "Vault
   * Unlock Secret"). `null` while locked; a later lock clears it.
   */
  unlockSecret: VaultUnlockSecret | null;
  /** Why the Vault is locked, or `null` once it is open. */
  lockReason: LockReason | null;
  /**
   * When the current Vault Unlock completed, as `Date.now()`, or `null` while
   * locked. Read by whatever has to know how recently the User proved
   * something — turning Biometric Unlock on is the only such thing today.
   */
  unlockedAt: number | null;
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
  /**
   * Drops the in-memory Master Key and returns to the locked state.
   *
   * The reason is required and has no default. It is passed straight into
   * state, and a `Pressable`'s `onPress` hands its handler a gesture event —
   * so an optional parameter would let `onPress={lock}` compile and store an
   * event where a `LockReason` belongs. A required one makes that a type
   * error at the call site.
   */
  lock: (reason: LockReason) => void;
  biometric: BiometricUnlockController;
}

const VaultSessionContext = createContext<VaultSessionValue | null>(null);

interface VaultProviderProps {
  vaultApi: VaultApi;
  /**
   * The signed-in User, or `null` while there is none. Biometric Unlock is
   * bound to it: the keystore item is keyed by it, and every read, write, and
   * delete names it, so another User signing in on this device reaches nothing
   * (ADR 0108 decision 3).
   */
  userId: string | null;
  /**
   * The keystore Platform Adapter. Defaulted to the real one and injectable so
   * a harness can supply a fake.
   */
  keystore?: BiometricKeystore;
  children: ReactNode;
}

export function VaultProvider({
  vaultApi,
  userId,
  keystore = nativeBiometricKeystore,
  children,
}: VaultProviderProps): React.JSX.Element {
  const [status, setStatus] = useState<VaultStatus>('locked');
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  const [unlockSecret, setUnlockSecret] = useState<VaultUnlockSecret | null>(
    null,
  );
  const [lockReason, setLockReason] = useState<LockReason | null>('manual');
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null);
  const [biometricState, setBiometricState] =
    useState<BiometricUnlockState | null>(null);
  const [biometricMethod, setBiometricMethod] =
    useState<BiometricMethod | null>(null);

  const applyUnlockOutcome = useCallback(
    (outcome: { masterKey: Uint8Array; secret: VaultUnlockSecret }): void => {
      setMasterKey(outcome.masterKey);
      setUnlockSecret(outcome.secret);
      setUnlockedAt(Date.now());
      setLockReason(null);
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

  const lock = useCallback((reason: LockReason): void => {
    setMasterKey(null);
    setUnlockSecret(null);
    setUnlockedAt(null);
    setLockReason(reason);
    setStatus('locked');
  }, []);

  /**
   * The Vault session belongs to the signed-in User, so a change of User ends
   * it — the in-memory Master Key goes, and the biometric state is asked
   * again for whoever is here now.
   *
   * The lock is not housekeeping. Without it, logging out leaves `status` at
   * `unlocked` with the previous User's Master Key still in context, and the
   * next User to sign in on this device lands straight in the tab shell
   * holding it: their Vault Blob reads would be attempted with somebody
   * else's key, and accepting the Biometric Unlock offer would write that key
   * into *their* keystore item. ADR 0108 decision 3's "another User signing
   * in on the same device never reads or is offered it" is this line.
   *
   * The biometric state is asked once per User rather than per render of the
   * Unlock screen: the answer only moves when this provider's own calls move
   * it, and each of those writes the new state back.
   */
  useEffect(() => {
    lock('manual');

    if (userId === null) {
      setBiometricState(null);
      return;
    }
    let current = true;
    void readBiometricUnlockState(keystore, userId).then((state) => {
      if (current) setBiometricState(state);
    });
    void keystore.method().then((method) => {
      if (current) setBiometricMethod(method);
    });
    return () => {
      current = false;
    };
  }, [keystore, userId, lock]);

  /** The stored-key check the policy is handed. See ./biometric/keyCheck.ts. */
  const stillOpensVault = useCallback(
    (candidate: Uint8Array): Promise<boolean> =>
      storedKeyOpensVault({ vaultApi, masterKey: candidate }),
    [vaultApi],
  );

  const biometricUnlock =
    useCallback(async (): Promise<BiometricUnlockAttempt> => {
      if (userId === null) {
        return { outcome: 'unavailable', reason: 'missing' };
      }

      const attempt = await unlockWithBiometrics({
        keystore,
        userId,
        stillOpensVault,
      });

      if (attempt.outcome === 'unlocked') {
        applyUnlockOutcome({
          masterKey: attempt.masterKey,
          secret: 'biometric',
        });
      } else if (attempt.outcome === 'unavailable') {
        setBiometricState('off');
      }

      return attempt;
    }, [keystore, userId, stillOpensVault, applyUnlockOutcome]);

  const biometricEnable = useCallback(async (): Promise<BiometricEnrolment> => {
    if (userId === null || masterKey === null || unlockSecret === null) {
      return { outcome: 'refused', reason: 'not-passphrase' };
    }

    const enrolment = await enableBiometricUnlock({
      keystore,
      userId,
      masterKey,
      authorization: { secret: unlockSecret, unlockedAt, now: Date.now() },
    });
    if (enrolment.outcome === 'enabled') setBiometricState('on');
    return enrolment;
  }, [keystore, userId, masterKey, unlockSecret, unlockedAt]);

  const biometricEnableWithPassphrase = useCallback(
    async (passphrase: string): Promise<BiometricEnrolment> => {
      if (userId === null) {
        return { outcome: 'refused', reason: 'not-passphrase' };
      }

      // Derived afresh rather than taken from the session: a wrong passphrase
      // throws here, before anything is written, and the key written is the
      // one this passphrase opens.
      const response = await vaultApi.getVaultMeta();
      const meta = response.data.meta as VaultMetaV1;
      const proven = await unlockVaultWithPassphrase(
        meta,
        passphrase,
        mobileVaultCrypto,
      );
      const now = Date.now();
      const enrolment = await enableBiometricUnlock({
        keystore,
        userId,
        masterKey: proven.masterKey,
        authorization: { secret: proven.secret, unlockedAt: now, now },
      });
      if (enrolment.outcome === 'enabled') setBiometricState('on');
      return enrolment;
    },
    [keystore, userId, vaultApi],
  );

  const biometricDisable = useCallback(async (): Promise<void> => {
    if (userId === null) return;
    await disableBiometricUnlock(keystore, userId);
    setBiometricState('off');
  }, [keystore, userId]);

  const biometric = useMemo<BiometricUnlockController>(
    () => ({
      state: biometricState,
      method: biometricMethod,
      unlock: biometricUnlock,
      enable: biometricEnable,
      enableWithPassphrase: biometricEnableWithPassphrase,
      disable: biometricDisable,
    }),
    [
      biometricState,
      biometricMethod,
      biometricUnlock,
      biometricEnable,
      biometricEnableWithPassphrase,
      biometricDisable,
    ],
  );

  const value = useMemo<VaultSessionValue>(
    () => ({
      status,
      masterKey,
      unlockSecret,
      lockReason,
      unlockedAt,
      vaultApi,
      unlock,
      unlockWithRecoveryKey,
      lock,
      biometric,
    }),
    [
      status,
      masterKey,
      unlockSecret,
      lockReason,
      unlockedAt,
      vaultApi,
      unlock,
      unlockWithRecoveryKey,
      lock,
      biometric,
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
