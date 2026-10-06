import type { VaultBlobReloadOutcome, VaultBlobWriteErrorKind } from './sync';

/**
 * How a screen gets past each refused Vault Push: `reload` reads the server's
 * copy, `retry` resends the held edit. A `not-applied` edit is not held, so
 * there is nothing to resend — the copy on screen is what it could not apply
 * to, and a fresh one is the only thing that can change that.
 */
const VAULT_WRITE_ERROR_RECOVERY = {
  conflict: 'reload',
  network: 'retry',
  failed: 'retry',
  'not-applied': 'reload',
} as const satisfies Record<VaultBlobWriteErrorKind, 'reload' | 'retry'>;

/** Whether the action a write error's note offers is a reload, not a retry. */
export function recoversByReload(
  kind: VaultBlobWriteErrorKind | null,
): boolean {
  return kind !== null && VAULT_WRITE_ERROR_RECOVERY[kind] === 'reload';
}

/**
 * What a screen does once the reload it offered — after a `conflict`, or
 * after an edit that was `not-applied` and so left nothing held — has
 * settled ([ADR 0121](../../../../../docs/adr/0121-a-mobile-vault-pull-converges-the-unsent-edit-it-is-handed.md)).
 *
 * - `keepReverted` — the edit is still held, so its note stays on the row it
 *   was reverted on. Any other outcome settles the edit, and an id left
 *   behind would mark that row on some later, unrelated failure.
 * - `sent` — the edit reached the server, which is when a sheet still showing
 *   its draft closes; left open, the draft would be created a second time.
 */
export function settleConflictReload(outcome: VaultBlobReloadOutcome): {
  keepReverted: boolean;
  sent: boolean;
} {
  return { keepReverted: outcome === 'held', sent: outcome === 'sent' };
}

/**
 * Whether a sheet holding a draft is busy, and so may not be cancelled.
 *
 * A push of the draft is in flight while its id is pending. A reload may be
 * sending a draft whose push was refused, and `discard` cannot drop an edit
 * that is already on its way — so a cancel allowed then would close the sheet
 * over a record that is about to be created.
 */
export function draftSheetBusy(state: {
  pendingId: string | null;
  refreshing: boolean;
}): boolean {
  return state.pendingId !== null || state.refreshing;
}
