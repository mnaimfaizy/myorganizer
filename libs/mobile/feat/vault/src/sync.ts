import {
  VaultBlobType,
  type PutVaultBlobResponse,
  type VaultApi,
} from '@myorganizer/app-api-client';
import {
  toVaultBlobEnvelope,
  VAULT_BLOB_CONVERGE_STRATEGIES,
  type VaultBlobConvergeStrategy,
  type VaultBlobEnvelope,
} from '@myorganizer/vault-core/portable';

import { IV_LENGTH } from './constants';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  mobileVaultCrypto,
  utf8ToBytes,
} from './crypto';

/**
 * One Vault Blob as this device last read or wrote it: the decrypted
 * envelope, and the ETag of the Ciphertext it was decrypted from.
 *
 * `etag` is `null` when the server held no blob of this type at read time.
 * The envelope is then empty, and a write of it is a creation.
 */
export interface VaultBlobSnapshot {
  envelope: VaultBlobEnvelope<unknown>;
  etag: string | null;
}

/**
 * A mobile Vault Push that could not converge without a decision the User has
 * to make, so nothing was written.
 *
 * - `strategy` — the blob type's pinned strategy is `promptOnConflict`, and
 *   the server moved since this device read it.
 * - `retries-exhausted` — the server moved again under every merged retry.
 *
 * Either way the edit is still in the caller's hands; reloading reads the
 * server's copy and the User can make the edit again.
 */
export class VaultBlobConflictError extends Error {
  constructor(
    readonly type: VaultBlobType,
    readonly reason: 'strategy' | 'retries-exhausted',
  ) {
    super(
      reason === 'strategy'
        ? `The "${type}" Vault Blob changed on another device`
        : `The "${type}" Vault Blob kept changing on another device`,
    );
    this.name = 'VaultBlobConflictError';
  }
}

function httpStatus(error: unknown): number | undefined {
  const status = (error as { response?: { status?: unknown } })?.response
    ?.status;
  return typeof status === 'number' ? status : undefined;
}

// Re-exported for existing callers. `networkError.ts` is the module without a
// react-native-quick-crypto import, so a caller outside this feature can
// depend on it and stay loadable in a plain Node Jest environment.
export { isNetworkError } from './networkError';

/**
 * Reads one Vault Blob and decrypts it on device with the Master Key.
 *
 * A read, not a Vault Pull: mobile keeps no Local Vault, so nothing is
 * converged on the way in — the result is simply what the server holds.
 *
 * A server with no blob of this type (404) reads as an empty envelope with no
 * ETag, so an edit made against it writes the first copy. Every other failure
 * — the network, the server, a Ciphertext this Master Key cannot open — is
 * thrown; none of them is evidence the blob is empty.
 */
/**
 * A Vault Blob Type's records before its first write, in the shape its
 * readers and edits expect — the web's shape for the same blob. Groceries
 * holds an object, `{ catalog, lists }`; the other four hold a list. Every
 * type once got a list here, which `createGroceryList` rightly declines to
 * edit, so a new account's first Grocery List saved as nothing at all — and
 * saved that empty list as the blob, which is why a read repairs it too.
 */
const EMPTY_RECORDS = {
  [VaultBlobType.Addresses]: () => [],
  [VaultBlobType.Groceries]: () => ({ catalog: [], lists: [] }),
  [VaultBlobType.MobileNumbers]: () => [],
  [VaultBlobType.Subscriptions]: () => [],
  [VaultBlobType.Tasks]: () => [],
} as const satisfies Record<VaultBlobType, () => unknown>;

