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
import { assertVaultOwner, ownedLocalVaultSlot } from './localVaultStorage';

export { VaultLockedError, VaultSecretMismatchError } from './localVaultAccess';

export type VaultHandle = LocalVaultAccess & {
  /** The User this handle resolves a Local Vault for. Fixed at construction. */
  readonly owner: string;
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

  // Every method below is a closure over the access object's own state, so
  // handing the references out directly keeps them bound and keeps generics.
  return {
    owner: options.owner,
    get isUnlocked() {
      return access.isUnlocked;
    },
    hasVault: access.hasVault,
    loadVault: access.loadVault,
    saveVault: access.saveVault,
    initialize: access.initialize,
    unlockWithPassphrase: access.unlockWithPassphrase,
    unlockWithRecoveryKey: access.unlockWithRecoveryKey,
    changePassphrase: access.changePassphrase,
    loadDecryptedData: access.loadDecryptedData,
    saveEncryptedData: access.saveEncryptedData,
  };
}
