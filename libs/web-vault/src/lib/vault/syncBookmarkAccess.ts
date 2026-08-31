/**
 * Owner-bound access to Sync Bookmarks — the second half of the pair
 * `vaultHandle.ts` composes alongside Local Vault access.
 *
 * Whether a Vault Blob has unsent changes is derived here by hashing its
 * current Ciphertext and comparing that hash to the owner's bookmark, rather
 * than read from a flag some caller would otherwise have to remember to set.
 * See CONTEXT.md's "Sync Bookmark" entry.
 */

import type { VaultMetaV1 } from '@myorganizer/app-api-client';

import type { EncryptedBlob, VaultRecordType } from './localVaultStorage';
import {
  readSyncBookmarks,
  readVaultMetaBookmark,
  removeSyncBookmarks,
  writeSyncBookmark,
  writeVaultMetaBookmark,
} from './syncBookmarkStorage';
import { vaultMetaIdentity } from './vaultMetaConverge';

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

/**
 * The hash a Vault Meta Bookmark compares a Vault Meta against.
 *
 * Hashes the Vault Meta's identity rather than the object, so two metas the
 * server and this device would both call the same one hash the same however
 * their JSON was ordered. Needs no Master Key and works while the Vault is
 * locked, which is what lets a pending push be retried at session start.
 */
export async function hashVaultMeta(meta: VaultMetaV1): Promise<string> {
  return sha256Hex(vaultMetaIdentity(meta));
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
  /**
   * The hash of the Vault Meta this owner's device and the server last agreed
   * on, or `undefined` when they never have.
   *
   * `undefined` is not "in sync": it says this device holds no evidence about
   * the server's Vault Meta, which is what makes a device that has never
   * pushed one behave exactly as it did before there was a bookmark.
   */
  lastAgreedVaultMetaHash(): string | undefined;
  /**
   * Advance this owner's Vault Meta Bookmark to `meta`.
   *
   * Call it only when this device and the server holding that Vault Meta is a
   * confirmed fact — after a successful Vault Meta Push — or when recording
   * what they last agreed on before a push that has not landed yet. Nothing
   * else moves it.
   */
  recordVaultMetaAgreement(options: { meta: VaultMetaV1 }): Promise<void>;
  /**
   * Remove every bookmark this owner holds, Sync Bookmarks and the Vault Meta
   * Bookmark alike.
   */
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

    lastAgreedVaultMetaHash() {
      return readVaultMetaBookmark(owner)?.metaHash;
    },

    async recordVaultMetaAgreement({ meta }) {
      writeVaultMetaBookmark({
        owner,
        entry: { metaHash: await hashVaultMeta(meta) },
      });
    },

    removeBookmarks() {
      removeSyncBookmarks(owner);
    },
  };
}
