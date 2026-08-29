import { VaultBlobType } from '@myorganizer/app-api-client';
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

/** The blob types above, in a stable iteration order. */
export const VAULT_BLOB_TYPES = Object.keys(
  VAULT_BLOB_FIELDS,
) as VaultBlobType[];

/** Narrows an arbitrary key to a Vault Blob Type using the table above. */
export function isVaultBlobType(key: string): key is VaultBlobType {
  return Object.prototype.hasOwnProperty.call(VAULT_BLOB_FIELDS, key);
}
