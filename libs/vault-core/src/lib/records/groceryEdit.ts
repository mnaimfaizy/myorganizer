import type { CatalogItem, GroceryList, ListLine } from './grocery';
import type { IsoDateTimeString } from './contactRecords';
import { mergeDeletionLogs, type VaultBlobEnvelope } from './vaultBlobEnvelope';

/**
 * The edits a Grocery List's own management and a grocery trip make, as
 * functions of the Groceries Vault Blob envelope
 * ([ADR 0107](../../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md)
 * decision 2).
 *
 * Groceries is the one Vault Blob Type whose payload is not an array, so
 * `putVaultRecord` and `deleteVaultRecord` refuse it: a record-at-a-time edit
 * of `{ catalog, lists }` would write back an envelope that drops the whole
 * Catalog. These take its place, and every one of them is bounded to either a
 * single Grocery List's `lines` or to the top-level `lists`/`catalog` arrays:
 *
 * - the **Catalog is carried over by reference**, never rebuilt, so an edit to
 *   a trip or to a list cannot lose a Catalog Item — except the one function
 *   here whose whole job is adding to it, `createCatalogItemAndAddLine`,
 *   which still never removes or rewrites an existing entry;
 * - **every other Grocery List is carried over by reference**, so an edit to
 *   one list is not an edit to another;
 * - **unknown keys survive** — on the payload, on a list, and on a line —
 *   because the payload is decrypted JSON written by some build of some
 *   client, and a field this one does not know is still the User's data;
 * - **Uncheck All, Remove Checked From List, and Delete List never destroy a
 *   Catalog Item** — they touch `lists` and its lines only, so a Catalog Item
 *   that every list has dropped still shows up when adding to a list again.
 *
 * Nothing here reads the clock or mints an id: the caller passes the instant
 * and the line or list, so the same edit replays identically on a retry.
 */

function hasId(value: unknown, id: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { id?: unknown }).id === id
  );
}

/** A decrypted entry read as a plain object, or not one at all. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

/**
 * The envelope with the top-level `lists` array replaced by what `editLists`
 * returns — the same no-op-by-reference contract as `overListLines`, one
 * level up: this is for an edit to the list of lists itself, never to one
 * list's lines.
 */
