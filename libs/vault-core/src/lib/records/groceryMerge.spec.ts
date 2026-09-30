import { mergeGroceries } from './groceryMerge';
import type { CatalogItem, GroceryList, ListLine } from './grocery';
import type { VaultBlobEnvelope } from './vaultBlobEnvelope';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';
const T3 = '2026-01-03T00:00:00.000Z';

function catalogItem(
  id: string,
  name: string,
  updatedAt: string,
  extra?: Partial<CatalogItem>,
): CatalogItem {
  return {
    id,
    name,
    category: 'other',
    createdAt: T1,
    updatedAt,
    ...extra,
  };
}

function listLine(
  id: string,
  catalogItemId: string,
  updatedAt: string,
  extra?: Partial<ListLine>,
): ListLine {
  return {
    id,
    catalogItemId,
    checked: false,
    createdAt: T1,
    updatedAt,
    ...extra,
  };
}

function groceryList(
  id: string,
  name: string,
  updatedAt: string,
  lines: ListLine[] = [],
): GroceryList {
  return {
    id,
    name,
    lines,
    createdAt: T1,
    updatedAt,
  };
}

function groceriesEnvelope(
  catalog: CatalogItem[],
  lists: GroceryList[],
  deletions: Record<string, string> = {},
): VaultBlobEnvelope<unknown> {
  return {
    records: { catalog, lists },
    deletions,
  };
}

