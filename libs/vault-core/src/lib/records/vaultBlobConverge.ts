import type { VaultRecordType } from '../types';

import { mergeAddresses, mergeMobileNumbers } from './contactRecordMerge';
import { mergeSubscriptions } from './subscriptionRecordMerge';
import { mergeTasks } from './taskMerge';
import {
  readDeletionLog,
  readVaultBlobRecords,
  type VaultBlobEnvelope,
} from './vaultBlobEnvelope';

/**
 * A merge of two copies of one Vault Blob's decrypted payload.
 *
 * Both sides arrive as `VaultBlobEnvelope<unknown>` because that is what a
 * decrypted payload is: JSON whose shape is a claim rather than a fact. Each
 * record type's own merge function narrows it — see `overRecords` below.
 */
export type VaultBlobMerge = (
  local: VaultBlobEnvelope<unknown>,
  remote: VaultBlobEnvelope<unknown>,
) => VaultBlobEnvelope<unknown>;

/**
 * How one Vault Blob Type converges when two writers have both changed it,
 * per [ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md).
 *
 * `promptOnConflict` is a permanent strategy, not a stopgap and not a
 * deprecation notice. Groceries is a nested payload of catalog, lists and
 * lines whose bulk mutations — Uncheck All, Remove Checked From List — merge
 * badly under a union by id. It is not waiting for a record-level merge
 * to be written.
 */
export type VaultBlobConvergeStrategy =
  | {
      /**
       * Converge by record: union by `id`, the newer `updatedAt` wins a
       * collision, and a deletion buries a record that has not changed since.
       */
      readonly strategy: 'mergeById';
      readonly merge: VaultBlobMerge;
    }
  | {
      /** Ask the User which side to keep. Nothing is merged and nothing is guessed. */
      readonly strategy: 'promptOnConflict';
    };

/**
 * Reads a typed record merge as a merge over decrypted JSON.
 *
 * The cast is what the merge already assumes. `mergeRecordsById` reads each
 * side's `records` as `unknown`, keeps the entries carrying a usable `id`, and
 * drops the rest — so handing it a payload that does not match `TRecord[]`
 * cannot make it read a field that is not there. Declaring the parameter as
 * `TRecord[]` and casting here keeps that one unavoidable lie in a single
 * place instead of in each of the four entries below.
 */
function overRecords<TRecord>(
  merge: (
    local: VaultBlobEnvelope<TRecord[]>,
    remote: VaultBlobEnvelope<TRecord[]>,
  ) => VaultBlobEnvelope<TRecord[]>,
): VaultBlobMerge {
  return (local, remote) =>
    merge(
      local as VaultBlobEnvelope<TRecord[]>,
      remote as VaultBlobEnvelope<TRecord[]>,
    );
}

/**
 * Every Vault Blob Type, and how it converges — the one pin both the web
 * converge and the mobile Vault Push read
 * ([ADR 0107](../../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md)).
 *
 * Keyed by `vault-core`'s own name union because this library cannot import
 * the generated `VaultBlobType` (wrong dependency direction). The strings are
 * the same five; the web pin in `libs/web/vault` re-asserts this table
 * against `Record<VaultBlobType, …>`, so a member added to one union and not
 * the other fails to compile there.
 *
 * The `satisfies` clause is the guard: a sixth type fails to compile here
 * until somebody decides how it converges. It cannot inherit a strategy from
 * whichever arm an `else` happened to be — the shape that destroyed grocery
 * Ciphertext in [#512](https://github.com/mnaimfaizy/myorganizer/issues/512).
 *
 * The table says which strategy, never when to apply it. Each runtime decides
 * that in exactly one place: `convergeVaultBlob` on web, `pushVaultBlob` on
 * mobile.
 */
export const VAULT_BLOB_CONVERGE_STRATEGIES = {
  addresses: { strategy: 'mergeById', merge: overRecords(mergeAddresses) },
  groceries: { strategy: 'promptOnConflict' },
  mobileNumbers: {
    strategy: 'mergeById',
    merge: overRecords(mergeMobileNumbers),
  },
  subscriptions: {
    strategy: 'mergeById',
    merge: overRecords(mergeSubscriptions),
  },
  tasks: { strategy: 'mergeById', merge: overRecords(mergeTasks) },
} as const satisfies Record<VaultRecordType, VaultBlobConvergeStrategy>;

/**
 * Both halves of a decrypted payload, whichever shape it was written in.
 *
 * A payload written before ADR 0054 is bare records and reads as an envelope
 * with an empty Deletion Log.
 */
export function toVaultBlobEnvelope(
  payload: unknown,
): VaultBlobEnvelope<unknown> {
  return {
    records: readVaultBlobRecords(payload),
    deletions: readDeletionLog(payload),
  };
}
