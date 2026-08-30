import type { IsoDateTimeString } from './contactRecords';

/**
 * A Vault Blob's record of which of its records were deleted, and when.
 *
 * Keys are record ids; values are the ISO 8601 instant the deletion happened.
 * Absence cannot be merged — a union by `id` reinstates every deleted record —
 * so the deletion is written down rather than inferred from what is missing.
 * See [ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md).
 */
export type DeletionLog = Record<string, IsoDateTimeString>;

/**
 * The Vault Blob payload shape: the records of one Vault Blob Type, plus the
 * Deletion Log that says which ids are gone.
 *
 * `TRecords` is whatever that blob type already stored — an array for tasks,
 * addresses, mobile numbers and subscriptions; the nested `{ catalog, lists }`
 * payload for groceries.
 */
export interface VaultBlobEnvelope<TRecords> {
  records: TRecords;
  deletions: DeletionLog;
}

/**
 * True when a decrypted payload is an envelope rather than the bare records
 * every blob written before ADR 0054 holds.
 *
 * The `records` key is the discriminator. A bare array cannot carry it, and
 * the one non-array payload — groceries' `{ catalog, lists }` — does not use
 * the name either.
 */
export function isVaultBlobEnvelope(
  value: unknown,
): value is VaultBlobEnvelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'records' in value
  );
}

/**
 * The records half of a decrypted payload, whichever shape it was written in.
 *
 * A bare payload is returned untouched, so a normalizer can call this first
 * and keep every branch it already had.
 *
 * This half alone is not the whole payload. A caller that reads through here
 * and writes back what it got drops the Deletion Log, which is why the writers
 * that follow this slice have to read both halves and put both back — see
 * `readDeletionLog`.
 */
export function readVaultBlobRecords(payload: unknown): unknown {
  return isVaultBlobEnvelope(payload) ? payload.records : payload;
}

/**
 * The Deletion Log of a decrypted payload — empty for a payload written
 * before the envelope existed.
 */
export function readDeletionLog(payload: unknown): DeletionLog {
  if (!isVaultBlobEnvelope(payload)) return {};
  return sanitizeDeletionLog((payload as { deletions?: unknown }).deletions);
}

/**
 * The entries of a Deletion Log that can actually be compared against a
 * record.
 *
 * A log arrives as decrypted JSON, so its type is a claim rather than a fact.
 * An entry whose id or instant is unusable — `{ "a": null }`, a blank id, a
 * timestamp that does not parse — is dropped rather than kept, because an
 * unparseable instant compares as older than everything and would bury a
 * record nobody deleted.
 */
function sanitizeDeletionLog(raw: unknown): DeletionLog {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};

  const log: DeletionLog = {};
  for (const [id, deletedAt] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!id.trim()) continue;
    if (typeof deletedAt !== 'string') continue;
    if (Number.isNaN(Date.parse(deletedAt))) continue;
    log[id] = deletedAt;
  }

  return log;
}

/**
 * Both Deletion Logs, with the newer instant kept for an id in both.
 *
 * Both sides are sanitized on the way in, for the same reason `readDeletionLog`
 * sanitizes: a merge is fed decrypted JSON, so an entry the type system
 * believes is a string may not be one.
 *
 * Nothing usable is dropped. An entry removed while some device is still
 * behind resurrects the record it was there to bury, so the log only ever
 * grows (ADR 0054).
 */
export function mergeDeletionLogs(
  local: DeletionLog,
  remote: DeletionLog,
): DeletionLog {
  const merged: DeletionLog = sanitizeDeletionLog(local);

  for (const [id, deletedAt] of Object.entries(sanitizeDeletionLog(remote))) {
    const existing = merged[id];
    if (existing === undefined || toEpoch(deletedAt) > toEpoch(existing)) {
      merged[id] = deletedAt;
    }
  }

  return merged;
}

/**
 * An ISO 8601 instant as epoch milliseconds, or `-Infinity` when there is no
 * usable instant.
 *
 * Missing beats nothing: a record with no timestamp loses every comparison,
 * including the one against a deletion.
 */
export function toEpoch(value: string | undefined | null): number {
  if (typeof value !== 'string') return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}
