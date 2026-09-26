import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  VAULT_BLOB_CONVERGE_STRATEGIES as CORE_VAULT_BLOB_CONVERGE_STRATEGIES,
  type VaultBlobConvergeStrategy,
  type VaultExportBlobType,
  type VaultRecordType as CoreVaultRecordType,
} from '@myorganizer/vault-core';

import { VaultRecordType } from './localVaultStorage';

export type {
  VaultBlobConvergeStrategy,
  VaultBlobMerge,
} from '@myorganizer/vault-core';

/**
 * Every Vault Blob Type, and the Local Vault field each one lands in.
 *
 * The `satisfies` clause is the guard, not decoration: a sixth member added
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
 * hand-enumerating five of the then-six members
 * ([#537](https://github.com/mnaimfaizy/myorganizer/issues/537)). `'todos'`
 * was retired in #841 once ADR 0003's exit query was zero.
 *
 * The rest of the `satisfies` clause holds four hand-maintained lists of the
 * same five strings equal, which nothing else compares:
 *
 *   - `VaultBlobType` — generated from the API contract.
 *   - `VaultRecordType` — the Local Vault's own field-name union.
 *   - `VaultExportBlobType` — the export envelope's union in `vault-core`.
 *   - `CoreVaultRecordType` — `vault-core`'s separate copy of the field names,
 *     which listed five and omitted a member until #537 found it.
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
 * be exactly the shape ADR 0053 forbids: a sixth member could be present in
 * one direction and missing from the other, and the missing direction is the
 * one that silently stops synchronising.
 *
 * Typed by the fields the pin covers, not by every `VaultRecordType`, and that
 * is the guard. `Object.fromEntries` cannot promise totality, so claiming
 * `Record<VaultRecordType, …>` here would be an assertion the compiler never
 * checks — and an uncovered field would reach the sink as `type: undefined`,
 * which is a Vault Blob Type that silently never synchronises. Declared this
 * way, a field no Vault Blob Type maps onto — a sixth field, or two blob
 * types collapsed onto one field — instead fails to compile at the call site
 * that indexes this table with a `VaultRecordType`.
 */
export const VAULT_BLOB_TYPE_BY_FIELD = Object.fromEntries(
  Object.entries(VAULT_BLOB_FIELDS).map(([type, field]) => [field, type]),
) as Record<MappedVaultRecordType, VaultBlobType>;

/**
 * Every Vault Blob Type, and how it converges. The second pinned table, kept
 * beside the first for the same reason the first exists.
 *
 * The table itself lives in `vault-core` so the mobile Vault Push reads the
 * same pin ([ADR 0107](../../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md)).
 * `vault-core` cannot name the generated `VaultBlobType`, so it is keyed by
 * its own copy of the five strings; the `satisfies` clause here ties that
 * copy back to the API contract. A sixth Vault Blob Type fails to compile
 * here until the shared table decides how it converges — it cannot inherit a
 * strategy from whichever arm an `else` happened to be, the shape that
 * destroyed grocery Ciphertext in
 * [#512](https://github.com/mnaimfaizy/myorganizer/issues/512) and dropped the
 * Tasks blob from hardened export in
 * [#537](https://github.com/mnaimfaizy/myorganizer/issues/537).
 *
 * The table says which strategy, never when to apply it. Deciding that — and
 * carrying it out — happens in exactly one place on web, `convergeVaultBlob`.
 */
export const VAULT_BLOB_CONVERGE_STRATEGIES =
  CORE_VAULT_BLOB_CONVERGE_STRATEGIES satisfies Record<
    VaultBlobType,
    VaultBlobConvergeStrategy
  >;

/** The blob types above, in a stable iteration order. */
export const VAULT_BLOB_TYPES = Object.keys(
  VAULT_BLOB_FIELDS,
) as VaultBlobType[];

/** Narrows an arbitrary key to a Vault Blob Type using the table above. */
export function isVaultBlobType(key: string): key is VaultBlobType {
  return Object.prototype.hasOwnProperty.call(VAULT_BLOB_FIELDS, key);
}
