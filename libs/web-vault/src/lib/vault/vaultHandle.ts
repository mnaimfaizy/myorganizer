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
import { VaultBlobType, VaultMetaV1 } from '@myorganizer/app-api-client';

import {
  createLocalVaultAccess,
  type LocalVaultAccess,
} from './localVaultAccess';
import { type LocalVaultRevision } from './localVaultRevision';
import {
  assertVaultOwner,
  ownedLocalVaultSlot,
  type VaultRecordType,
} from './localVaultStorage';
import { createSyncBookmarkAccess } from './syncBookmarkAccess';
import { VAULT_BLOB_TYPE_BY_FIELD } from './vaultBlobFields';

export { VaultLockedError, VaultSecretMismatchError } from './localVaultAccess';
// `NoUnclaimedLocalVaultError` and `LocalVaultAlreadyOwnedError` stay
// internal: `claimUnclaimedLocalVaultOnEvidence` reads `vaultStatus` before it
// claims and reports `skipped-nothing-to-claim` / `skipped-already-owned`
// rather than letting either throw, so reaching one is a programming error
// rather than a case the interface asks callers to handle.
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
  /**
   * The hash of the Vault Meta this device and the server last agreed on, or
   * `undefined` when they never have. It is what tells a wrapping changed here
   * apart from one changed elsewhere — without it the two are the same
   * observation. See CONTEXT.md's "Vault Meta Bookmark" entry.
   */
  lastAgreedVaultMetaHash(): string | undefined;
  /**
   * Advance this owner's Vault Meta Bookmark to `meta`. Call it only after a
   * successful Vault Meta Push, or to record what this device and the server
   * last agreed on before a push that has not landed.
   */
  recordVaultMetaAgreement(options: { meta: VaultMetaV1 }): Promise<void>;
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
  /**
   * Told whenever this handle replaces the whole Local Vault. Optional for the
   * same reason `syncSink` is: a handle without one behaves exactly as it did
   * before there was one to give, which is what keeps export, import and the
   * tests untouched.
   */
  revision?: LocalVaultRevision | null;
}): VaultHandle {
  assertVaultOwner(options.owner);

  const access = createLocalVaultAccess({
    slot: ownedLocalVaultSlot(options.owner),
    masterKeyBytes: options.masterKeyBytes,
  });
  const bookmarks = createSyncBookmarkAccess(options.owner);
  const syncSink = options.syncSink ?? null;
  const revision = options.revision ?? null;

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

  /**
   * Tell readers the Local Vault they are holding has been replaced.
   *
   * Same fire-and-forget contract as `reportChange` and for the same reason:
   * the write has landed by the time this runs, so nothing a reader does with
   * the news may turn a completed write into a failed one.
   */
  const reportVaultReplaced = (): void => {
    if (!revision) return;
    try {
      revision.bump();
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
    loadUnclaimedVault: access.loadUnclaimedVault,
    // Not reported to the sink, and the asymmetry with `saveEncryptedData` is
    // deliberate. `saveVault` writes a whole Local Vault and names no Vault
    // Blob Type, so there is nothing to report; and it is how convergence
    // itself writes Ciphertext back after taking the server's copy, so
    // reporting here would feed the sink its own output.
    //
    // The Local Vault Revision is told, and that is not the same thing. The
    // sink exists to send a change outward; the revision exists to tell
    // whoever is already reading this Vault that what they hold is no longer
    // what is stored. Convergence replacing Ciphertext is the case that needs
    // saying loudest, which is exactly the case the sink must not hear.
    saveVault: (vault) => {
      access.saveVault(vault);
      reportVaultReplaced();
    },
    // Explicit Local Vault removal (ADR 0033) also removes this owner's Sync
    // Bookmarks (ADR 0058) — the two per-User namespaces are removed together
    // because a bookmark for a Vault this device no longer holds is stale by
    // construction, and a stray one only ever costs a redundant push.
    removeVault: () => {
      access.removeVault();
      bookmarks.removeBookmarks();
      reportVaultReplaced();
    },
    async hasUnsentChanges(type) {
      const vault = access.loadVault();
      return bookmarks.hasUnsentChanges({ type, blob: vault?.data[type] });
    },
    lastPushedEtag(type) {
      return bookmarks.lastPushedEtag({ type });
    },
    lastAgreedVaultMetaHash: bookmarks.lastAgreedVaultMetaHash,
    recordVaultMetaAgreement: bookmarks.recordVaultMetaAgreement,
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
    // A claim now changes what a reader sees, so readers are told. It did not
    // used to: an owner holding no Vault of their own resolved the Unclaimed
    // Local Vault implicitly, so recording it as theirs handed back the same
    // Ciphertext it already had. Removing that resolution is what changed it —
    // such an owner now reads no Vault at all until the claim lands, and a
    // reader not told would sit on that emptiness after it stopped being true.
    claimUnclaimedLocalVaultLocked: () => {
      access.claimUnclaimedLocalVaultLocked();
      reportVaultReplaced();
    },
    async claimUnclaimedLocalVaultByRecoveryKey(claimOptions) {
      const result =
        await access.claimUnclaimedLocalVaultByRecoveryKey(claimOptions);
      reportVaultReplaced();
      return result;
    },
    // A replacement changes the Ciphertext a reader who already holds this
    // owner's Local Vault would see — it is a different Vault under the same
    // key, not the same Vault newly owned — so readers are told here too.
    replaceOwnedLocalVaultWithUnclaimedLocked: () => {
      access.replaceOwnedLocalVaultWithUnclaimedLocked();
      reportVaultReplaced();
    },
    unlockWithPassphrase: access.unlockWithPassphrase,
    unlockWithRecoveryKey: access.unlockWithRecoveryKey,
    async replaceOwnedLocalVaultWithUnclaimedByRecoveryKey(replaceOptions) {
      const result =
        await access.replaceOwnedLocalVaultWithUnclaimedByRecoveryKey(
          replaceOptions,
        );
      reportVaultReplaced();
      return result;
    },
    changePassphrase: access.changePassphrase,
    resetPassphrase: access.resetPassphrase,
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
