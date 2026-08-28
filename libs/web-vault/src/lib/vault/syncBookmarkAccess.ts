/**
 * Owner-bound access to Sync Bookmarks — the second half of the pair
 * `vaultHandle.ts` composes alongside Local Vault access.
 *
 * Whether a Vault Blob has unsent changes is derived here by hashing its
 * current Ciphertext and comparing that hash to the owner's bookmark, rather
 * than read from a flag some caller would otherwise have to remember to set.
 * See CONTEXT.md's "Sync Bookmark" entry.
 */

import type { EncryptedBlob, VaultRecordType } from './localVaultStorage';
import {
  readSyncBookmarks,
  removeSyncBookmarks,
  writeSyncBookmark,
} from './syncBookmarkStorage';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The hash a Sync Bookmark compares current Ciphertext against.
 *
 * Hashes only `iv` and `ciphertext` — the two fields a save ever changes —
 * so this never needs the Master Key and works while the Vault is locked.
 */
export async function hashCiphertext(blob: EncryptedBlob): Promise<string> {
  return sha256Hex(
    JSON.stringify({ ciphertext: blob.ciphertext, iv: blob.iv }),
  );
}

export type SyncBookmarkAccess = {
  /**
   * Whether `blob` differs from what this owner's Sync Bookmark last
   * recorded for `type` — the derived half of "has unsent changes". `blob`
   * absent (nothing saved yet for this type) is never unsent.
   */
  hasUnsentChanges(options: {
    type: VaultRecordType;
    blob: EncryptedBlob | undefined;
  }): Promise<boolean>;
  /**
   * The ETag of the Ciphertext this owner's device and the server last agreed
   * on for `type`, or `undefined` when they have never agreed on any.
   *
   * It is what a conditional push sends as `If-Match`, so the server can
   * refuse a push that would overwrite Ciphertext this device has not seen.
   * `undefined` is therefore not "no condition" — it says this device holds no
   * evidence about the server's copy, and a caller has to go and look.
   */
  lastPushedEtag(options: { type: VaultRecordType }): string | undefined;
  /**
   * Advance the bookmark for `type` to `blob`, which the server now holds
   * under `etag`.
   *
   * Call it only when that is a confirmed fact — after a successful Vault
   * Push, or after adopting the server's Ciphertext wholesale. Both leave this
   * device holding exactly what the server holds, which is what the bookmark
   * records; nothing else moves it.
   */
  recordPushSuccess(options: {
    type: VaultRecordType;
    blob: EncryptedBlob;
    etag: string;
  }): Promise<void>;
  /** Remove every bookmark this owner holds. */
  removeBookmarks(): void;
};

/** Sync Bookmark access bound to one owner. */
export function createSyncBookmarkAccess(owner: string): SyncBookmarkAccess {
  return {
    async hasUnsentChanges({ type, blob }) {
      if (!blob) return false;

      const currentHash = await hashCiphertext(blob);
      const bookmark = readSyncBookmarks(owner)[type];
      return bookmark === undefined || bookmark.ciphertextHash !== currentHash;
    },

    lastPushedEtag({ type }) {
      return readSyncBookmarks(owner)[type]?.etag;
    },

    async recordPushSuccess({ type, blob, etag }) {
      const ciphertextHash = await hashCiphertext(blob);
      writeSyncBookmark({ owner, type, entry: { ciphertextHash, etag } });
    },

    removeBookmarks() {
      removeSyncBookmarks(owner);
    },
  };
}
