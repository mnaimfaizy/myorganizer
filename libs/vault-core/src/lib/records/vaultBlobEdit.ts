import type { IsoDateTimeString } from './contactRecords';
import type { IdentifiedRecord } from './mergeVaultRecords';
import { mergeDeletionLogs, type VaultBlobEnvelope } from './vaultBlobEnvelope';

/**
 * The records array of an envelope about to be edited.
 *
 * Only the four array-shaped Vault Blob Types can be edited a record at a
 * time. Groceries' `{ catalog, lists }` payload has no top-level records to
 * put or delete, and treating it as an empty array would write back an
 * envelope that drops the whole grocery catalog — so it throws instead.
 */
function editableRecords(envelope: VaultBlobEnvelope<unknown>): unknown[] {
  if (!Array.isArray(envelope.records)) {
    throw new TypeError(
      'Only an array-shaped Vault Blob can be edited one record at a time',
    );
  }
  return envelope.records;
}

function hasId(value: unknown, id: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { id?: unknown }).id === id
  );
}

/**
 * The envelope with `record` in it: replacing the entry that carries its `id`
 * in place, or added first when none does.
 *
 * Every other entry is kept exactly as it was read, including entries this
 * caller cannot parse — an edit to one record is not licence to drop another.
 * The Deletion Log is carried over untouched.
 *
 * The caller stamps `updatedAt` on `record`. A merge decides a collision by
 * it, and an edit that does not advance it loses to the other copy.
 */
export function putVaultRecord<TRecord extends IdentifiedRecord>(
  envelope: VaultBlobEnvelope<unknown>,
  record: TRecord,
): VaultBlobEnvelope<unknown> {
  const records = editableRecords(envelope);
  const index = records.findIndex((entry) => hasId(entry, record.id));

  const next =
    index === -1
      ? [record, ...records]
      : records.map((entry, i) => (i === index ? record : entry));

  return { records: next, deletions: envelope.deletions };
}

/**
 * The envelope without the record `id`, and with its deletion written into
 * the Deletion Log at `deletedAt`.
 *
 * Removing the record alone would not delete it: a merge unions by `id`, so
 * the record would come straight back from any copy that still has it
 * ([ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)).
 * An existing entry for the same id keeps the newer instant, and nothing is
 * dropped from the log.
 */
export function deleteVaultRecord(
  envelope: VaultBlobEnvelope<unknown>,
  id: string,
  deletedAt: IsoDateTimeString,
): VaultBlobEnvelope<unknown> {
  const records = editableRecords(envelope).filter(
    (entry) => !hasId(entry, id),
  );

  return {
    records,
    deletions: mergeDeletionLogs(envelope.deletions, { [id]: deletedAt }),
  };
}
