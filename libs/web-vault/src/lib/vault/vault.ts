/**
 * Temporary shim over the Vault Handle.
 *
 * These module functions are the pre-ADR-0047 surface: they take no owner and
 * resolve one internally. They survive only so the call sites can be converted
 * in batches without ever producing two sources of truth for one User's Vault,
 * and they are deleted in #498. Do not add to them, and do not build on them.
 *
 * For a signed-in User every call goes through a handle bound to them. With no
 * signed-in User there is no owner to bind, so the call falls back to the
 * unsuffixed slot exactly as it did before — the shim's job is that every
 * current caller keeps working untouched.
 */
import { getCurrentUser } from '@myorganizer/auth';

import {
  createLocalVaultAccess,
  generateRecoveryKey as generateRecoveryKeyBytes,
  type LocalVaultAccess,
} from './localVaultAccess';
import { unclaimedLocalVaultSlot } from './localVaultStorage';
import type {
  EncryptedBlob,
  VaultRecordType,
  VaultStorageV1,
  VaultUnlockResult,
} from './localVaultStorage';
import { createVaultHandle } from './vaultHandle';

// The record shapes moved to the storage module; keep them importable from
// here so the shim's callers stay untouched.
export type {
  EncryptedBlob,
  VaultRecordType,
  VaultStorageV1,
  VaultUnlockResult,
};

function signedInOwner(): string | null {
  const id = getCurrentUser()?.id;
  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

function vaultFor(masterKeyBytes?: Uint8Array | null): LocalVaultAccess {
  const owner = signedInOwner();
  if (owner) return createVaultHandle({ owner, masterKeyBytes });

  return createLocalVaultAccess({
    slot: unclaimedLocalVaultSlot(),
    masterKeyBytes,
  });
}

export function loadVault(): VaultStorageV1 | null {
  return vaultFor().loadVault();
}

export function saveVault(vault: VaultStorageV1): void {
  vaultFor().saveVault(vault);
}

export function hasVault(): boolean {
  return vaultFor().hasVault();
}

export function generateRecoveryKey(): string {
  return generateRecoveryKeyBytes();
}

export async function initializeVault(options: {
  passphrase: string;
}): Promise<{ recoveryKey: string }> {
  return vaultFor().initialize(options);
}

export async function unlockVaultWithPassphrase(options: {
  passphrase: string;
}): Promise<VaultUnlockResult> {
  return vaultFor().unlockWithPassphrase(options);
}

export async function unlockVaultWithRecoveryKey(options: {
  recoveryKey: string;
}): Promise<VaultUnlockResult> {
  return vaultFor().unlockWithRecoveryKey(options);
}

export async function setNewPassphrase(options: {
  masterKeyBytes: Uint8Array;
  newPassphrase: string;
}): Promise<void> {
  return vaultFor(options.masterKeyBytes).changePassphrase({
    newPassphrase: options.newPassphrase,
  });
}

export async function loadDecryptedData<T>(options: {
  masterKeyBytes: Uint8Array;
  type: VaultRecordType;
  defaultValue: T;
}): Promise<T> {
  return vaultFor(options.masterKeyBytes).loadDecryptedData({
    type: options.type,
    defaultValue: options.defaultValue,
  });
}

export async function saveEncryptedData(options: {
  masterKeyBytes: Uint8Array;
  type: VaultRecordType;
  value: unknown;
}): Promise<void> {
  return vaultFor(options.masterKeyBytes).saveEncryptedData({
    type: options.type,
    value: options.value,
  });
}
