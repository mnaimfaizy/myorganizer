import type { VaultBlobReloadOutcome } from './sync';

/**
 * What a screen does once the reload it offered after a `conflict` has
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
