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
import type {
  VaultSyncStatus,
  VaultSyncStatusKind,
} from '@myorganizer/web-vault';

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
 * What each Vault Sync Status Kind is read as, pinned against the kind rather
 * than switched on it — so a later kind fails to compile here until it says
 * what a User is told for it ([ADR 0053](../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
 * A `default` branch would have let `standoff` fall through as an unlabeled,
 * silently-synced reading, which is exactly the invisible refusal
 * [ADR 0067](../../../../docs/adr/0067-a-vault-blob-is-never-taken-across-a-vault-identity.md)
 * exists to end.
 */
const VAULT_SYNC_STATUS_READINGS = {
  synced: () => ({ tone: 'ok', label: null, detail: null, canRetry: false }),

  pending: (status) => {
    const suffix = status.retrying ? ' Retrying automatically.' : '';
    return {
      tone: 'pending',
      label: 'Changes not yet sent',
      detail: `Not yet reached the server: ${nameList(status.pendingTypes)}.${suffix} Your edits are saved on this device.`,
      canRetry: true,
    };
  },

  'session-ended': () => ({
    tone: 'error',
    label: 'Sync stopped — sign in again',
    detail:
      'Your session ended, so changes have stopped reaching the server. Sign in again to resume syncing.',
    canRetry: true,
  }),

  terminal: (status) => {
    const names = nameList(status.terminalFailures.map((f) => f.type));
    return {
      tone: 'error',
      label: 'Some changes could not be saved',
      detail: `The server rejected this data and it will not be retried automatically: ${names}. It is still safe on this device.`,
      canRetry: true,
    };
  },

  standoff: () => ({
    tone: 'error',
    label: 'This vault is not the one on the server',
    detail:
      "The encrypted data on the server belongs to a different vault than this device's, so nothing can be combined. Nothing has been overwritten, and retrying will not change that — sign in to the vault this data belongs to, or start fresh from a device that already holds this device's vault.",
    canRetry: false,
  }),
} as const satisfies Record<
  VaultSyncStatusKind,
  (status: VaultSyncStatus) => VaultSyncStatusReading
>;

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

  return VAULT_SYNC_STATUS_READINGS[status.kind](status);
}
