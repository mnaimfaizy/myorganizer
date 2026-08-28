/**
 * The Vault Handle — the only supported way to reach a Local Vault.
 *
 * Vault access is obtained, not invoked: a caller acquires a handle bound to
 * one owner and one Master Key, and calls methods on it. Nothing exported here
 * hands back Vault data without an owner having been named first, which is the
 * property ADR 0047 exists to keep.
 *
 * Handles are not reusable across Users. When the owner changes, the old
 * handle is discarded and a new one is created.
 */
import {
  createLocalVaultAccess,
  type LocalVaultAccess,
} from './localVaultAccess';
import {
  assertVaultOwner,
  ownedLocalVaultSlot,
  type VaultRecordType,
} from './localVaultStorage';
import { createSyncBookmarkAccess } from './syncBookmarkAccess';

export { VaultLockedError, VaultSecretMismatchError } from './localVaultAccess';
// `NoUnclaimedLocalVaultError` stays internal: a caller reaches
// `claimUnclaimedLocalVault` only after `hasUnclaimedLocalVault`, so it is a
// programming error rather than a case the interface asks callers to handle.
export type { LocalVaultStatus } from './localVaultStorage';

export type VaultHandle = LocalVaultAccess & {
  /** The User this handle resolves a Local Vault for. Fixed at construction. */
  readonly owner: string;
  /**
   * Whether `type`'s current Ciphertext has unsent changes — derived from
   * this owner's Sync Bookmark, not a stored flag. See CONTEXT.md's "Sync
   * Bookmark" entry.
   */
  hasUnsentChanges(type: VaultRecordType): Promise<boolean>;
  /**
   * The ETag of the Ciphertext this device and the server last agreed on for
   * `type`, or `undefined` when they never have. A conditional push sends it
   * as `If-Match`, so the server refuses a push over Ciphertext this device
   * has not seen.
   */
  lastPushedEtag(type: VaultRecordType): string | undefined;
  /**
   * Advance this owner's Sync Bookmark for `type` to the Ciphertext currently
   * saved, which the server now holds under `etag`. Call it only when that is
   * a confirmed fact — after a successful Vault Push, or after adopting the
   * server's copy.
   */
  recordPushSuccess(options: {
    type: VaultRecordType;
    etag: string;
  }): Promise<void>;
};

/**
 * Acquire a handle to `owner`'s Local Vault.
 *
 * `masterKeyBytes` binds an already-unlocked Master Key; omit it and the
 * handle starts locked, with `unlockWithPassphrase` or `unlockWithRecoveryKey`
 * binding one.
 */
export function createVaultHandle(options: {
  owner: string;
  masterKeyBytes?: Uint8Array | null;
}): VaultHandle {
  assertVaultOwner(options.owner);

  const access = createLocalVaultAccess({
    slot: ownedLocalVaultSlot(options.owner),
    masterKeyBytes: options.masterKeyBytes,
  });
  const bookmarks = createSyncBookmarkAccess(options.owner);

  // Every method below is a closure over the access object's own state, so
  // handing the references out directly keeps them bound and keeps generics.
  return {
    owner: options.owner,
    get isUnlocked() {
      return access.isUnlocked;
    },
    hasVault: access.hasVault,
    hasOwnedVault: access.hasOwnedVault,
    vaultStatus: access.vaultStatus,
    hasUnclaimedLocalVault: access.hasUnclaimedLocalVault,
    loadVault: access.loadVault,
    saveVault: access.saveVault,
    // Explicit Local Vault removal (ADR 0033) also removes this owner's Sync
    // Bookmarks (ADR 0056) — the two per-User namespaces are removed together
    // because a bookmark for a Vault this device no longer holds is stale by
    // construction, and a stray one only ever costs a redundant push.
    removeVault: () => {
      access.removeVault();
      bookmarks.removeBookmarks();
    },
    async hasUnsentChanges(type) {
      const vault = access.loadVault();
      return bookmarks.hasUnsentChanges({ type, blob: vault?.data[type] });
    },
    lastPushedEtag(type) {
      return bookmarks.lastPushedEtag({ type });
    },
    async recordPushSuccess({ type, etag }) {
      const vault = access.loadVault();
      const blob = vault?.data[type];
      if (!blob) {
        throw new Error(
          `No Ciphertext saved for "${type}" to record a Sync Bookmark for`,
        );
      }
      await bookmarks.recordPushSuccess({ type, blob, etag });
    },
    initialize: access.initialize,
    claimUnclaimedLocalVault: access.claimUnclaimedLocalVault,
    unlockWithPassphrase: access.unlockWithPassphrase,
    unlockWithRecoveryKey: access.unlockWithRecoveryKey,
    changePassphrase: access.changePassphrase,
    loadDecryptedData: access.loadDecryptedData,
    decryptCiphertext: access.decryptCiphertext,
    saveEncryptedData: access.saveEncryptedData,
  };
}
