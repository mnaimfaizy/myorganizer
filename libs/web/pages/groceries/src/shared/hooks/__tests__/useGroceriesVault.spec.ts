/*
  Tests for useGroceriesVault hook.
  - Mocks @myorganizer/web-vault's loadDecryptedData/normalizeGroceries/saveEncryptedData
  - Mocks @myorganizer/core's randomId with a predictable sequential generator
  - Covers the catalog-membership mutation seams: addItemToLists,
    addExistingCatalogItemToLists, deleteCatalogItem, plus a light regression
    pass over pre-existing trip lifecycle actions (toggle/uncheck/remove/
    restore/delete-line) to reinforce that they never destroy Catalog Items.
*/

/** Mocking rule: place jest.mock calls before any imports */
jest.mock('@myorganizer/web-vault');

jest.mock('@myorganizer/core', () => {
  let counter = 0;
  return {
    randomId: jest.fn(() => `id-${++counter}`),
  };
});

import type {
  CatalogItem,
  GroceriesVaultPayload,
  GroceryList,
  ListLine,
} from '@myorganizer/core';
import {
  loadDecryptedData,
  normalizeGroceries,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useGroceriesVault } from '../useGroceriesVault';

const mockLoadDecryptedData = loadDecryptedData as jest.Mock;
const mockNormalizeGroceries = normalizeGroceries as jest.Mock;
const mockSaveEncryptedData = saveEncryptedData as jest.Mock;