function overLists(
  envelope: VaultBlobEnvelope<unknown>,
  editLists: (lists: readonly unknown[]) => readonly unknown[] | null,
): VaultBlobEnvelope<unknown> {
  const lists = readLists(envelope.records);
  if (lists === null) return envelope;

  const nextLists = editLists(lists);
  if (nextLists === null) return envelope;

  return {
    records: { ...(envelope.records as object), lists: nextLists },
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

/**
 * The envelope with a new Catalog Item appended and a new List Line
 * referencing it appended to one Grocery List, in the one write a mobile
 * push can make.
 *
 * Unlike every other function here, this one does add to the Catalog — that
 * is its whole job, "create a Catalog Item with name and category and add its
 * line" (#914). It still never rewrites or removes an existing Catalog Item,
 * and a `catalog` key that is missing — the very first Catalog Item a Vault
 * ever gets — is treated as empty rather than as a reason to no-op, which is
 * what lets the first Add-to-list Create on an empty Vault succeed.
 */
export function createCatalogItemAndAddLine(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  item: CatalogItem,
  line: ListLine,
): VaultBlobEnvelope<unknown> {
  const records = envelope.records;
  if (!isRecord(records)) return envelope;

  const lists = readLists(records);
  if (lists === null) return envelope;
  const index = lists.findIndex((entry) => hasId(entry, listId));
  if (index === -1) return envelope;

  const list = lists[index] as { lines?: unknown };
  const existingLines = Array.isArray(list.lines) ? list.lines : [];
  const catalog = Array.isArray(records.catalog) ? records.catalog : [];

  return {
    records: {
      ...records,
      catalog: [...catalog, item],
      lists: lists.map((entry, i) =>
        i === index
          ? { ...list, lines: [...existingLines, line], updatedAt: line.updatedAt }
          : entry,
      ),
    },
    deletions: envelope.deletions,
  };
}

/**
 * The envelope with every Checked Item on one Grocery List unchecked —
 * Uncheck All (CONTEXT.md). Lines that were already unchecked are untouched,
 * including their `updatedAt`, and a list with nothing checked is a no-op.
 *
 * It never removes a line: that is what tells it apart from Remove Checked
 * From List, and why the same trip can be reused for another shop after it
 * runs.
 */
export function uncheckAllListLines(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  updatedAt: IsoDateTimeString,
): VaultBlobEnvelope<unknown> {
  return overListLines(envelope, listId, updatedAt, (lines) => {
    let changed = false;
    const next = lines.map((entry) => {
      if (!isRecord(entry) || entry.checked !== true) return entry;
      changed = true;
      return { ...entry, checked: false, updatedAt };
    });
    return changed ? next : null;
  });
}

/**
 * The envelope with every Checked Item dropped from one Grocery List — Remove
 * Checked From List (CONTEXT.md). Each removed line is written into the
 * Deletion Log by its own id, for the same reason `deleteListLine` writes
 * one: a merge unions by id, so a copy that still holds a removed line would
 * bring it straight back.
 *
 * The Catalog Item a removed line pointed at is never touched — the log is
 * keyed by the line's id, not the Catalog Item's — so it stays available to
 * every other Grocery List and to this one the next time it is added to.
 */
export function removeCheckedListLines(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  deletedAt: IsoDateTimeString,
): VaultBlobEnvelope<unknown> {
  const removedIds: string[] = [];

  const removed = overListLines(envelope, listId, deletedAt, (lines) => {
    const next = lines.filter((entry) => {
      if (!isRecord(entry) || entry.checked !== true) return true;
      if (typeof entry.id === 'string') removedIds.push(entry.id);
      return false;
    });
    return next.length === lines.length ? null : next;
  });
  if (removed === envelope) return envelope;

  const deletions = removedIds.reduce(
    (log, id) => mergeDeletionLogs(log, { [id]: deletedAt }),
    removed.deletions,
  );
  return { records: removed.records, deletions };
}

/**
 * The envelope with a new Grocery List appended.
 *
 * A `lists` key that is missing is treated as empty rather than as a reason
 * to no-op — a Vault with no Grocery List yet is having its first one
 * created, not failing to find a list to edit. A `list.id` already present is
 * a no-op rather than a silent replace: a newly minted id cannot collide, so
 * one that does is a retry of an edit already on the server.
 */
export function createGroceryList(
  envelope: VaultBlobEnvelope<unknown>,
  list: GroceryList,
): VaultBlobEnvelope<unknown> {
  const records = envelope.records;
  if (!isRecord(records)) return envelope;

  const lists = readLists(records) ?? [];
  if (lists.some((entry) => hasId(entry, list.id))) return envelope;

  return {
    records: { ...records, lists: [...lists, list] },
    deletions: envelope.deletions,
  };
}

/**
 * The envelope with one Grocery List's `name` changed. Every other field —
 * its lines included — is carried over unchanged, so a rename can never lose
 * what is on the list.
 */
export function renameGroceryList(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  name: string,
  updatedAt: IsoDateTimeString,
): VaultBlobEnvelope<unknown> {
  return overLists(envelope, (lists) => {
    const index = lists.findIndex((entry) => hasId(entry, listId));
    if (index === -1) return null;
    const list = lists[index];
    if (!isRecord(list)) return null;
    return lists.map((entry, i) =>
      i === index ? { ...list, name, updatedAt } : entry,
    );
  });
}

/**
 * The envelope without one Grocery List and every one of its lines.
 *
 * Only the list's own id is written into the Deletion Log — its lines are not
 * separately logged, because there is no path that could revive a line whose
 * list is itself absent from every union-by-id merge. The Catalog Items its
 * lines referenced are never touched: this function reads and writes `lists`
 * only, so every Catalog Item survives a Grocery List's deletion.
 */
export function deleteGroceryList(
  envelope: VaultBlobEnvelope<unknown>,
  listId: string,
  deletedAt: IsoDateTimeString,
): VaultBlobEnvelope<unknown> {
  const removed = overLists(envelope, (lists) => {
    const next = lists.filter((entry) => !hasId(entry, listId));
    return next.length === lists.length ? null : next;
  });
  if (removed === envelope) return envelope;

  return {
    records: removed.records,
    deletions: mergeDeletionLogs(removed.deletions, { [listId]: deletedAt }),
  };
}
