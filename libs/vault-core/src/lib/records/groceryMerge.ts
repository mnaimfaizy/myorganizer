import {
  GROCERIES_PAYLOAD_KEYS,
  type CatalogItem,
  type GroceryList,
  type GroceriesVaultPayload,
  type ListLine,
} from './grocery';
import { mergeRecordsById } from './mergeVaultRecords';
import { mergeUnknownFields } from './unknownFields';
import {
  mergeDeletionLogs,
  mergeEnvelopeExtras,
  toEpoch,
  type DeletionLog,
  type VaultBlobEnvelope,
} from './vaultBlobEnvelope';

/**
 * Converges two copies of the `groceries` Vault Blob.
 *
 * A Catalog Item, a Grocery List, and a List Line each merge on their own:
 * union by `id`, the newer `updatedAt` wins the whole record, and a tie keeps
 * the local record. Delete Grocery List and Delete From Catalog are exceptions
 * to the usual Deletion Log rule — a later edit does not restore them, and
 * the absence covers the List Lines that belonged to them
 * ([ADR 0113](../../../../../docs/adr/0113-groceries-converges-by-nested-record-and-a-destroyed-parent-stays-absent.md)).
 * Delete List Line is not an exception: a line changed after its deletion
 * survives.
 *
 * Unknown fields survive (ADR 0114 decision 3): a winning Catalog Item, List
 * Line or Grocery List keeps its own, and unknown keys on the payload and on
 * the envelope are unioned, `local` winning a key both carry.
 *
 * Pure: it reads the two envelopes it is given and nothing else.
 */
export function mergeGroceries(
  local: VaultBlobEnvelope<unknown>,
  remote: VaultBlobEnvelope<unknown>,
): VaultBlobEnvelope<GroceriesVaultPayload> {
  const deletions = mergeDeletionLogs(local.deletions, remote.deletions);
  const localPayload = readGroceries(local.records);
  const remotePayload = readGroceries(remote.records);

  const catalog = mergeCatalog(
    localPayload.catalog,
    remotePayload.catalog,
    deletions,
  );
  const catalogIds = new Set(catalog.map((item) => item.id));

  return {
    ...mergeEnvelopeExtras(local, remote),
    records: {
      ...mergeUnknownFields(
        local.records,
        remote.records,
        GROCERIES_PAYLOAD_KEYS,
      ),
      catalog,
      lists: mergeLists(
        localPayload.lists,
        remotePayload.lists,
        deletions,
        catalogIds,
      ),
    },
    deletions,
  };
}

function mergeCatalog(
  local: readonly CatalogItem[],
  remote: readonly CatalogItem[],
  deletions: DeletionLog,
): CatalogItem[] {
  const merged = mergeRecordsById(
    { records: [...local], deletions },
    { records: [...remote], deletions: {} },
    (item) => item.updatedAt ?? item.createdAt,
  );
  // Delete From Catalog wins over a later edit of that same Catalog Item.
  return merged.records.filter((item) => deletions[item.id] === undefined);
}

function mergeLists(
  local: readonly GroceryList[],
  remote: readonly GroceryList[],
  deletions: DeletionLog,
  catalogIds: ReadonlySet<string>,
): GroceryList[] {
  const remoteById = new Map(remote.map((list) => [list.id, list]));
  const seen = new Set<string>();
  const lists: GroceryList[] = [];

  for (const list of local) {
    seen.add(list.id);
    const merged = mergeOneList(
      list,
      remoteById.get(list.id),
      deletions,
      catalogIds,
    );
    if (merged !== null) lists.push(merged);
  }

  for (const list of remote) {
    if (seen.has(list.id)) continue;
    const merged = mergeOneList(undefined, list, deletions, catalogIds);
    if (merged !== null) lists.push(merged);
  }

  return lists;
}

function mergeOneList(
  local: GroceryList | undefined,
  remote: GroceryList | undefined,
  deletions: DeletionLog,
  catalogIds: ReadonlySet<string>,
): GroceryList | null {
  const id = local?.id ?? remote?.id;
  if (id === undefined) return null;
  // Delete Grocery List covers every line on it, including a later rename.
  if (deletions[id] !== undefined) return null;

  const nameFrom = newerList(local, remote);
  const lines = mergeRecordsById(
    { records: local?.lines ?? [], deletions },
    { records: remote?.lines ?? [], deletions: {} },
    (line) => line.updatedAt ?? line.createdAt,
  ).records.filter((line) => catalogIds.has(line.catalogItemId));

  // The newer list wins whole, unknown fields included; only its lines are
  // the merge of both sides.
  return { ...nameFrom, id, lines };
}

/** The list whose `updatedAt` is newer. A tie, or a missing side, keeps local. */
function newerList(
  local: GroceryList | undefined,
  remote: GroceryList | undefined,
): GroceryList {
  if (local === undefined) return remote as GroceryList;
  if (remote === undefined) return local;
  return toEpoch(remote.updatedAt ?? remote.createdAt) >
    toEpoch(local.updatedAt ?? local.createdAt)
    ? remote
    : local;
}

function readGroceries(records: unknown): GroceriesVaultPayload {
  if (
    typeof records !== 'object' ||
    records === null ||
    Array.isArray(records)
  ) {
    return { catalog: [], lists: [] };
  }
  const raw = records as { catalog?: unknown; lists?: unknown };
  return {
    catalog: readIdentified<CatalogItem>(raw.catalog),
    lists: readLists(raw.lists),
  };
}

function readLists(value: unknown): GroceryList[] {
  return readIdentified<GroceryList>(value).map((list) => ({
    ...list,
    lines: readIdentified<ListLine>(list.lines),
  }));
}

function readIdentified<T extends { id: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is T =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { id?: unknown }).id === 'string' &&
      (entry as { id: string }).id.length > 0,
  );
}
