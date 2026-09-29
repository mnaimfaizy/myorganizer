import type { IsoDateTimeString } from './contactRecords';
import type { ListLine } from './grocery';
import { mergeDeletionLogs, type VaultBlobEnvelope } from './vaultBlobEnvelope';

/**
 * The four edits a grocery trip makes, as functions of the Groceries Vault
 * Blob envelope ([ADR 0107](../../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md)
 * decision 2).
 *
 * Groceries is the one Vault Blob Type whose payload is not an array, so
 * `putVaultRecord` and `deleteVaultRecord` refuse it: a record-at-a-time edit
 * of `{ catalog, lists }` would write back an envelope that drops the whole
 * Catalog. These take its place, and every one of them is bounded to a single
 * Grocery List's `lines`:
 *
 * - the **Catalog is carried over by reference**, never rebuilt, so an edit to
 *   a trip cannot lose a Catalog Item;
 * - **every other Grocery List is carried over by reference**, so an edit to
 *   one list is not an edit to another;
 * - **unknown keys survive** — on the payload, on a list, and on a line —
 *   because the payload is decrypted JSON written by some build of some
 *   client, and a field this one does not know is still the User's data.
 *
 * Nothing here reads the clock or mints an id: the caller passes the instant
 * and the line, so the same edit replays identically on a retry.
 */

function hasId(value: unknown, id: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { id?: unknown }).id === id
  );
}

/** A decrypted payload's `lists`, or `null` when it does not carry one. */
function readLists(records: unknown): unknown[] | null {
  if (typeof records !== 'object' || records === null || Array.isArray(records))
    return null;
  const { lists } = records as { lists?: unknown };
  return Array.isArray(lists) ? lists : null;
}

/**
 * The envelope with one Grocery List's lines replaced by what `editLines`
 * returns, and that list's `updatedAt` advanced.
 *
 * `editLines` returning `null` means it found nothing to do, and the envelope
 * is handed back exactly as it came in — identical by reference, so a caller
 * can tell a no-op from an edit.
 *
 * Every path out of here that is not that one rebuilds exactly two objects:
 * the payload and the one list. The Catalog, the other lists, and the lines
 * this edit did not touch are the same objects they were.
 */
function overListLines(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  updatedAt: IsoDateTimeString,
  editLines: (lines: readonly unknown[]) => readonly unknown[] | null,
): VaultBlobEnvelope<unknown> {
  const lists = readLists(envelope.records);
  if (lists === null) return envelope;

  const index = lists.findIndex((entry) => hasId(entry, listId));
  if (index === -1) return envelope;

  const list = lists[index] as { lines?: unknown };
  const nextLines = editLines(Array.isArray(list.lines) ? list.lines : []);
  if (nextLines === null) return envelope;

  return {
    records: {
      ...(envelope.records as object),
      lists: lists.map((entry, i) =>
        i === index ? { ...list, lines: nextLines, updatedAt } : entry,
      ),
    },
    deletions: envelope.deletions,
  };
}

/** One line of a list, with `changes` applied over whatever else it carries. */
function withLine(
  lines: readonly unknown[],
  lineId: string,
  change: (line: Record<string, unknown>) => Record<string, unknown>,
): readonly unknown[] | null {
  const index = lines.findIndex((entry) => hasId(entry, lineId));
  if (index === -1) return null;
  const line = lines[index] as Record<string, unknown>;
  return lines.map((entry, i) => (i === index ? change(line) : entry));
}

/**
 * The envelope with one List Line checked or unchecked.
 *
 * Trip-local state: the Catalog Item the line points at is untouched, so
 * ticking milk off this trip says nothing about any other Grocery List that
 * also carries it.
 */
export function setListLineChecked(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  lineId: string,
  checked: boolean,
  updatedAt: IsoDateTimeString,
): VaultBlobEnvelope<unknown> {
  return overListLines(envelope, listId, updatedAt, (lines) =>
    withLine(lines, lineId, (line) => ({ ...line, checked, updatedAt })),
  );
}

/**
 * The envelope with one List Line's amount set, or cleared.
 *
 * An empty or blank amount removes the key rather than storing `''`: `amount`
 * is optional, and a blank string is a value that renders as an amount of
 * nothing where absence renders as no amount at all.
 */
export function setListLineAmount(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  lineId: string,
  amount: string | undefined,
  updatedAt: IsoDateTimeString,
): VaultBlobEnvelope<unknown> {
  const trimmed = amount?.trim() ?? '';

  return overListLines(envelope, listId, updatedAt, (lines) =>
    withLine(lines, lineId, (line) => {
      const next: Record<string, unknown> = { ...line, updatedAt };
      if (trimmed.length > 0) next.amount = trimmed;
      else delete next.amount;
      return next;
    }),
  );
}

/**
 * The envelope without one List Line — Delete List Line (CONTEXT.md).
 *
 * The line is removed **and** written into the Deletion Log, because removing
 * it alone would not delete it: a merge unions by id, so any copy that still
 * holds the line would bring it straight back
 * ([ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)).
 * The log is keyed by the line's own id, so the Catalog Item it referenced is
 * not buried with it and stays available to every other Grocery List.
 */
export function deleteListLine(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  lineId: string,
  deletedAt: IsoDateTimeString,
): VaultBlobEnvelope<unknown> {
  const removed = overListLines(envelope, listId, deletedAt, (lines) => {
    const next = lines.filter((entry) => !hasId(entry, lineId));
    return next.length === lines.length ? null : next;
  });
  if (removed === envelope) return envelope;

  return {
    records: removed.records,
    deletions: mergeDeletionLogs(removed.deletions, { [lineId]: deletedAt }),
  };
}

/**
 * The envelope with `line` on one Grocery List: replacing the line carrying
 * its id, or appended when none does.
 *
 * This is how an Undo of Delete List Line puts the line back, and it puts back
 * a **new** line rather than the one that was deleted. The deleted line's id
 * is in the Deletion Log for good — an entry dropped while some device is
 * still behind resurrects the record it was there to bury — so re-adding
 * under the old id would be re-adding something a merge is obliged to remove
 * again. A fresh id is in no Deletion Log and survives.
 */
export function putListLine(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  line: ListLine,
): VaultBlobEnvelope<unknown> {
  return overListLines(envelope, listId, line.updatedAt, (lines) =>
    lines.some((entry) => hasId(entry, line.id))
      ? lines.map((entry) => (hasId(entry, line.id) ? line : entry))
      : [...lines, line],
  );
}
