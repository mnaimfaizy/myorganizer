import {
  readGroceryListSummaries,
  buildTripView,
  catalogItemIdsOnList,
  checkedFraction,
  describeDeleteList,
  describeLineRemoved,
  describeListProgress,
  describeRemaining,
  describeUncheckAll,
  readCatalogEntries,
  removeCheckedLabel,
  type TripView,
} from './groceryTripModel';

/** A trip view that is there — the `null` case has its own test. */
function tripViewFor(records: unknown, listId: string): TripView {
  const view = buildTripView(records, listId);
  if (view === null) throw new Error(`no trip view for "${listId}"`);
  return view;
}

describe('groceryTripModel', () => {
  describe('readGroceryListSummaries', () => {
    it('returns one summary per list with total and remaining counts', () => {
      const records = {
        catalog: [],
        lists: [
          {
            id: 'list1',
            name: 'Milk Run',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat1',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line2',
                catalogItemId: 'cat2',
                checked: true,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = readGroceryListSummaries(records);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'list1',
        name: 'Milk Run',
        total: 2,
        remaining: 1,
      });
    });

    it('gives total=0, remaining=0 when list has no lines key', () => {
      const records = {
        catalog: [],
        lists: [
          {
            id: 'list1',
            name: 'Empty List',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = readGroceryListSummaries(records);

      expect(result[0]).toEqual({
        id: 'list1',
        name: 'Empty List',
        total: 0,
        remaining: 0,
      });
    });

    it('drops list with no usable id', () => {
      const records = {
        catalog: [],
        lists: [
          {
            id: '',
            name: 'No ID',
            lines: [],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'list2',
            name: 'Valid',
            lines: [],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = readGroceryListSummaries(records);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('list2');
    });

    it('shows "Untitled list" when list has no usable name', () => {
      const records = {
        catalog: [],
        lists: [
          {
            id: 'list1',
            name: '',
            lines: [],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'list2',
            name: '   ',
            lines: [],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = readGroceryListSummaries(records);

      expect(result[0].name).toBe('Untitled list');
      expect(result[1].name).toBe('Untitled list');
    });

    it('does not count lines with no usable id', () => {
      const records = {
        catalog: [],
        lists: [
          {
            id: 'list1',
            name: 'Mixed',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat1',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: '',
                catalogItemId: 'cat2',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              null,
              {
                catalogItemId: 'cat3',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = readGroceryListSummaries(records);

      expect(result[0]).toEqual({
        id: 'list1',
        name: 'Mixed',
        total: 1,
        remaining: 1,
      });
    });

    it('returns empty array for non-object payload', () => {
      expect(readGroceryListSummaries(null)).toEqual([]);
      expect(readGroceryListSummaries(undefined)).toEqual([]);
      expect(readGroceryListSummaries('not an object')).toEqual([]);
    });

    it('returns empty array for bare array payload', () => {
      expect(readGroceryListSummaries([])).toEqual([]);
    });

    it('returns empty array for payload with no lists key', () => {
      expect(readGroceryListSummaries({ catalog: [] })).toEqual([]);
    });
  });

  describe('buildTripView', () => {
    it('returns null for listId not in payload', () => {
      const records = {
        catalog: [],
        lists: [],
      };

      const result = buildTripView(records, 'nonexistent');

      expect(result).toBeNull();
    });

    it('groups unchecked lines by category in GROCERY_CATEGORY_ORDER', () => {
      const records = {
        catalog: [
          { id: 'cat-bakery', name: 'Bread', category: 'bakery' },
          { id: 'cat-dairy', name: 'Milk', category: 'dairy' },
          { id: 'cat-produce', name: 'Apple', category: 'produce' },
        ],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat-bakery',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line2',
                catalogItemId: 'cat-dairy',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line3',
                catalogItemId: 'cat-produce',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      // Groups come back in order: produce, dairy, bakery (shop walk order)
      expect(result.groups[0].category).toBe('produce');
      expect(result.groups[1].category).toBe('dairy');
      expect(result.groups[2].category).toBe('bakery');
    });

    it('produces no group for category with no unchecked lines', () => {
      const records = {
        catalog: [
          { id: 'cat-dairy', name: 'Milk', category: 'dairy' },
          { id: 'cat-produce', name: 'Apple', category: 'produce' },
        ],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat-dairy',
                checked: true,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line2',
                catalogItemId: 'cat-produce',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].category).toBe('produce');
    });

    it('keeps lines in order within a category', () => {
      const records = {
        catalog: [
          { id: 'cat1', name: 'Item1', category: 'produce' },
          { id: 'cat2', name: 'Item2', category: 'produce' },
          { id: 'cat3', name: 'Item3', category: 'produce' },
        ],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat1',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line2',
                catalogItemId: 'cat2',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line3',
                catalogItemId: 'cat3',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      expect(result.groups[0].lines[0].id).toBe('line1');
      expect(result.groups[0].lines[1].id).toBe('line2');
      expect(result.groups[0].lines[2].id).toBe('line3');
    });

    it('puts checked lines in checkedLines in list order', () => {
      const records = {
        catalog: [
          { id: 'cat1', name: 'Item1', category: 'produce' },
          { id: 'cat2', name: 'Item2', category: 'dairy' },
        ],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat1',
                checked: true,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line2',
                catalogItemId: 'cat2',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line3',
                catalogItemId: 'cat1',
                checked: true,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      expect(result.checkedLines).toHaveLength(2);
      expect(result.checkedLines[0].id).toBe('line1');
      expect(result.checkedLines[1].id).toBe('line3');
    });

    it('resolves catalogItemId from catalog and falls back to Unknown item when missing', () => {
      const records = {
        catalog: [
          { id: 'cat1', name: 'Milk', category: 'dairy' },
          { id: 'cat2', name: 'Cheese', category: 'dairy' },
        ],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat1',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line2',
                catalogItemId: 'missing',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      // Both lines are in dairy group (first one from catalog, second one falls back to 'other' but check the right group)
      const dairyGroup = result.groups.find((g) => g.category === 'dairy');
      expect(dairyGroup).toBeDefined();
      expect(dairyGroup?.lines[0].name).toBe('Milk');

      // The missing catalogItemId line falls back to 'other' category
      const otherGroup = result.groups.find((g) => g.category === 'other');
      expect(otherGroup).toBeDefined();
      expect(otherGroup?.lines[0].name).toBe('Unknown item');
    });

    it('falls back to other category when Catalog Item has unrecognised category', () => {
      const records = {
        catalog: [
          { id: 'cat1', name: 'Mystery', category: 'unknown-category' },
        ],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat1',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      // Since 'other' is the fallback, look for it in groups
      const otherGroup = result.groups.find((g) => g.category === 'other');
      expect(otherGroup).toBeDefined();
      expect(otherGroup?.lines[0].category).toBe('other');
    });

    it('carries amount when it is a non-blank string', () => {
      const records = {
        catalog: [{ id: 'cat1', name: 'Milk', category: 'dairy' }],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat1',
                amount: '2L',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line2',
                catalogItemId: 'cat1',
                amount: '',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line3',
                catalogItemId: 'cat1',
                amount: 123,
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      expect(result.groups[0].lines[0].amount).toBe('2L');
      expect(result.groups[0].lines[1].amount).toBeUndefined();
      expect(result.groups[0].lines[2].amount).toBeUndefined();
    });

    it('carries catalogItemId on every TripLine', () => {
      const records = {
        catalog: [
          { id: 'cat1', name: 'Milk', category: 'dairy' },
          { id: 'cat2', name: 'Butter', category: 'dairy' },
          { id: 'cat3', name: 'Yogurt', category: 'dairy' },
        ],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat1',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line2',
                catalogItemId: '',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line3',
                catalogItemId: null,
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      // All three lines end up in dairy group because they resolve to 'other' category only when the catalog item is missing
      // Actually, line2 and line3 with empty/null catalogItemId will use fallback category 'other'
      const dairyGroup = result.groups.find((g) => g.category === 'dairy');
      const otherGroup = result.groups.find((g) => g.category === 'other');

      // line1 with valid catalogItemId stays in dairy
      expect(dairyGroup?.lines[0].catalogItemId).toBe('cat1');

      // line2 and line3 with empty/null catalogItemId fall back to 'other' and have catalogItemId as ''
      expect(otherGroup?.lines[0].catalogItemId).toBe('');
      expect(otherGroup?.lines[1].catalogItemId).toBe('');
    });

    it('counts total and remaining correctly', () => {
      const records = {
        catalog: [
          { id: 'cat1', name: 'Item1', category: 'produce' },
          { id: 'cat2', name: 'Item2', category: 'dairy' },
          { id: 'cat3', name: 'Item3', category: 'meat' },
        ],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              {
                id: 'line1',
                catalogItemId: 'cat1',
                checked: true,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line2',
                catalogItemId: 'cat2',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'line3',
                catalogItemId: 'cat3',
                checked: false,
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      expect(result.total).toBe(3);
      expect(result.remaining).toBe(2);
    });

    it('returns null for non-object payload', () => {
      expect(buildTripView(null, 'list1')).toBeNull();
      expect(buildTripView(undefined, 'list1')).toBeNull();
      expect(buildTripView('not an object', 'list1')).toBeNull();
    });

    it('returns null for bare array payload', () => {
      expect(buildTripView([], 'list1')).toBeNull();
    });

    it('returns null for payload with no lists key', () => {
      expect(buildTripView({ catalog: [] }, 'list1')).toBeNull();
    });

    it('shows "Untitled list" when list has no usable name', () => {
      const records = {
        catalog: [],
        lists: [
          {
            id: 'list1',
            name: '   ',
            lines: [],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = tripViewFor(records, 'list1');

      expect(result.name).toBe('Untitled list');
    });
  });

  describe('readCatalogEntries', () => {
    it('returns one entry per catalog item, in storage order', () => {
      const records = {
        catalog: [
          { id: 'cat1', name: 'Milk', category: 'dairy' },
          { id: 'cat2', name: 'Bread', category: 'bakery' },
        ],
        lists: [],
      };

      expect(readCatalogEntries(records)).toEqual([
        { id: 'cat1', name: 'Milk', category: 'dairy' },
        { id: 'cat2', name: 'Bread', category: 'bakery' },
      ]);
    });

    it('drops an entry with no usable id', () => {
      const records = {
        catalog: [
          { id: '', name: 'No ID', category: 'other' },
          { id: 'cat2', name: 'Bread', category: 'bakery' },
        ],
      };

      expect(readCatalogEntries(records)).toEqual([
        { id: 'cat2', name: 'Bread', category: 'bakery' },
      ]);
    });

    it('falls back to Unknown item and other category', () => {
      const records = {
        catalog: [{ id: 'cat1', name: '', category: 'not-a-category' }],
      };

      expect(readCatalogEntries(records)).toEqual([
        { id: 'cat1', name: 'Unknown item', category: 'other' },
      ]);
    });

    it('returns empty array for non-object payload', () => {
      expect(readCatalogEntries(null)).toEqual([]);
      expect(readCatalogEntries([])).toEqual([]);
    });
  });

  describe('catalogItemIdsOnList', () => {
    it('returns the catalog item ids referenced by the list, checked or not', () => {
      const records = {
        catalog: [],
        lists: [
          {
            id: 'list1',
            name: 'Trip',
            lines: [
              { id: 'line1', catalogItemId: 'cat1', checked: false },
              { id: 'line2', catalogItemId: 'cat2', checked: true },
            ],
          },
        ],
      };

      expect(catalogItemIdsOnList(records, 'list1')).toEqual(
        new Set(['cat1', 'cat2']),
      );
    });

    it('does not count a blank catalogItemId', () => {
      const records = {
        lists: [
          {
            id: 'list1',
            lines: [{ id: 'line1', catalogItemId: '', checked: false }],
          },
        ],
      };

      expect(catalogItemIdsOnList(records, 'list1')).toEqual(new Set());
    });

    it('returns empty set when the list is not found', () => {
      const records = { lists: [] };

      expect(catalogItemIdsOnList(records, 'nonexistent')).toEqual(new Set());
    });

    it('returns empty set for a list with no lines', () => {
      const records = { lists: [{ id: 'list1', name: 'Trip' }] };

      expect(catalogItemIdsOnList(records, 'list1')).toEqual(new Set());
    });
  });

  describe('buildTripView with settling lines', () => {
    const records = {
      catalog: [
        { id: 'c1', name: 'Bananas', category: 'produce' },
        { id: 'c2', name: 'Lemons', category: 'produce' },
        { id: 'c3', name: 'Eggs', category: 'dairy' },
      ],
      lists: [
        {
          id: 'list1',
          name: 'Weekly shop',
          lines: [
            { id: 'l1', catalogItemId: 'c1', checked: true },
            { id: 'l2', catalogItemId: 'c2', checked: false },
            { id: 'l3', catalogItemId: 'c3', checked: true },
          ],
        },
      ],
    };

    it('keeps a settling checked line in its category, checked, and out of Checked', () => {
      const view = buildTripView(records, 'list1', new Set(['l1']));
      if (view === null) throw new Error('no trip view');

      expect(
        view.groups[0].lines.map((line) => [line.id, line.checked]),
      ).toEqual([
        ['l1', true],
        ['l2', false],
      ]);
      expect(view.checkedLines.map((line) => line.id)).toEqual(['l3']);
    });

    it('counts a settling line as checked', () => {
      const view = buildTripView(records, 'list1', new Set(['l1']));

      expect(view?.remaining).toBe(1);
      expect(view?.total).toBe(3);
    });

    it('ignores a settling id for a line that is not checked', () => {
      const view = buildTripView(records, 'list1', new Set(['l2']));

      expect(view?.groups[0].lines.map((line) => line.id)).toEqual(['l2']);
      expect(view?.checkedLines.map((line) => line.id)).toEqual(['l1', 'l3']);
    });
  });

  describe('describeRemaining', () => {
    it('returns "No lines yet" at total 0', () => {
      expect(describeRemaining(0, 0)).toBe('No lines yet');
    });

    it('returns "All done" at remaining 0 with lines', () => {
      expect(describeRemaining(0, 5)).toBe('All done');
    });

    it('returns "n of m left" for remaining > 0', () => {
      expect(describeRemaining(3, 5)).toBe('3 of 5 left');
      expect(describeRemaining(1, 10)).toBe('1 of 10 left');
    });
  });

  describe('describeListProgress', () => {
    it('says how many lines a finished list holds', () => {
      expect(describeListProgress(0, 6)).toBe('All done · 6 checked');
    });

    it('matches the trip view otherwise', () => {
      expect(describeListProgress(8, 12)).toBe('8 of 12 left');
      expect(describeListProgress(0, 0)).toBe('No lines yet');
    });
  });

  describe('checkedFraction', () => {
    it('is the checked share of the list', () => {
      expect(checkedFraction(8, 12)).toBeCloseTo(1 / 3);
      expect(checkedFraction(0, 6)).toBe(1);
      expect(checkedFraction(9, 9)).toBe(0);
    });

    it('is 0 for an empty list', () => {
      expect(checkedFraction(0, 0)).toBe(0);
    });
  });

  describe('confirmation copy', () => {
    it('words Uncheck All for several lines and for one', () => {
      expect(describeUncheckAll(4)).toBe(
        'All 4 checked lines go back to unchecked, so you can reuse this list. No lines are removed.',
      );
      expect(describeUncheckAll(1)).toBe(
        'The 1 checked line goes back to unchecked, so you can reuse this list. No lines are removed.',
      );
    });

    it('labels Remove Checked From List with the count', () => {
      expect(removeCheckedLabel(4)).toBe('Remove 4 checked lines');
      expect(removeCheckedLabel(1)).toBe('Remove 1 checked line');
    });

    it('says what deleting a list takes with it', () => {
      expect(describeDeleteList(9)).toBe(
        'Its 9 lines go with it. Your Catalog keeps the items. This can’t be undone.',
      );
      expect(describeDeleteList(1)).toBe(
        'Its 1 line goes with it. Your Catalog keeps the items. This can’t be undone.',
      );
      expect(describeDeleteList(0)).toBe(
        'It has no lines. Your Catalog keeps the items. This can’t be undone.',
      );
    });

    it('names the removed line without offering Undo in the text', () => {
      expect(describeLineRemoved('Bananas')).toBe(
        'Bananas removed from this list',
      );
    });
  });
});
