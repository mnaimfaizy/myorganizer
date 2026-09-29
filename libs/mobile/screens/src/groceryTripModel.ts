import {
  GROCERY_CATEGORY_ORDER,
  groceryCategoryLabel,
  type GroceryCategoryType,
} from '@myorganizer/vault-core/portable';

/**
 * What the Groceries screens read out of a decrypted Groceries Vault Blob.
 *
 * Everything here takes `unknown` and nothing here trusts a field. The
 * payload is decrypted JSON written by some build of some client, so its
 * shape is a claim: a list with no `lines`, a line pointing at a Catalog Item
 * that is not there, a category this build has never heard of. Each of those
 * still has to render as something the User can shop, which is why the
 * fallbacks below are the behaviour rather than defensive noise.
 *
 * This module holds no React and imports no `react-native`, which is what
 * lets `libs/mobile/screens`' Jest project — a `node` environment with no
 * renderer — cover it.
 */

/** One Grocery List as the Grocery Lists screen shows it. */
export interface GroceryListSummary {
  id: string;
  name: string;
  /** Every line on the list, checked or not. */
  total: number;
  /** The lines still to pick up. */
  remaining: number;
}

/** One List Line as the trip view shows it. */
export interface TripLine {
  id: string;
  /**
   * The Catalog Item this line points at — empty when the line carries no
   * usable reference. It is what an Undo of Delete List Line re-adds against,
   * so the trip view carries it even though it never prints it.
   */
  catalogItemId: string;
  /** The Catalog Item's name, or a stand-in when it cannot be resolved. */
  name: string;
  category: GroceryCategoryType;
  amount?: string;
  checked: boolean;
}

/** One Catalog Item as the Add-to-list sheet's type-ahead shows it. */
export interface CatalogEntry {
  id: string;
  name: string;
  category: GroceryCategoryType;
}

/** The lines of one category, under that category's label. */
export interface TripCategoryGroup {
  category: GroceryCategoryType;
  label: string;
  lines: TripLine[];
}

/** One Grocery List, arranged for the shop. */
export interface TripView {
  id: string;
  name: string;
  total: number;
  remaining: number;
  /**
   * The lines still to pick up, by category, in the shared shop order. A
   * category with nothing left in it is not a group.
   */
  groups: TripCategoryGroup[];
  /** The Checked Items, in the order they sit on the list. */
  checkedLines: TripLine[];
}

/** The category a line falls under when the Catalog cannot say. */
const FALLBACK_CATEGORY: GroceryCategoryType = 'other';

