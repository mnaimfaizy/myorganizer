import type { VaultCrypto } from '@myorganizer/vault-core/portable';
import type { VaultMetaV1 } from '@myorganizer/app-api-client';
import { base64ToBytes } from './bytes';
import { PBKDF2_ITERATIONS } from './constants';

/**
 * Which secret produced the current in-memory Vault Unlock (CONTEXT.md,
 * "Vault Unlock Secret"). Biometric Unlock is a third value the next slice
 * adds; this slice only ever produces the first two.
 */
export type VaultUnlockSecret = 'passphrase' | 'recovery-key';

export interface VaultUnlockOutcome {
  masterKey: Uint8Array;
  secret: VaultUnlockSecret;
}

interface WrappedKeyBlob {
  iv: string;
  ciphertext: string;
}

/**
 * The pure half of a mobile Vault Unlock: given the server's vault meta and a
 * secret, unwrap the Master Key. Takes a `VaultCrypto` explicitly rather than
 * reaching for the `mobileVaultCrypto` singleton, so this module carries no
 * `react-native-quick-crypto` import and stays loadable — and testable — in a
 * plain Node Jest environment. `VaultSessionContext` is what fetches the meta
 * and supplies the real adapter; this module never talks to the network.
 */
export async function unlockVaultWithPassphrase(
  meta: VaultMetaV1,
  passphrase: string,
  crypto: VaultCrypto,
): Promise<VaultUnlockOutcome> {
  const salt = base64ToBytes(meta.kdf_salt);
  const params = meta.kdf_params as Record<string, unknown> | undefined;
  const iterations = Number(params?.['iterations']) || PBKDF2_ITERATIONS;

  const wrappingKey = await crypto.deriveKeyFromPassphrase({
    passphrase,
    salt,
    iterations,
  });

  const wrapped = meta.wrapped_mk_passphrase as WrappedKeyBlob;

  // A wrong passphrase yields a wrong wrapping key, so the GCM auth tag
  // fails to verify and this rejects — no plaintext key is ever produced.
  const masterKey = await crypto.aesGcmDecrypt({
    key: wrappingKey,
    ciphertext: base64ToBytes(wrapped.ciphertext),
    iv: base64ToBytes(wrapped.iv),
  });

  return { masterKey, secret: 'passphrase' };
}

/**
 * The Recovery Key half. A Recovery Key wraps the Master Key directly instead
 * of deriving anything (CONTEXT.md, "Recovery Key") — it carries no salt and
 * no KDF parameters of its own, so its bytes import straight in as the
 * AES-GCM key that unwraps `wrapped_mk_recovery`.
 */
export async function unlockVaultWithRecoveryKey(
  meta: VaultMetaV1,
  recoveryKey: string,
  crypto: VaultCrypto,
): Promise<VaultUnlockOutcome> {
  const wrappingKey = await crypto.importAesGcmKey(base64ToBytes(recoveryKey));
  const wrapped = meta.wrapped_mk_recovery as WrappedKeyBlob;

  const masterKey = await crypto.aesGcmDecrypt({
    key: wrappingKey,
    ciphertext: base64ToBytes(wrapped.ciphertext),
    iv: base64ToBytes(wrapped.iv),
  });

  return { masterKey, secret: 'recovery-key' };
}