describe('mergeGroceries', () => {
  it('unions different lists with local order first', () => {
    const local = groceriesEnvelope([], [groceryList('list-a', 'A', T1)]);
    const remote = groceriesEnvelope([], [groceryList('list-b', 'B', T1)]);

    const result = mergeGroceries(local, remote);

    expect(result.records.lists).toEqual([
      groceryList('list-a', 'A', T1),
      groceryList('list-b', 'B', T1),
    ]);
  });

  it('keeps the whole newer catalog item on id collision', () => {
    const local = groceriesEnvelope(
      [catalogItem('cat-1', 'Milk', T1, { price: 1 })],
      [],
    );
    const remote = groceriesEnvelope(
      [catalogItem('cat-1', 'Oat milk', T2)],
      [],
    );

    const result = mergeGroceries(local, remote);

    expect(result.records.catalog).toEqual([
      {
        id: 'cat-1',
        name: 'Oat milk',
        category: 'other',
        createdAt: T1,
        updatedAt: T2,
      },
    ]);
  });

  it('keeps the newer list line on id collision', () => {
    const milk = catalogItem('cat-milk', 'Milk', T1);
    const local = groceriesEnvelope(
      [milk],
      [
        groceryList('list-1', 'Shop', T1, [
          listLine('line-1', 'cat-milk', T1, {
            amount: '2',
            checked: false,
          }),
        ]),
      ],
    );
    const remote = groceriesEnvelope(
      [milk],
      [
        groceryList('list-1', 'Shop', T1, [
          listLine('line-1', 'cat-milk', T2, {
            amount: '1',
            checked: true,
          }),
        ]),
      ],
    );

    const result = mergeGroceries(local, remote);

    expect(result.records.lists[0].lines).toEqual([
      {
        id: 'line-1',
        catalogItemId: 'cat-milk',
        checked: true,
        amount: '1',
        createdAt: T1,
        updatedAt: T2,
      },
    ]);
  });

  it('takes the newer list name and unions lines in local order', () => {
    const milk = catalogItem('cat-milk', 'Milk', T1);
    const bread = catalogItem('cat-bread', 'Bread', T1);
    const local = groceriesEnvelope(
      [milk, bread],
      [
        groceryList('list-1', 'Saturday', T1, [
          listLine('line-milk', 'cat-milk', T1),
        ]),
      ],
    );
    const remote = groceriesEnvelope(
      [milk, bread],
      [
        groceryList('list-1', 'Weekly shop', T2, [
          listLine('line-bread', 'cat-bread', T1),
        ]),
      ],
    );

    const result = mergeGroceries(local, remote);

    expect(result.records.lists).toEqual([
      {
        id: 'list-1',
        name: 'Weekly shop',
        createdAt: T1,
        updatedAt: T2,
        lines: [
          {
            id: 'line-milk',
            catalogItemId: 'cat-milk',
            checked: false,
            createdAt: T1,
            updatedAt: T1,
          },
          {
            id: 'line-bread',
            catalogItemId: 'cat-bread',
            checked: false,
            createdAt: T1,
            updatedAt: T1,
          },
        ],
      },
    ]);
  });

  it('omits a grocery list deleted before a later rename on the other side', () => {
    const milk = catalogItem('cat-milk', 'Milk', T1);
    const local = groceriesEnvelope(
      [milk],
      [
        groceryList('list-1', 'Old name', T1, [
          listLine('line-1', 'cat-milk', T1),
        ]),
      ],
      { 'list-1': T2 },
    );
    const remote = groceriesEnvelope(
      [milk],
      [
        groceryList('list-1', 'Renamed', T3, [
          listLine('line-1', 'cat-milk', T1),
          listLine('line-new', 'cat-milk', T3),
        ]),
      ],
    );

    const result = mergeGroceries(local, remote);

    expect(result.records.lists).toEqual([]);
    expect(result.deletions).toEqual({ 'list-1': T2 });
  });

  it('drops a list line deleted after its last change', () => {
    const milk = catalogItem('cat-milk', 'Milk', T1);
    const local = groceriesEnvelope(
      [milk],
      [groceryList('list-1', 'Shop', T1, [listLine('line-1', 'cat-milk', T1)])],
      { 'line-1': T2 },
    );
    const remote = groceriesEnvelope(
      [milk],
      [groceryList('list-1', 'Shop', T1, [listLine('line-1', 'cat-milk', T1)])],
    );

    const result = mergeGroceries(local, remote);

    expect(result.records.lists[0].lines).toEqual([]);
  });

  it('keeps a list line changed after its deletion', () => {
    const milk = catalogItem('cat-milk', 'Milk', T1);
    const local = groceriesEnvelope(
      [milk],
      [
        groceryList('list-1', 'Shop', T1, [
          listLine('line-1', 'cat-milk', T3, { amount: '3' }),
        ]),
      ],
      { 'line-1': T2 },
    );
    const remote = groceriesEnvelope(
      [milk],
      [groceryList('list-1', 'Shop', T1, [])],
    );

    const result = mergeGroceries(local, remote);

    expect(result.records.lists[0].lines).toEqual([
      {
        id: 'line-1',
        catalogItemId: 'cat-milk',
        checked: false,
        amount: '3',
        createdAt: T1,
        updatedAt: T3,
      },
    ]);
  });

  it('drops a deleted catalog item and its lines but keeps same-name item with another id', () => {
    const deleted = catalogItem('cat-deleted', 'Milk', T3);
    const kept = catalogItem('cat-kept', 'Milk', T1);
    const local = groceriesEnvelope(
      [deleted, kept],
      [
        groceryList('list-1', 'Shop', T1, [
          listLine('line-deleted', 'cat-deleted', T3),
          listLine('line-kept', 'cat-kept', T1),
        ]),
      ],
      { 'cat-deleted': T1 },
    );
    const remote = groceriesEnvelope(
      [deleted, kept],
      [
        groceryList('list-1', 'Shop', T1, [
          listLine('line-deleted', 'cat-deleted', T3),
        ]),
      ],
    );

    const result = mergeGroceries(local, remote);

    expect(result.records.catalog).toEqual([
      {
        id: 'cat-kept',
        name: 'Milk',
        category: 'other',
        createdAt: T1,
        updatedAt: T1,
      },
    ]);
    expect(result.records.lists[0].lines).toEqual([
      {
        id: 'line-kept',
        catalogItemId: 'cat-kept',
        checked: false,
        createdAt: T1,
        updatedAt: T1,
      },
    ]);
    expect(result.deletions).toEqual({ 'cat-deleted': T1 });
  });

  it('keeps the local catalog item when updatedAt ties', () => {
    const local = groceriesEnvelope(
      [catalogItem('cat-1', 'Local name', T1)],
      [],
    );
    const remote = groceriesEnvelope(
      [catalogItem('cat-1', 'Remote name', T1)],
      [],
    );

    const result = mergeGroceries(local, remote);

    expect(result.records.catalog).toEqual([
      {
        id: 'cat-1',
        name: 'Local name',
        category: 'other',
        createdAt: T1,
        updatedAt: T1,
      },
    ]);
  });

  it('reads non-object records as empty catalog and lists while unioning deletions', () => {
    const local: VaultBlobEnvelope<unknown> = {
      records: null,
      deletions: { 'gone-local': T1 },
    };
    const remote: VaultBlobEnvelope<unknown> = {
      records: [],
      deletions: { 'gone-remote': T2 },
    };

    const result = mergeGroceries(local, remote);

    expect(result.records).toEqual({ catalog: [], lists: [] });
    expect(result.deletions).toEqual({
      'gone-local': T1,
      'gone-remote': T2,
    });
  });
});
