/**
 * Sync status — telling a User "saved here" from "saved everywhere", derived
 * rather than tracked. See PRD #544's status table and #553's acceptance
 * criteria.
 *
 * There is no new persisted state for most of this. Two halves already exist:
 *
 *   - Per Vault Blob Type, whether its Ciphertext still matches this owner's
 *     Sync Bookmark — the same `hasUnsentChanges` check convergence itself
 *     uses, asked here across every type rather than one.
 *   - What the Vault Sync Queue's last drain found — `VaultSyncQueueStatus`,
 *     which is in-memory for exactly as long as the queue is (one browser
 *     session's Vault Handle), never written to storage.
 *
 * A third is the one piece of state PRD #650 (ADR 0067) adds: the Observed
 * Vault Identity `convergeVaultBlob` records per User whenever a pass
 * observes the server's Vault Meta. A standoff — the server holding a
 * different Vault than this device's own — is derived by comparing that
 * observation against this device's own Vault Identity, read from the Local
 * Vault it already holds. Both reads work while the Vault is locked, since a
 * Vault Identity is answerable without unlocking anything.
 *
 * A type stuck on a terminal (422) failure is excluded from "pending": its
 * Ciphertext also fails the bookmark check, since the rejected push never
 * landed, but presenting it as merely "not synced yet" is the one lie this
 * status exists to avoid — see the module doc on `vaultSyncQueue.ts`.
 */
import { VaultBlobType } from '@myorganizer/app-api-client';

import { VAULT_BLOB_FIELDS, VAULT_BLOB_TYPES } from './vaultBlobFields';
import type { VaultHandle } from './vaultHandle';
import { vaultIdentityOf } from './vaultMetaConverge';
import { localToServerMeta } from './vaultShapes';
import type {
  VaultSyncQueueStatus,
  VaultSyncTerminalFailure,
} from './vaultSyncQueue';

/**
 * The five things a User can be told, in the order they take priority when
 * more than one is true at once — the only enumeration of the members, so a
 * sixth kind fails to compile at {@link VAULT_SYNC_STATUS_RULES} until it says
 * what is reported for it ([ADR 0053](../../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
 *
 * A Session ending and a standoff both outrank a terminal failure: neither is
 * something a retry can fix, where a terminal failure at least names Ciphertext
 * the server looked at and refused. Between the two, a Session ending is
 * checked first because it silences the standoff too — a device that cannot
 * reach the server as this User is not going to observe a Vault Identity
 * either way. A terminal failure still outranks merely-pending types, per the
 * acceptance criterion that a terminal failure never reads as "not synced
 * yet".
 */
export const VAULT_SYNC_STATUS_KINDS = [
  'session-ended',
  'standoff',
  'terminal',
  'pending',
  'synced',
] as const;

export type VaultSyncStatusKind = (typeof VAULT_SYNC_STATUS_KINDS)[number];

export type VaultSyncStatus = {
  kind: VaultSyncStatusKind;
  /** Vault Blob Types with unsent Ciphertext, excluding terminal failures. */
  pendingTypes: VaultBlobType[];
  /** Vault Blob Types the server refused outright (422). */
  terminalFailures: VaultSyncTerminalFailure[];
  /** Whether an automatic retry is currently waiting on its backoff delay. */
  retrying: boolean;
};

/** Everything a status reading is decided from, gathered once per call. */
type VaultSyncStatusEvidence = {
  sessionEnded: boolean;
  standoff: boolean;
  terminalFailures: VaultSyncTerminalFailure[];
  pendingTypes: VaultBlobType[];
  retryScheduled: boolean;
};

/**
 * Whether this device's own Vault Identity differs from the one a pass last
 * observed on the server for this owner.
 *
 * `false` whenever either side is unknown: no Local Vault means there is no
 * "this device's own" identity to compare, and no Observed Vault Identity
 * means no pass has ever recorded one. Both read as no standoff rather than
 * an unanswerable one — under-reporting until the next pass observes
 * something, never a refusal (ADR 0067, decision point 7).
 */
function isVaultSyncStandoff(
  handle: Pick<VaultHandle, 'loadVault' | 'observedVaultIdentity'>,
): boolean {
  const vault = handle.loadVault();
  if (!vault) return false;

  const observed = handle.observedVaultIdentity();
  if (observed === undefined) return false;

  return observed !== vaultIdentityOf(localToServerMeta(vault));
}

/**
 * What each Vault Sync Status Kind means: whether it applies given the
 * evidence, and the reading to report when it does. Iterated in
 * {@link VAULT_SYNC_STATUS_KINDS} order, first match wins — the same shape
 * `describeVaultMetaDivergence` reads `VAULT_META_CHANGES` through.
 */
const VAULT_SYNC_STATUS_RULES = {
  'session-ended': {
    applies: (evidence) => evidence.sessionEnded,
    build: (evidence) => ({
      kind: 'session-ended',
      pendingTypes: evidence.pendingTypes,
      terminalFailures: evidence.terminalFailures,
      retrying: false,
    }),
  },
  standoff: {
    applies: (evidence) => evidence.standoff,
    build: (evidence) => ({
      kind: 'standoff',
      pendingTypes: evidence.pendingTypes,
      terminalFailures: evidence.terminalFailures,
      retrying: false,
    }),
  },
  terminal: {
    applies: (evidence) => evidence.terminalFailures.length > 0,
    build: (evidence) => ({
      kind: 'terminal',
      pendingTypes: evidence.pendingTypes,
      terminalFailures: evidence.terminalFailures,
      retrying: false,
    }),
  },
  pending: {
    applies: (evidence) => evidence.pendingTypes.length > 0,
    build: (evidence) => ({
      kind: 'pending',
      pendingTypes: evidence.pendingTypes,
      terminalFailures: [],
      retrying: evidence.retryScheduled,
    }),
  },
  synced: {
    applies: () => true,
    build: () => ({
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    }),
  },
} as const satisfies Record<
  VaultSyncStatusKind,
  {
    applies: (evidence: VaultSyncStatusEvidence) => boolean;
    build: (evidence: VaultSyncStatusEvidence) => VaultSyncStatus;
  }
>;

/**
 * Derive the current sync status.
 *
 * `handle` needs the bookmark comparison (`hasUnsentChanges`), the Local
 * Vault (`loadVault`) and the Observed Vault Identity (`observedVaultIdentity`)
 * — all three answerable while the Vault is locked, since none needs the
 * Master Key. `queueStatus` is `VaultSyncQueue.status()`, read fresh by the
 * caller rather than cached here, since a queue notifies on every change that
 * could move this reading (see `VaultSyncQueue.subscribe`).
 */
export async function computeVaultSyncStatus(options: {
  handle: Pick<
    VaultHandle,
    'hasUnsentChanges' | 'loadVault' | 'observedVaultIdentity'
  >;
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

  const evidence: VaultSyncStatusEvidence = {
    sessionEnded: queueStatus.sessionEnded,
    standoff: isVaultSyncStandoff(handle),
    terminalFailures: queueStatus.terminalFailures,
    pendingTypes,
    retryScheduled: queueStatus.retryScheduled,
  };

  for (const kind of VAULT_SYNC_STATUS_KINDS) {
    const rule = VAULT_SYNC_STATUS_RULES[kind];
    if (rule.applies(evidence)) return rule.build(evidence);
  }

  // Unreachable: `synced`'s rule always applies.
  throw new Error('No Vault Sync Status rule matched');
}