/** What a line is called when its Catalog Item is not in the payload. */
const UNKNOWN_ITEM_NAME = 'Unknown item';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readArray(source: unknown, key: string): unknown[] {
  if (!isRecord(source)) return [];
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function readId(entry: unknown): string | null {
  if (!isRecord(entry)) return null;
  return typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : null;
}

function readCategory(value: unknown): GroceryCategoryType {
  return GROCERY_CATEGORY_ORDER.includes(value as GroceryCategoryType)
    ? (value as GroceryCategoryType)
    : FALLBACK_CATEGORY;
}

/** The Catalog as a lookup from Catalog Item id to name and category. */
function readCatalog(
  records: unknown,
): Map<string, { name: string; category: GroceryCategoryType }> {
  const catalog = new Map<
    string,
    { name: string; category: GroceryCategoryType }
  >();

  for (const entry of readArray(records, 'catalog')) {
    const id = readId(entry);
    if (id === null || !isRecord(entry)) continue;
    catalog.set(id, {
      name:
        typeof entry.name === 'string' && entry.name.trim().length > 0
          ? entry.name
          : UNKNOWN_ITEM_NAME,
      category: readCategory(entry.category),
    });
  }

  return catalog;
}

/** The lines of one Grocery List, resolved against the Catalog. */
function readTripLines(
  list: unknown,
  catalog: ReturnType<typeof readCatalog>,
): TripLine[] {
  const lines: TripLine[] = [];

  for (const entry of readArray(list, 'lines')) {
    const id = readId(entry);
    if (id === null || !isRecord(entry)) continue;

    const catalogItemId =
      typeof entry.catalogItemId === 'string' ? entry.catalogItemId : '';
    const item = catalog.get(catalogItemId);

    lines.push({
      id,
      catalogItemId,
      name: item?.name ?? UNKNOWN_ITEM_NAME,
      category: item?.category ?? FALLBACK_CATEGORY,
      ...(typeof entry.amount === 'string' && entry.amount.trim().length > 0
        ? { amount: entry.amount }
        : {}),
      checked: entry.checked === true,
    });
  }

  return lines;
}

/**
 * Every Catalog Item in the payload, in the order it is stored — the
 * Add-to-list sheet does its own filtering and does not need them presorted.
 *
 * An entry with no usable id is dropped, the same rule `readCatalog` uses:
 * there would be no id to reference from a new List Line.
 */
export function readCatalogEntries(records: unknown): CatalogEntry[] {
  const entries: CatalogEntry[] = [];

  for (const entry of readArray(records, 'catalog')) {
    const id = readId(entry);
    if (id === null || !isRecord(entry)) continue;
    entries.push({
      id,
      name:
        typeof entry.name === 'string' && entry.name.trim().length > 0
          ? entry.name
          : UNKNOWN_ITEM_NAME,
      category: readCategory(entry.category),
    });
  }

  return entries;
}

/**
 * The Catalog Item ids already referenced by some line on one Grocery List —
 * checked or not. What the Add-to-list sheet marks "On list": a Checked Item
 * still counts, since re-adding it would put a second line on the same list
 * for the same Catalog Item rather than surface the one already there.
 */
export function catalogItemIdsOnList(
  records: unknown,
  listId: string,
): Set<string> {
  const list = readArray(records, 'lists').find(
    (entry) => readId(entry) === listId,
  );
  const ids = new Set<string>();
  if (list === undefined) return ids;

  for (const line of readArray(list, 'lines')) {
    if (!isRecord(line)) continue;
    if (typeof line.catalogItemId === 'string' && line.catalogItemId !== '') {
      ids.add(line.catalogItemId);
    }
  }

  return ids;
}

/**
 * Every Grocery List in the payload, with its counts.
 *
 * A list with no usable id is dropped — there would be no way to open it —
 * and one with no usable name shows as `Untitled list` rather than as a blank
 * row.
 */
export function readGroceryListSummaries(
  records: unknown,
): GroceryListSummary[] {
  const summaries: GroceryListSummary[] = [];

  for (const list of readArray(records, 'lists')) {
    const id = readId(list);
    if (id === null || !isRecord(list)) continue;

    const lines = readArray(list, 'lines');
    const total = lines.filter((line) => readId(line) !== null).length;
    const remaining = lines.filter(
      (line) =>
        readId(line) !== null && !(isRecord(line) && line.checked === true),
    ).length;

    summaries.push({
      id,
      name:
        typeof list.name === 'string' && list.name.trim().length > 0
          ? list.name
          : 'Untitled list',
      total,
      remaining,
    });
  }

  return summaries;
}

/**
 * One Grocery List arranged for the shop, or `null` when the payload holds no
 * list with that id — which is what a User sees when the list was deleted on
 * another device while this screen was open.
 *
 * Unchecked lines are grouped by category in the shared shop order
 * (`GROCERY_CATEGORY_ORDER`), and within a category they stay in the order
 * they sit on the list: that is the order the User added them in, and
 * re-sorting rows under someone's thumb mid-trip moves the row they were
 * reaching for.
 *
 * Checked Items leave their category and collect in one list of their own, so
 * that what is left to pick up is the whole of what the trip view shows.
 */
export function buildTripView(
  records: unknown,
  listId: string,
): TripView | null {
  const list = readArray(records, 'lists').find(
    (entry) => readId(entry) === listId,
  );
  if (list === undefined || !isRecord(list)) return null;

  const lines = readTripLines(list, readCatalog(records));
  const checkedLines = lines.filter((line) => line.checked);
  const byCategory = new Map<GroceryCategoryType, TripLine[]>();

  for (const line of lines) {
    if (line.checked) continue;
    const group = byCategory.get(line.category);
    if (group === undefined) byCategory.set(line.category, [line]);
    else group.push(line);
  }

  const groups: TripCategoryGroup[] = [];
  for (const category of GROCERY_CATEGORY_ORDER) {
    const categoryLines = byCategory.get(category);
    if (categoryLines === undefined) continue;
    groups.push({
      category,
      label: groceryCategoryLabel(category),
      lines: categoryLines,
    });
  }

  return {
    id: listId,
    name:
      typeof list.name === 'string' && list.name.trim().length > 0
        ? list.name
        : 'Untitled list',
    total: lines.length,
    remaining: lines.length - checkedLines.length,
    groups,
    checkedLines,
  };
}

/**
 * How far through a Grocery List the User is, in words.
 *
 * `n of m left` counts what is **still to pick up**, not what is done: the
 * question in a shop is how much further, and a progress count answers the
 * opposite one.
 */
export function describeRemaining(remaining: number, total: number): string {
  if (total === 0) return 'No items';
  if (remaining === 0) return 'All checked';
  return `${remaining} of ${total} left`;
}