describe('useGroceriesVault', () => {
  const masterKeyBytes = new Uint8Array(32);

  function makeCatalogItem(
    overrides: Partial<CatalogItem> & Pick<CatalogItem, 'id' | 'name'>,
  ): CatalogItem {
    return {
      category: 'other',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function makeLine(
    overrides: Partial<ListLine> & Pick<ListLine, 'id' | 'catalogItemId'>,
  ): ListLine {
    return {
      checked: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function makeList(
    overrides: Partial<GroceryList> & Pick<GroceryList, 'id' | 'name'>,
  ): GroceryList {
    return {
      lines: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  /** Wires the vault mocks to resolve with the given payload and renders the hook. */
  async function setup(initialPayload: GroceriesVaultPayload) {
    mockLoadDecryptedData.mockResolvedValue(initialPayload);
    mockNormalizeGroceries.mockImplementation((raw: unknown) => ({
      value: raw as GroceriesVaultPayload,
      changed: false,
    }));
    mockSaveEncryptedData.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGroceriesVault({ masterKeyBytes }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    return result;
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('addItemToLists', () => {
    it('creates a new Catalog Item and adds a new List Line to every target list', async () => {
      const listA = makeList({ id: 'listA', name: 'A' });
      const listB = makeList({ id: 'listB', name: 'B' });
      const result = await setup({ catalog: [], lists: [listA, listB] });

      await act(async () => {
        await result.current.addItemToLists(['listA', 'listB'], {
          name: 'Milk',
          category: 'dairy',
        });
      });

      expect(result.current.catalog).toHaveLength(1);
      expect(result.current.catalog[0].name).toBe('Milk');
      expect(result.current.catalog[0].category).toBe('dairy');

      const catalogItemId = result.current.catalog[0].id;
      const listAResult = result.current.lists.find((l) => l.id === 'listA');
      const listBResult = result.current.lists.find((l) => l.id === 'listB');
      expect(listAResult?.lines).toHaveLength(1);
      expect(listAResult?.lines[0].catalogItemId).toBe(catalogItemId);
      expect(listBResult?.lines).toHaveLength(1);
      expect(listBResult?.lines[0].catalogItemId).toBe(catalogItemId);
    });

    it('reuses an existing Catalog Item case-insensitively and updates its durable fields', async () => {
      const existing = makeCatalogItem({
        id: 'cat-1',
        name: 'milk',
        category: 'other',
      });
      const listA = makeList({ id: 'listA', name: 'A' });
      const result = await setup({ catalog: [existing], lists: [listA] });

      await act(async () => {
        await result.current.addItemToLists(['listA'], {
          name: 'MILK',
          category: 'dairy',
          price: 2.5,
        });
      });

      // Reused, not duplicated
      expect(result.current.catalog).toHaveLength(1);
      expect(result.current.catalog[0].id).toBe('cat-1');
      expect(result.current.catalog[0].name).toBe('MILK');
      expect(result.current.catalog[0].category).toBe('dairy');
      expect(result.current.catalog[0].price).toBe(2.5);

      const listAResult = result.current.lists.find((l) => l.id === 'listA');
      expect(listAResult?.lines).toHaveLength(1);
      expect(listAResult?.lines[0].catalogItemId).toBe('cat-1');
    });

    it('skips lists that already have a line for the Catalog Item, but still adds to others', async () => {
      const existing = makeCatalogItem({ id: 'cat-1', name: 'Milk' });
      const listA = makeList({
        id: 'listA',
        name: 'A',
        lines: [makeLine({ id: 'ln-existing', catalogItemId: 'cat-1' })],
      });
      const listB = makeList({ id: 'listB', name: 'B' });
      const result = await setup({
        catalog: [existing],
        lists: [listA, listB],
      });

      await act(async () => {
        await result.current.addItemToLists(['listA', 'listB'], {
          name: 'Milk',
          category: 'dairy',
        });
      });

      const listAResult = result.current.lists.find((l) => l.id === 'listA');
      const listBResult = result.current.lists.find((l) => l.id === 'listB');
      // listA already had a line for cat-1 - no duplicate added
      expect(listAResult?.lines).toHaveLength(1);
      expect(listAResult?.lines[0].id).toBe('ln-existing');
      // listB did not have a line - one was added
      expect(listBResult?.lines).toHaveLength(1);
    });

    it('creates/reuses the Catalog Item but mutates no list when listIds is empty', async () => {
      const listA = makeList({ id: 'listA', name: 'A' });
      const result = await setup({ catalog: [], lists: [listA] });

      await act(async () => {
        await result.current.addItemToLists([], {
          name: 'Milk',
          category: 'dairy',
        });
      });

      expect(result.current.catalog).toHaveLength(1);
      const listAResult = result.current.lists.find((l) => l.id === 'listA');
      expect(listAResult?.lines).toHaveLength(0);
    });
  });

  describe('addExistingCatalogItemToLists', () => {
    it('adds a new List Line (with amount) to every target list lacking one, skipping ones that already have it', async () => {
      const catalogItem = makeCatalogItem({ id: 'cat-1', name: 'Milk' });
      const listA = makeList({
        id: 'listA',
        name: 'A',
        lines: [makeLine({ id: 'ln-existing', catalogItemId: 'cat-1' })],
      });
      const listB = makeList({ id: 'listB', name: 'B' });
      const result = await setup({
        catalog: [catalogItem],
        lists: [listA, listB],
      });

      let addedListIds: string[] = [];
      await act(async () => {
        addedListIds = await result.current.addExistingCatalogItemToLists(
          'cat-1',
          ['listA', 'listB'],
          '2 gallons',
        );
      });

      // Resolves with only the list ids that actually received a new line
      expect(addedListIds).toEqual(['listB']);

      const listAResult = result.current.lists.find((l) => l.id === 'listA');
      const listBResult = result.current.lists.find((l) => l.id === 'listB');
      // listA already had a line - untouched
      expect(listAResult?.lines).toHaveLength(1);
      expect(listAResult?.lines[0].id).toBe('ln-existing');
      // listB gets a new line with the given amount
      expect(listBResult?.lines).toHaveLength(1);
      expect(listBResult?.lines[0].catalogItemId).toBe('cat-1');
      expect(listBResult?.lines[0].amount).toBe('2 gallons');
    });

    it('rejects when the Catalog Item does not exist and does not persist any change', async () => {
      const listA = makeList({ id: 'listA', name: 'A' });
      const result = await setup({ catalog: [], lists: [listA] });

      await expect(
        act(async () => {
          await result.current.addExistingCatalogItemToLists('missing', [
            'listA',
          ]);
        }),
      ).rejects.toThrow('Catalog Item not found');

      expect(mockSaveEncryptedData).not.toHaveBeenCalled();
      expect(
        result.current.lists.find((l) => l.id === 'listA')?.lines,
      ).toHaveLength(0);
    });

    it('does not mutate the Catalog Item durable fields', async () => {
      const catalogItem = makeCatalogItem({
        id: 'cat-1',
        name: 'Milk',
        category: 'dairy',
        price: 3,
      });
      const listA = makeList({ id: 'listA', name: 'A' });
      const result = await setup({ catalog: [catalogItem], lists: [listA] });

      await act(async () => {
        await result.current.addExistingCatalogItemToLists('cat-1', ['listA']);
      });

      expect(result.current.catalog[0]).toMatchObject({
        id: 'cat-1',
        name: 'Milk',
        category: 'dairy',
        price: 3,
      });
    });
  });

  describe('deleteCatalogItem', () => {
    it('removes the Catalog Item and cascades line removal only on referencing lists', async () => {
      const catalogItem = makeCatalogItem({ id: 'cat-1', name: 'Milk' });
      const listA = makeList({
        id: 'listA',
        name: 'A',
        lines: [makeLine({ id: 'lnA', catalogItemId: 'cat-1' })],
      });
      const listB = makeList({
        id: 'listB',
        name: 'B',
        lines: [makeLine({ id: 'lnB', catalogItemId: 'cat-1' })],
      });
      const otherLine = makeLine({ id: 'lnC', catalogItemId: 'cat-other' });
      const listC = makeList({
        id: 'listC',
        name: 'C',
        lines: [otherLine],
      });
      const result = await setup({
        catalog: [catalogItem],
        lists: [listA, listB, listC],
      });

      await act(async () => {
        await result.current.deleteCatalogItem('cat-1');
      });

      expect(result.current.catalog).toHaveLength(0);
      expect(result.current.lists.find((l) => l.id === 'listA')?.lines).toEqual(
        [],
      );
      expect(result.current.lists.find((l) => l.id === 'listB')?.lines).toEqual(
        [],
      );
      // listC never referenced the deleted item - untouched
      expect(result.current.lists.find((l) => l.id === 'listC')?.lines).toEqual(
        [otherLine],
      );
    });

    it('removes a Catalog Item with no referencing lines cleanly', async () => {
      const catalogItem = makeCatalogItem({ id: 'cat-1', name: 'Milk' });
      const listA = makeList({ id: 'listA', name: 'A' });
      const result = await setup({ catalog: [catalogItem], lists: [listA] });

      await act(async () => {
        await result.current.deleteCatalogItem('cat-1');
      });

      expect(result.current.catalog).toHaveLength(0);
      expect(result.current.lists.find((l) => l.id === 'listA')?.lines).toEqual(
        [],
      );
    });
  });

  describe('regression: pre-existing trip lifecycle actions never destroy Catalog Items', () => {
    it('toggleLineChecked flips only the target line, catalog and other lines untouched', async () => {
      const catalogItem = makeCatalogItem({ id: 'cat-1', name: 'Milk' });
      const line = makeLine({ id: 'ln-1', catalogItemId: 'cat-1' });
      const listA = makeList({ id: 'listA', name: 'A', lines: [line] });
      const result = await setup({ catalog: [catalogItem], lists: [listA] });

      await act(async () => {
        await result.current.toggleLineChecked('listA', 'ln-1');
      });

      expect(result.current.catalog).toEqual([catalogItem]);
      expect(
        result.current.lists.find((l) => l.id === 'listA')?.lines[0].checked,
      ).toBe(true);
    });

    it('uncheckAllLines unchecks every line without removing any line or Catalog Item', async () => {
      const catalogItem = makeCatalogItem({ id: 'cat-1', name: 'Milk' });
      const line = makeLine({
        id: 'ln-1',
        catalogItemId: 'cat-1',
        checked: true,
      });
      const listA = makeList({ id: 'listA', name: 'A', lines: [line] });
      const result = await setup({ catalog: [catalogItem], lists: [listA] });

      await act(async () => {
        await result.current.uncheckAllLines('listA');
      });

      expect(result.current.catalog).toEqual([catalogItem]);
      const resultList = result.current.lists.find((l) => l.id === 'listA');
      expect(resultList?.lines).toHaveLength(1);
      expect(resultList?.lines[0].checked).toBe(false);
    });

    it('removeCheckedLines + restoreLines round-trips without touching the Catalog Item', async () => {
      const catalogItem = makeCatalogItem({ id: 'cat-1', name: 'Milk' });
      const line = makeLine({
        id: 'ln-1',
        catalogItemId: 'cat-1',
        checked: true,
      });
      const listA = makeList({ id: 'listA', name: 'A', lines: [line] });
      const result = await setup({ catalog: [catalogItem], lists: [listA] });

      let removed: ListLine[] = [];
      await act(async () => {
        removed = await result.current.removeCheckedLines('listA');
      });

      expect(removed).toHaveLength(1);
      expect(result.current.lists.find((l) => l.id === 'listA')?.lines).toEqual(
        [],
      );
      expect(result.current.catalog).toEqual([catalogItem]);

      await act(async () => {
        await result.current.restoreLines('listA', removed);
      });

      expect(result.current.lists.find((l) => l.id === 'listA')?.lines).toEqual(
        [line],
      );
      expect(result.current.catalog).toEqual([catalogItem]);
    });

    it('deleteListLine removes only that line, leaving the Catalog Item intact', async () => {
      const catalogItem = makeCatalogItem({ id: 'cat-1', name: 'Milk' });
      const line = makeLine({ id: 'ln-1', catalogItemId: 'cat-1' });
      const listA = makeList({ id: 'listA', name: 'A', lines: [line] });
      const result = await setup({ catalog: [catalogItem], lists: [listA] });

      await act(async () => {
        await result.current.deleteListLine('listA', 'ln-1');
      });

      expect(result.current.lists.find((l) => l.id === 'listA')?.lines).toEqual(
        [],
      );
      expect(result.current.catalog).toEqual([catalogItem]);
    });
  });
});
