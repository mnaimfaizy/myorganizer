/**
 * Sync Bookmark storage — one entry per User, per Vault Blob Type.
 *
 * A Sync Bookmark records what a device last pushed successfully for one
 * Vault Blob Type: the hash of the Ciphertext it sent, and the ETag the
 * server handed back for it. It is a second per-User namespace beside the
 * Local Vault (`localVaultStorage.ts`), keyed the same way — by owner — so
 * removing one User's bookmarks can never touch another's.
 *
 * Unlike a Local Vault, a Sync Bookmark is not irreplaceable: losing one
 * costs at most one redundant push next time a dirtiness check runs, never a
 * User's data. A mis-keyed or corrupted entry is therefore replaced rather
 * than refused — there is no write guard here to mirror
 * `writeOwnedLocalVault`'s. See ADR 0058.
 */

import type { VaultRecordType } from './localVaultStorage';

/** What one Sync Bookmark records for one Vault Blob Type. */
export type SyncBookmarkEntry = {
  /** SHA-256 hex digest of the `{ iv, ciphertext }` last pushed successfully. */
  ciphertextHash: string;
  /** The ETag the server returned for that push. */
  etag: string;
};

/** The storage key prefix every per-User Sync Bookmark key is composed from. */
export const SYNC_BOOKMARK_STORAGE_KEY = 'myorganizer_sync_bookmarks_v1';

/** Record version written for a Sync Bookmark entry. */
export const SYNC_BOOKMARK_RECORD_VERSION = 1;

/** One User's Sync Bookmarks, keyed by Vault Blob Type field name. */
export type SyncBookmarkRecord = {
  version: 1;
  owner: string;
  bookmarks: Partial<Record<VaultRecordType, SyncBookmarkEntry>>;
};

function assertOwner(owner: string): void {
  if (typeof owner !== 'string' || owner.trim().length === 0) {
    throw new Error('A Sync Bookmark cannot be resolved without an owner');
  }
}

/** The storage key one User's Sync Bookmarks live under. */
export function syncBookmarkStorageKey(owner: string): string {
  assertOwner(owner);
  return `${SYNC_BOOKMARK_STORAGE_KEY}:${owner}`;
}

function readableStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function writableStorage(): Storage {
  const storage = readableStorage();
  if (!storage) {
    throw new Error('Sync Bookmark storage is unavailable outside the browser');
  }
  return storage;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isSyncBookmarkEntry(value: unknown): value is SyncBookmarkEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { ciphertextHash?: unknown }).ciphertextHash ===
      'string' &&
    typeof (value as { etag?: unknown }).etag === 'string'
  );
}

/**
 * A validated record for `owner`, or `null` when the stored JSON does not
 * parse as a current-version record naming this owner. An entry naming
 * somebody else is rejected rather than trusted, same as Local Vault storage.
 */
function asSyncBookmarkRecord(
  parsed: unknown,
  owner: string,
): SyncBookmarkRecord | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<SyncBookmarkRecord>;
  if (candidate.version !== SYNC_BOOKMARK_RECORD_VERSION) return null;
  if (candidate.owner !== owner) return null;
  if (typeof candidate.bookmarks !== 'object' || candidate.bookmarks === null) {
    return null;
  }

  const bookmarks: Partial<Record<VaultRecordType, SyncBookmarkEntry>> = {};
  for (const [type, entry] of Object.entries(candidate.bookmarks)) {
    if (isSyncBookmarkEntry(entry)) {
      bookmarks[type as VaultRecordType] = entry;
    }
  }
  return { version: SYNC_BOOKMARK_RECORD_VERSION, owner, bookmarks };
}

/**
 * Read `owner`'s Sync Bookmarks — empty when this device holds none, when
 * storage is unavailable, or when the entry under this key does not
 * validate as this owner's record.
 */
export function readSyncBookmarks(
  owner: string,
): Partial<Record<VaultRecordType, SyncBookmarkEntry>> {
  assertOwner(owner);

  const storage = readableStorage();
  if (!storage) return {};

  const raw = storage.getItem(syncBookmarkStorageKey(owner));
  if (raw === null) return {};

  const record = asSyncBookmarkRecord(parseJson(raw), owner);
  return record ? record.bookmarks : {};
}

/**
 * Advance `owner`'s bookmark for `type` — the storage half of recording a
 * confirmed successful Vault Push. Merges into whatever bookmarks this owner
 * already holds for other Vault Blob Types.
 *
 * Touches only the key `owner` is stored under, so it can never write
 * another User's bookmarks.
 */
export function writeSyncBookmark(options: {
  owner: string;
  type: VaultRecordType;
  entry: SyncBookmarkEntry;
}): void {
  assertOwner(options.owner);

  const record: SyncBookmarkRecord = {
    version: SYNC_BOOKMARK_RECORD_VERSION,
    owner: options.owner,
    bookmarks: {
      ...readSyncBookmarks(options.owner),
      [options.type]: options.entry,
    },
  };
  writableStorage().setItem(
    syncBookmarkStorageKey(options.owner),
    JSON.stringify(record),
  );
}

/**
 * Remove every Sync Bookmark `owner` holds — the bookmark half of Explicit
 * Local Vault removal (ADR 0033, restated over this second per-User
 * namespace in ADR 0058).
 *
 * Touches only the key `owner` is stored under, so it can never remove
 * another User's bookmarks.
 */
export function removeSyncBookmarks(owner: string): void {
  assertOwner(owner);
  writableStorage().removeItem(syncBookmarkStorageKey(owner));
}
