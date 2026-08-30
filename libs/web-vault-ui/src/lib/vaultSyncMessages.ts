/**
 * User-facing copy for a {@link VaultSyncStatus} reading — the sync status
 * indicator's presentation logic, kept out of `@myorganizer/web-vault` the
 * same way `vaultImportErrorMessages.ts` keeps import copy out of
 * `vault-core`: the library that decides *what happened* carries no English
 * text, and the library that shows a User owns naming it.
 *
 * Every string here is built from {@link VAULT_BLOB_TYPE_LABELS} and fixed
 * template text only — never from the underlying HTTP error. That is what
 * keeps a server's 422 response body, a stray plaintext value, or a token out
 * of anything a User reads: there is no code path here that reads `error`.
 */
import { VaultBlobType } from '@myorganizer/app-api-client';
import type { VaultSyncStatus } from '@myorganizer/web-vault';

/**
 * Every Vault Blob Type, and the name a User sees for it. Guarded by
 * `satisfies` so a seventh Vault Blob Type fails to compile here until it has
 * a label — see ADR 0053.
 */
export const VAULT_BLOB_TYPE_LABELS = {
  [VaultBlobType.Addresses]: 'Addresses',
  [VaultBlobType.Groceries]: 'Grocery Lists',
  [VaultBlobType.MobileNumbers]: 'Mobile Numbers',
  [VaultBlobType.Subscriptions]: 'Subscriptions',
  [VaultBlobType.Tasks]: 'Tasks',
  [VaultBlobType.Todos]: 'Todos',
} as const satisfies Record<VaultBlobType, string>;

export function vaultBlobTypeLabel(type: VaultBlobType): string {
  return VAULT_BLOB_TYPE_LABELS[type];
}

/** How loudly the indicator should present a reading. */
export type VaultSyncTone = 'ok' | 'pending' | 'error';

export type VaultSyncStatusReading = {
  tone: VaultSyncTone;
  /** Short state label. Null while everything is synced — a healthy sync
   * should not add chrome to the page. */
  label: string | null;
  /** One or two sentences on what happened and what happens next. Null when synced. */
  detail: string | null;
  /** Whether a manual retry is worth offering for this reading. */
  canRetry: boolean;
};

function nameList(types: VaultBlobType[]): string {
  return types.map(vaultBlobTypeLabel).join(', ');
}

/**
 * Turn a derived {@link VaultSyncStatus} into what a User should be told.
 *
 * `null` means the status has not been computed yet (no Vault Session, or the
 * first read still in flight) and reads as `pending` with no label — the same
 * "we do not know yet, so do not claim success" choice `describeSyncFreshness`
 * makes for the YouTube library indicator.
 */
export function describeVaultSyncStatus(
  status: VaultSyncStatus | null,
): VaultSyncStatusReading {
  if (!status) {
    return { tone: 'pending', label: null, detail: null, canRetry: false };
  }

  switch (status.kind) {
    case 'synced':
      return { tone: 'ok', label: null, detail: null, canRetry: false };

    case 'pending': {
      const suffix = status.retrying ? ' Retrying automatically.' : '';
      return {
        tone: 'pending',
        label: 'Changes not yet sent',
        detail: `Not yet reached the server: ${nameList(status.pendingTypes)}.${suffix} Your edits are saved on this device.`,
        canRetry: true,
      };
    }

    case 'session-ended':
      return {
        tone: 'error',
        label: 'Sync stopped — sign in again',
        detail:
          'Your session ended, so changes have stopped reaching the server. Sign in again to resume syncing.',
        canRetry: true,
      };

    case 'terminal': {
      const names = nameList(status.terminalFailures.map((f) => f.type));
      return {
        tone: 'error',
        label: 'Some changes could not be saved',
        detail: `The server rejected this data and it will not be retried automatically: ${names}. It is still safe on this device.`,
        canRetry: true,
      };
    }

    default:
      return { tone: 'pending', label: null, detail: null, canRetry: false };
  }
}
