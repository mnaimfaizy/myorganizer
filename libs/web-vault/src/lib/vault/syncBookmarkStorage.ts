/**
 * Sync Bookmark storage — one entry per User, per Vault Blob Type.
 *
 * A Sync Bookmark records what a device last pushed successfully for one
 * Vault Blob Type: the hash of the Ciphertext it sent, and the ETag the
 * server handed back for it. It is a second per-User namespace beside the
 * Local Vault (`localVaultStorage.ts`), keyed the same way — by owner — so
 * removing one User's bookmarks can never touch another's.
 *
 * The record also carries one Vault Meta Bookmark for the User: what this
 * device and the server last agreed on for Vault Meta. It is not a Vault Blob
 * Type and so is not an entry in `bookmarks` — it sits beside the map rather
 * than inside it, because a synthetic key would put a non-member into a table
 * keyed by `VaultRecordType`. What it shares with the map is the per-User key
 * and, with it, removal: both go when a User's Local Vault does.
 *
 * Unlike a Local Vault, neither is irreplaceable: losing a Sync Bookmark costs
 * at most one redundant push next time a dirtiness check runs, and losing the
 * Vault Meta Bookmark costs at most a prompt that misattributes a wrapping
 * change. Neither costs a User's data. A mis-keyed or corrupted entry is
 * therefore replaced rather than refused — there is no write guard here to
 * mirror `writeOwnedLocalVault`'s. See ADR 0058.
 */

import type { VaultRecordType } from './localVaultStorage';

/** What one Sync Bookmark records for one Vault Blob Type. */
export type SyncBookmarkEntry = {
  /** SHA-256 hex digest of the `{ iv, ciphertext }` last pushed successfully. */
  ciphertextHash: string;
  /** The ETag the server returned for that push. */
  etag: string;
};

/**
 * What a Vault Meta Bookmark records: the hash of the Vault Meta this device
 * and the server last agreed on.
 *
 * A hash rather than the meta itself, and rather than its ETag. The meta
 * itself would put a second copy of wrapping material beside the Local Vault
 * and invite the question of which one is authoritative; an ETag is never
 * obtained at all when the change was made offline, which is the case the
 * bookmark exists for. A hash proves the server has not moved and can
 * reconstruct nothing.
 */
export type VaultMetaBookmarkEntry = {
  /** SHA-256 hex digest of the Vault Meta last agreed on. */
  metaHash: string;
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
  /**
   * Absent until this device and the server have agreed on a Vault Meta.
   * Absent is not "in sync": it says this device holds no evidence either
   * way, which is what makes an unbookmarked device behave exactly as it did
   * before there was a bookmark to hold.
   */
  metaBookmark?: VaultMetaBookmarkEntry;
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

function isVaultMetaBookmarkEntry(
  value: unknown,
): value is VaultMetaBookmarkEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { metaHash?: unknown }).metaHash === 'string'
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

  const record: SyncBookmarkRecord = {
    version: SYNC_BOOKMARK_RECORD_VERSION,
    owner,
    bookmarks,
  };

  if (isVaultMetaBookmarkEntry(candidate.metaBookmark)) {
    record.metaBookmark = candidate.metaBookmark;
  }

  return record;
}

/**
 * `owner`'s whole record, or `null` when there is none that validates.
 *
 * Both writers below go through this rather than through `readSyncBookmarks`,
 * so that writing one half of the record cannot drop the other. A writer that
 * rebuilt the record from the bookmark map alone would erase the Vault Meta
 * Bookmark on the next Vault Push, which is the kind of loss that shows up as
 * a prompt misattributing a wrapping change days later.
 */
function readSyncBookmarkRecord(owner: string): SyncBookmarkRecord | null {
  assertOwner(owner);

  const storage = readableStorage();
  if (!storage) return null;

  const raw = storage.getItem(syncBookmarkStorageKey(owner));
  if (raw === null) return null;

  return asSyncBookmarkRecord(parseJson(raw), owner);
}

/**
 * Read `owner`'s Sync Bookmarks — empty when this device holds none, when
 * storage is unavailable, or when the entry under this key does not
 * validate as this owner's record.
 */
export function readSyncBookmarks(
  owner: string,
): Partial<Record<VaultRecordType, SyncBookmarkEntry>> {
  return readSyncBookmarkRecord(owner)?.bookmarks ?? {};
}

/**
 * Read `owner`'s Vault Meta Bookmark, or `undefined` when this device and the
 * server have never agreed on a Vault Meta — or when storage is unavailable
 * or the entry does not validate.
 */
export function readVaultMetaBookmark(
  owner: string,
): VaultMetaBookmarkEntry | undefined {
  return readSyncBookmarkRecord(owner)?.metaBookmark;
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

  const existing = readSyncBookmarkRecord(options.owner);
  const record: SyncBookmarkRecord = {
    version: SYNC_BOOKMARK_RECORD_VERSION,
    owner: options.owner,
    bookmarks: {
      ...(existing?.bookmarks ?? {}),
      [options.type]: options.entry,
    },
  };
  if (existing?.metaBookmark) {
    record.metaBookmark = existing.metaBookmark;
  }

  writeRecord(record);
}

/**
 * Advance `owner`'s Vault Meta Bookmark — the storage half of recording that
 * this device and the server now hold the same Vault Meta. Merges into
 * whatever Sync Bookmarks this owner already holds, for the same reason
 * `writeSyncBookmark` merges the other way.
 */
export function writeVaultMetaBookmark(options: {
  owner: string;
  entry: VaultMetaBookmarkEntry;
}): void {
  assertOwner(options.owner);

  const existing = readSyncBookmarkRecord(options.owner);
  writeRecord({
    version: SYNC_BOOKMARK_RECORD_VERSION,
    owner: options.owner,
    bookmarks: existing?.bookmarks ?? {},
    metaBookmark: options.entry,
  });
}

function writeRecord(record: SyncBookmarkRecord): void {
  writableStorage().setItem(
    syncBookmarkStorageKey(record.owner),
    JSON.stringify(record),
  );
}

/**
 * Remove every Sync Bookmark `owner` holds, and their Vault Meta Bookmark
 * with them — the bookmark half of Explicit
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
