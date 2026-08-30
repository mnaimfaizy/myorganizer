/**
 * Sync status — telling a User "saved here" from "saved everywhere", derived
 * rather than tracked. See PRD #544's status table and #553's acceptance
 * criteria.
 *
 * There is no new persisted state here. The two halves already exist:
 *
 *   - Per Vault Blob Type, whether its Ciphertext still matches this owner's
 *     Sync Bookmark — the same `hasUnsentChanges` check convergence itself
 *     uses, asked here across every type rather than one.
 *   - What the Vault Sync Queue's last drain found — `VaultSyncQueueStatus`,
 *     which is in-memory for exactly as long as the queue is (one browser
 *     session's Vault Handle), never written to storage.
 *
 * A type stuck on a terminal (422) failure is excluded from "pending": its
 * Ciphertext also fails the bookmark check, since the rejected push never
 * landed, but presenting it as merely "not synced yet" is the one lie this
 * status exists to avoid — see the module doc on `vaultSyncQueue.ts`.
 */
import { VaultBlobType } from '@myorganizer/app-api-client';

import { VAULT_BLOB_FIELDS, VAULT_BLOB_TYPES } from './vaultBlobFields';
import type { VaultHandle } from './vaultHandle';
import type {
  VaultSyncQueueStatus,
  VaultSyncTerminalFailure,
} from './vaultSyncQueue';

/**
 * The three things a User can be told, in the order they take priority when
 * more than one is true at once. A Session ending outranks a terminal
 * failure — signing in again is the only thing that can change either — and
 * a terminal failure outranks merely-pending types, per the acceptance
 * criterion that a terminal failure never reads as "not synced yet".
 */
export type VaultSyncStatusKind =
  | 'synced'
  | 'pending'
  | 'terminal'
  | 'session-ended';

export type VaultSyncStatus = {
  kind: VaultSyncStatusKind;
  /** Vault Blob Types with unsent Ciphertext, excluding terminal failures. */
  pendingTypes: VaultBlobType[];
  /** Vault Blob Types the server refused outright (422). */
  terminalFailures: VaultSyncTerminalFailure[];
  /** Whether an automatic retry is currently waiting on its backoff delay. */
  retrying: boolean;
};

/**
 * Derive the current sync status.
 *
 * `handle` needs only `hasUnsentChanges` — the bookmark comparison, answerable
 * while the Vault is locked since it hashes Ciphertext rather than reading
 * plaintext. `queueStatus` is `VaultSyncQueue.status()`, read fresh by the
 * caller rather than cached here, since a queue notifies on every change that
 * could move this reading (see `VaultSyncQueue.subscribe`).
 */
export async function computeVaultSyncStatus(options: {
  handle: Pick<VaultHandle, 'hasUnsentChanges'>;
  queueStatus: VaultSyncQueueStatus;
}): Promise<VaultSyncStatus> {
  const { handle, queueStatus } = options;
  const terminalTypes = new Set(
    queueStatus.terminalFailures.map((failure) => failure.type),
  );

  const pendingTypes: VaultBlobType[] = [];
  for (const type of VAULT_BLOB_TYPES) {
    if (terminalTypes.has(type)) continue;
    if (await handle.hasUnsentChanges(VAULT_BLOB_FIELDS[type])) {
      pendingTypes.push(type);
    }
  }

  if (queueStatus.sessionEnded) {
    return {
      kind: 'session-ended',
      pendingTypes,
      terminalFailures: queueStatus.terminalFailures,
      retrying: false,
    };
  }

  if (queueStatus.terminalFailures.length > 0) {
    return {
      kind: 'terminal',
      pendingTypes,
      terminalFailures: queueStatus.terminalFailures,
      retrying: false,
    };
  }

  if (pendingTypes.length > 0) {
    return {
      kind: 'pending',
      pendingTypes,
      terminalFailures: [],
      retrying: queueStatus.retryScheduled,
    };
  }

  return {
    kind: 'synced',
    pendingTypes: [],
    terminalFailures: [],
    retrying: false,
  };
}
