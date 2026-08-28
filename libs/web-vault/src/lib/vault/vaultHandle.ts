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
import { VaultBlobType } from '@myorganizer/app-api-client';

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
import { VAULT_BLOB_TYPE_BY_FIELD } from './vaultBlobFields';

export { VaultLockedError, VaultSecretMismatchError } from './localVaultAccess';
// `NoUnclaimedLocalVaultError` stays internal: a caller reaches
// `claimUnclaimedLocalVault` only after `hasUnclaimedLocalVault`, so it is a
// programming error rather than a case the interface asks callers to handle.
export type { LocalVaultStatus } from './localVaultStorage';

/**
 * Where a Vault Handle reports that one Vault Blob Type's Ciphertext changed.
 *
 * The sink lives on the handle rather than beside it. The handle is the only
 * supported way to reach a Local Vault (ADR 0047), and that guarantee is worth
 * something only while it is unbypassable: a sink bolted on outside would mean
 * holding a handle is enough to write locally and never synchronise, which
 * reopens the hole one layer up. Pushing at each write call site is the same
 * failure spread thinner — the next call site added is the one that silently
 * does not synchronise.
 *
 * The handle hands over a Vault Blob Type and itself, never Ciphertext. What
 * the sink does with that is its own business, and `createVaultSyncQueue` is
 * the implementation this library ships: mark the type unsent, and drain
 * through the converge primitive, reading the Local Vault when it drains.
 *
 * Reporting is fire-and-forget. It is called after the Local Vault write has
 * landed, its return value is ignored, and anything it throws is swallowed —
 * a save has already succeeded by the time the sink hears about it, so a sink
 * failure must never surface as a failed edit.
 */
export type VaultSyncSink = {
  vaultBlobChanged(change: { type: VaultBlobType; handle: VaultHandle }): void;
};

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
 *
 * `syncSink` is optional, and omitting it is not a degraded mode: a handle
 * without one does exactly what a handle did before there was one to give,
 * which is what keeps every caller that has no server to reach — tests,
 * export, import, the shim — untouched.
 */
export function createVaultHandle(options: {
  owner: string;
  masterKeyBytes?: Uint8Array | null;
  syncSink?: VaultSyncSink | null;
}): VaultHandle {
  assertVaultOwner(options.owner);

  const access = createLocalVaultAccess({
    slot: ownedLocalVaultSlot(options.owner),
    masterKeyBytes: options.masterKeyBytes,
  });
  const bookmarks = createSyncBookmarkAccess(options.owner);
  const syncSink = options.syncSink ?? null;

  /**
   * Tell the sink which Vault Blob Type just changed, and let nothing it does
   * reach the caller.
   *
   * Both halves matter. The call is not awaited, so a save resolves on the
   * Local Vault write and never on the network. The throw is swallowed,
   * because by this point the edit is saved: propagating would report a
   * successful edit as a failed one, and a User told their edit failed retypes
   * data that is already there.
   */
  const reportChange = (field: VaultRecordType): void => {
    if (!syncSink) return;
    try {
      syncSink.vaultBlobChanged({
        type: VAULT_BLOB_TYPE_BY_FIELD[field],
        handle,
      });
    } catch {
      // Deliberately swallowed — see above.
    }
  };

  // Every method below is a closure over the access object's own state, so
  // handing the references out directly keeps them bound and keeps generics.
  const handle: VaultHandle = {
    owner: options.owner,
    get isUnlocked() {
      return access.isUnlocked;
    },
    hasVault: access.hasVault,
    hasOwnedVault: access.hasOwnedVault,
    vaultStatus: access.vaultStatus,
    hasUnclaimedLocalVault: access.hasUnclaimedLocalVault,
    loadVault: access.loadVault,
    // Not reported to the sink, and the asymmetry with `saveEncryptedData` is
    // deliberate. `saveVault` writes a whole Local Vault and names no Vault
    // Blob Type, so there is nothing to report; and it is how convergence
    // itself writes Ciphertext back after taking the server's copy, so
    // reporting here would feed the sink its own output.
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
    // The one write that names a Vault Blob Type, so the one the sink hears
    // about. Local first, then the report: the Local Vault is written and this
    // promise is settled by everything the caller can observe before the sink
    // has done anything at all.
    async saveEncryptedData(saveOptions) {
      await access.saveEncryptedData(saveOptions);
      reportChange(saveOptions.type);
    },
  };

  return handle;
}
