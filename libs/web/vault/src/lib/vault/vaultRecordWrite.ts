import {
  deleteVaultRecord,
  mergeDeletionLogs,
  readDeletionLog,
  type DeletionLog,
  type GroceriesVaultPayload,
  type IdentifiedRecord,
  type IsoDateTimeString,
  type VaultBlobEnvelope,
} from '@myorganizer/vault-core';

import type { VaultRecordType } from './localVaultStorage';
import type { VaultHandle } from './vaultHandle';

/**
 * The Local Vault fields a page edits one record at a time.
 *
 * Groceries' `{ catalog, lists }` payload has no top-level records, and
 * `deleteVaultRecord` refuses it for the same reason.
 */
export type EditableVaultRecordType = Exclude<VaultRecordType, 'groceries'>;

/** The two Vault Handle calls a record write needs, and nothing else. */
export type VaultRecordStore = Pick<
  VaultHandle,
  'loadDecryptedData' | 'saveEncryptedData'
>;

/**
 * The Deletion Log currently stored for `type` — empty when nothing is
 * stored, or when what is stored predates the envelope.
 *
 * Read at write time rather than carried in page state, because convergence
 * and the mobile Vault Push both add to the log without passing through the
 * page that is about to save.
 */
async function readStoredDeletionLog(
  store: VaultRecordStore,
  type: EditableVaultRecordType,
) {
  const stored = await store.loadDecryptedData<unknown>({
    type,
    defaultValue: null,
  });
  return readDeletionLog(stored);
}

/** A deletion to write down in the same save. */
export interface VaultRecordDeletion {
  /** The id of the record being deleted. */
  deletedId: string;
  /** When it was deleted. Defaults to now. */
  deletedAt?: IsoDateTimeString;
}

/**
 * Saves `records` as the whole records half of `type`, with the stored
 * Deletion Log written back beside them.
 *
 * A page that saves bare records drops the log, and every deletion another
 * device recorded is resurrected by the next merge with a copy that still
 * holds the record
 * ([ADR 0054](../../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)).
 * Reading both halves and writing both back is what keeps it.
 *
 * Leaving a record out of `records` does not delete it. Pass `deletedId`,
 * and the deletion is written into the log as well: the record is dropped
 * from `records` if it is still there, and recorded as deleted even if it
 * is not.
 */
export async function saveVaultRecords<TRecord extends IdentifiedRecord>(
  store: VaultRecordStore,
  type: EditableVaultRecordType,
  records: readonly TRecord[],
  deletion?: VaultRecordDeletion,
): Promise<void> {
  const deletions = await readStoredDeletionLog(store, type);
  const envelope: VaultBlobEnvelope<unknown> =
    deletion === undefined
      ? { records, deletions }
      : deleteVaultRecord(
          { records: [...records], deletions },
          deletion.deletedId,
          deletion.deletedAt ?? new Date().toISOString(),
        );
  await store.saveEncryptedData({ type, value: envelope });
}

/**
 * Saves `records` without the record `id`, and records its deletion in the
 * Deletion Log at `deletedAt`, keeping every entry the log already holds.
 *
 * Returns the records written, for the caller to show.
 */
export async function deleteVaultRecordAndSave<
  TRecord extends IdentifiedRecord,
>(
  store: VaultRecordStore,
  type: EditableVaultRecordType,
  records: readonly TRecord[],
  id: string,
  deletedAt: IsoDateTimeString,
): Promise<TRecord[]> {
  const remaining = records.filter((record) => record.id !== id);
  await saveVaultRecords(store, type, remaining, { deletedId: id, deletedAt });
  return remaining;
}

/** Ids to record as absent in the same Groceries save. */
export interface GroceriesDeletion {
  /** Catalog Item, Grocery List, or List Line ids. */
  deletedIds: readonly string[];
  /** When they were deleted. Defaults to now. One instant covers the whole set. */
  deletedAt?: IsoDateTimeString;
}

/**
 * Saves a Groceries payload as an envelope, writing the stored Deletion Log
 * back beside it.
 *
 * A bare `{ catalog, lists }` save drops every deletion another device
 * recorded, and the next merge puts those records back
 * ([ADR 0110](../../../../../../docs/adr/0110-groceries-converges-by-nested-record-and-a-destroyed-parent-stays-absent.md)).
 * `deleteVaultRecord` cannot do this: it refuses a non-array payload.
 */
export async function saveGroceriesPayload(
  store: VaultRecordStore,
  payload: GroceriesVaultPayload,
  deletion?: GroceriesDeletion,
): Promise<void> {
  const stored = await store.loadDecryptedData<unknown>({
    type: 'groceries',
    defaultValue: null,
  });
  const additions: DeletionLog = {};
  if (deletion !== undefined) {
    const deletedAt = deletion.deletedAt ?? new Date().toISOString();
    for (const id of deletion.deletedIds) {
      additions[id] = deletedAt;
    }
  }
  const envelope: VaultBlobEnvelope<GroceriesVaultPayload> = {
    records: payload,
    deletions: mergeDeletionLogs(readDeletionLog(stored), additions),
  };
  await store.saveEncryptedData({ type: 'groceries', value: envelope });
}
