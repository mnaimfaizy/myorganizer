import {
  deleteVaultRecord,
  readDeletionLog,
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

/**
 * Saves `records` as the whole records half of `type`, with the stored
 * Deletion Log written back beside them.
 *
 * A page that saves bare records drops the log, and every deletion another
 * device recorded is resurrected by the next merge with a copy that still
 * holds the record
 * ([ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)).
 * Reading both halves and writing both back is what keeps it.
 *
 * Removing a record through here does not delete it. Use
 * `deleteVaultRecordAndSave`, which writes the deletion down.
 */
export async function saveVaultRecords<TRecord extends IdentifiedRecord>(
  store: VaultRecordStore,
  type: EditableVaultRecordType,
  records: readonly TRecord[],
): Promise<void> {
  const deletions = await readStoredDeletionLog(store, type);
  const envelope: VaultBlobEnvelope<readonly TRecord[]> = {
    records,
    deletions,
  };
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
  const deletions = await readStoredDeletionLog(store, type);
  const next = deleteVaultRecord(
    { records: [...records], deletions },
    id,
    deletedAt,
  );
  await store.saveEncryptedData({ type, value: next });
  // `deleteVaultRecord` only filters the array it was given, so every entry
  // left is one of `records`.
  return next.records as TRecord[];
}
