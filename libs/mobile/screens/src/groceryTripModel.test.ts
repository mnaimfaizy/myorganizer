import {
  readGroceryListSummaries,
  buildTripView,
  describeRemaining,
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

  describe('describeRemaining', () => {
    it('returns "No items" at total 0', () => {
      expect(describeRemaining(0, 0)).toBe('No items');
    });

    it('returns "All checked" at remaining 0 with items', () => {
      expect(describeRemaining(0, 5)).toBe('All checked');
    });

    it('returns "n of m left" for remaining > 0', () => {
      expect(describeRemaining(3, 5)).toBe('3 of 5 left');
      expect(describeRemaining(1, 10)).toBe('1 of 10 left');
    });
  });
});