export async function readVaultBlob(params: {
  vaultApi: VaultApi;
  masterKey: Uint8Array;
  type: VaultBlobType;
}): Promise<VaultBlobSnapshot> {
  let response;
  try {
    response = await params.vaultApi.getVaultBlob({ type: params.type });
  } catch (err) {
    if (httpStatus(err) === 404) {
      return {
        envelope: { records: EMPTY_RECORDS[params.type](), deletions: {} },
        etag: null,
      };
    }
    throw err;
  }

  const { blob, etag } = response.data;
  const plaintext = await mobileVaultCrypto.aesGcmDecrypt({
    key: params.masterKey,
    ciphertext: base64ToBytes(blob.ciphertext),
    iv: base64ToBytes(blob.iv),
  });

  const envelope = toVaultBlobEnvelope(JSON.parse(bytesToUtf8(plaintext)));
  return {
    envelope: {
      ...envelope,
      // A blob saved empty in the wrong shape reads as empty in the right
      // one: an empty list holds nothing to lose.
      records:
        Array.isArray(envelope.records) && envelope.records.length === 0
          ? EMPTY_RECORDS[params.type]()
          : envelope.records,
    },
    etag,
  };
}

async function encryptEnvelope(
  masterKey: Uint8Array,
  envelope: VaultBlobEnvelope<unknown>,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = mobileVaultCrypto.randomBytes(IV_LENGTH);
  const ciphertext = await mobileVaultCrypto.aesGcmEncrypt({
    key: masterKey,
    plaintext: utf8ToBytes(JSON.stringify(envelope)),
    iv,
  });
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

/**
 * This device's edited envelope converged with a newer server copy, by the
 * blob type's pinned strategy — the same table and the same merge the web
 * converge reads, so a mobile merge and a web merge of the same two copies
 * agree.
 */
function converge(
  type: VaultBlobType,
  local: VaultBlobEnvelope<unknown>,
  remote: VaultBlobEnvelope<unknown>,
): VaultBlobEnvelope<unknown> {
  const strategy = VAULT_BLOB_CONVERGE_STRATEGIES[
    type
  ] as VaultBlobConvergeStrategy;
  if (strategy.strategy === 'promptOnConflict') {
    throw new VaultBlobConflictError(type, 'strategy');
  }
  return strategy.merge(local, remote);
}

/** How many PUTs a push makes before it stops merging and asks for a reload. */
const MAX_PUSH_ATTEMPTS = 3;

/**
 * Writes an edited Vault Blob to the server as Ciphertext — the mobile Vault
 * Push ([ADR 0107](../../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md)).
 *
 * Mobile keeps no Local Vault, so this is read-modify-write against the
 * server. `edited` is the envelope the caller read at `etag`, with its edit
 * applied; it is sent with `If-Match: etag`. When the server has moved (409)
 * the newer copy is read, decrypted, and merged per record with the edit
 * before the next attempt, and a type pinned to `promptOnConflict` throws
 * `VaultBlobConflictError` instead. Nothing is ever sent without either an
 * ETag to match or a fresh read that found no blob to overwrite.
 *
 * Returns what the server now holds: the envelope actually written — the
 * merge, when there was one — and its ETag. Throws on any failure, and on a
 * throw nothing this call wrote needs undoing: a PUT either landed whole or
 * did not land.
 */
export async function pushVaultBlob(params: {
  vaultApi: VaultApi;
  masterKey: Uint8Array;
  type: VaultBlobType;
  edited: VaultBlobEnvelope<unknown>;
  etag: string | null;
}): Promise<VaultBlobSnapshot & { etag: string }> {
  const { vaultApi, masterKey, type } = params;
  let envelope = params.edited;
  let ifMatch = params.etag;
  // A PUT with no If-Match overwrites unconditionally, so a push that holds
  // no ETag looks again first: another device may have written the first
  // copy since this one read a 404.
  let stale = ifMatch === null;

  for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt += 1) {
    if (stale) {
      const fresh = await readVaultBlob({ vaultApi, masterKey, type });
      if (fresh.etag !== null) {
        envelope = converge(type, envelope, fresh.envelope);
      }
      ifMatch = fresh.etag;
    }

    try {
      const response = await vaultApi.putVaultBlob({
        type,
        putVaultBlobRequest: {
          type,
          blob: { version: 1, ...(await encryptEnvelope(masterKey, envelope)) },
        },
        ifMatch: ifMatch ?? undefined,
      });
      const { etag } = response.data as PutVaultBlobResponse;
      return { envelope, etag };
    } catch (err) {
      if (httpStatus(err) !== 409) throw err;
      stale = true;
    }
  }

  throw new VaultBlobConflictError(type, 'retries-exhausted');
}
