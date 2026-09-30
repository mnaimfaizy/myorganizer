// Whether a Master Key read out of the keystore still opens this User's Vault
// (ADR 0108 decision 5).
//
// Separate from the policy because answering it needs the server, which the
// policy deliberately cannot reach, and separate from the Vault session
// context because the rule is worth reading on its own: it decides whether a
// stored key is **deleted**, and the only answer that may delete one is
// positive evidence that the key is wrong.
import { VaultBlobType, type VaultApi } from '@myorganizer/app-api-client';
import { isNetworkError } from '../networkError';
import { readVaultBlob } from '../sync';

/**
 * The server holds no Ciphertext for this User at all, so there is nothing a
 * Master Key could be checked against.
 *
 * Its own error type rather than a `false`, because "this key is wrong" and
 * "nobody can tell" are opposite answers with opposite consequences: the
 * first deletes the stored key, and the second must not. A fresh Vault that
 * has never been written to reaches this, and so does the Vault the User just
 * replaced on the web — which is exactly the case ADR 0108 decision 5 is
 * about, and the case a per-type "empty means fine" reading gets wrong.
 */
export class NoCiphertextToCheckError extends Error {
  constructor() {
    super('The server holds no vault ciphertext to check this key against.');
    this.name = 'NoCiphertextToCheckError';
  }
}

/**
 * Every Vault Blob Type, read off the generated enum rather than listed here.
 *
 * One would be enough if the server were guaranteed to hold it — every Vault
 * Blob of one Vault is encrypted under the same Master Key, so a key that
 * opens one opens all of them. It is the *absence* of a blob that forces the
 * fan-out: a type the server does not hold decrypts nothing and proves
 * nothing, so the check keeps asking until it finds one that does.
 */
const EVERY_BLOB_TYPE = Object.values(VaultBlobType);

function isTransportFailure(err: unknown): boolean {
  const status = (err as { response?: { status?: unknown } })?.response?.status;
  return typeof status === 'number' || isNetworkError(err);
}

/**
 * Whether this Master Key still opens this User's Vault.
 *
 * - `true` — a Vault Blob the server holds decrypted under it.
 * - `false` — a Vault Blob the server holds refused it. That is the AES-GCM
 *   auth tag rejecting a key that is not this Vault's, and it is the only
 *   answer that deletes the stored key.
 * - **throws** — nothing was learnt. A transport or server failure is
 *   rethrown, and a Vault with no Ciphertext at all raises
 *   `NoCiphertextToCheckError`. The caller asks for the passphrase and keeps
 *   the stored key, because neither is evidence about it.
 *
 * A blob the server does not hold is skipped rather than counted as a pass:
 * `readVaultBlob` answers a 404 with an empty envelope and a `null` ETag
 * without attempting any decryption, so reading that as "the key works" would
 * install a stale key over a replaced Vault and encrypt every later write
 * under a key the Vault cannot open.
 */
export async function storedKeyOpensVault(params: {
  vaultApi: VaultApi;
  masterKey: Uint8Array;
}): Promise<boolean> {
  for (const type of EVERY_BLOB_TYPE) {
    let snapshot;
    try {
      snapshot = await readVaultBlob({
        vaultApi: params.vaultApi,
        masterKey: params.masterKey,
        type,
      });
    } catch (err) {
      if (isTransportFailure(err)) throw err;
      // Anything else is the decryption refusing this key — the same shape a
      // wrong passphrase takes on the typed unlock path.
      return false;
    }

    // A `null` ETag is the 404: the server holds no blob of this type, so
    // nothing was decrypted and nothing was learnt. Keep asking.
    if (snapshot.etag !== null) return true;
  }

  throw new NoCiphertextToCheckError();
}
