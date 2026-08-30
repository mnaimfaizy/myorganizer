import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  mergeAddresses,
  mergeMobileNumbers,
  mergeSubscriptions,
  mergeTasks,
  type VaultBlobEnvelope,
} from '@myorganizer/core';
import type {
  VaultExportBlobType,
  VaultRecordType as CoreVaultRecordType,
} from '@myorganizer/vault-core';

import { VaultRecordType } from './localVaultStorage';

/**
 * Every Vault Blob Type, and the Local Vault field each one lands in.
 *
 * The `satisfies` clause is the guard, not decoration: a seventh member added
 * to `VaultBlobType` fails to compile here until it is given a home. Every
 * code path that fans out over the blob types — reconcile, export, import —
 * iterates this one table, so a type cannot be present in some branches and
 * missing from others.
 *
 * Two omissions are the reason this table is shared rather than local to one
 * module. Groceries was missing from all four directions of the reconcile
 * while the Local Vault carried it, and a keep-server decision destroyed it
 * ([#512](https://github.com/mnaimfaizy/myorganizer/issues/512)). Tasks was
 * then found missing from the hardened export path, which had been built by
 * hand-enumerating five of the six members
 * ([#537](https://github.com/mnaimfaizy/myorganizer/issues/537)).
 *
 * The rest of the `satisfies` clause holds four hand-maintained lists of the
 * same six strings equal, which nothing else compares:
 *
 *   - `VaultBlobType` — generated from the API contract.
 *   - `VaultRecordType` — the Local Vault's own field-name union.
 *   - `VaultExportBlobType` — the export envelope's union in `vault-core`.
 *   - `CoreVaultRecordType` — `vault-core`'s separate copy of the field names,
 *     which listed five and omitted `todos` until #537 found it.
 *
 * A member added to one and not the others compiles everywhere else and
 * surfaces only as a blob that cannot be exported, or one the envelope schema
 * rejects. Here it fails to compile.
 *
 * `yarn enum:fanout:check` fails a source file that names two or more
 * `VaultBlobType` members without reaching this table — see
 * [ADR 0053](../../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md).
 */
export const VAULT_BLOB_FIELDS = {
  [VaultBlobType.Addresses]: 'addresses',
  [VaultBlobType.Groceries]: 'groceries',
  [VaultBlobType.MobileNumbers]: 'mobileNumbers',
  [VaultBlobType.Subscriptions]: 'subscriptions',
  [VaultBlobType.Tasks]: 'tasks',
  [VaultBlobType.Todos]: 'todos',
} as const satisfies Record<VaultBlobType, VaultRecordType> &
  Record<VaultExportBlobType, VaultRecordType> &
  Record<VaultBlobType, CoreVaultRecordType>;

/**
 * The Local Vault fields some Vault Blob Type actually maps onto — read off
 * the pin rather than listed, so it shrinks the moment the pin does.
 */
type MappedVaultRecordType = (typeof VAULT_BLOB_FIELDS)[VaultBlobType];

/**
 * The Vault Blob Type each Local Vault field carries, derived by inverting the
 * table above rather than written out a second time.
 *
 * A Local Vault write names a field; convergence names a Vault Blob Type. The
 * Vault Handle's sync sink is handed the first and has to report the second,
 * and inverting the pin is how it does that. A hand-written second table would
 * be exactly the shape ADR 0053 forbids: a seventh member could be present in
 * one direction and missing from the other, and the missing direction is the
 * one that silently stops synchronising.
 *
 * Typed by the fields the pin covers, not by every `VaultRecordType`, and that
 * is the guard. `Object.fromEntries` cannot promise totality, so claiming
 * `Record<VaultRecordType, …>` here would be an assertion the compiler never
 * checks — and an uncovered field would reach the sink as `type: undefined`,
 * which is a Vault Blob Type that silently never synchronises. Declared this
 * way, a field no Vault Blob Type maps onto — a seventh field, or two blob
 * types collapsed onto one field — instead fails to compile at the call site
 * that indexes this table with a `VaultRecordType`.
 */
export const VAULT_BLOB_TYPE_BY_FIELD = Object.fromEntries(
  Object.entries(VAULT_BLOB_FIELDS).map(([type, field]) => [field, type]),
) as Record<MappedVaultRecordType, VaultBlobType>;

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
 * How one Vault Blob Type converges when this device and the server have both
 * changed it, per [ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md).
 *
 * `promptOnConflict` is a permanent strategy, not a stopgap and not a
 * deprecation notice. Groceries is a nested payload of catalog, lists and
 * lines whose bulk mutations — Uncheck All, Remove Checked From List — merge
 * badly under a union by id, and todos is a legacy read source nothing
 * writes. Neither is waiting for a record-level merge to be written.
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
 * Every Vault Blob Type, and how it converges. The second pinned table, kept
 * beside the first for the same reason the first exists.
 *
 * The `satisfies` clause is the guard: a seventh Vault Blob Type fails to
 * compile here until somebody decides how it converges. It cannot inherit a
 * strategy from whichever arm an `else` happened to be — the shape that
 * destroyed grocery Ciphertext in
 * [#512](https://github.com/mnaimfaizy/myorganizer/issues/512) and dropped the
 * Tasks blob from hardened export in
 * [#537](https://github.com/mnaimfaizy/myorganizer/issues/537).
 *
 * The table says which strategy, never when to apply it. Deciding that — and
 * carrying it out — happens in exactly one place, `convergeVaultBlob`.
 */
export const VAULT_BLOB_CONVERGE_STRATEGIES = {
  [VaultBlobType.Addresses]: {
    strategy: 'mergeById',
    merge: overRecords(mergeAddresses),
  },
  [VaultBlobType.Groceries]: { strategy: 'promptOnConflict' },
  [VaultBlobType.MobileNumbers]: {
    strategy: 'mergeById',
    merge: overRecords(mergeMobileNumbers),
  },
  [VaultBlobType.Subscriptions]: {
    strategy: 'mergeById',
    merge: overRecords(mergeSubscriptions),
  },
  [VaultBlobType.Tasks]: {
    strategy: 'mergeById',
    merge: overRecords(mergeTasks),
  },
  [VaultBlobType.Todos]: { strategy: 'promptOnConflict' },
} as const satisfies Record<VaultBlobType, VaultBlobConvergeStrategy>;

/** The blob types above, in a stable iteration order. */
export const VAULT_BLOB_TYPES = Object.keys(
  VAULT_BLOB_FIELDS,
) as VaultBlobType[];

/** Narrows an arbitrary key to a Vault Blob Type using the table above. */
export function isVaultBlobType(key: string): key is VaultBlobType {
  return Object.prototype.hasOwnProperty.call(VAULT_BLOB_FIELDS, key);
}
