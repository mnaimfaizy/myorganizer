import { normalizeGroceries } from './groceriesNormalization';
import type { GroceriesVaultPayload } from '@myorganizer/core';

describe('normalizeGroceries', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('null/undefined input', () => {
    it('should return empty payload for null without marking changed', () => {
      const result = normalizeGroceries(null);
      expect(result).toEqual({
        value: { catalog: [], lists: [] },
        changed: false,
      });
    });

    it('should return empty payload for undefined without marking changed', () => {
      const result = normalizeGroceries(undefined);
      expect(result).toEqual({
        value: { catalog: [], lists: [] },
        changed: false,
      });
    });
  });

  describe('unrecognized shape input', () => {
    it('should return empty payload for empty object and mark changed', () => {
      const result = normalizeGroceries({});
      expect(result).toEqual({
        value: { catalog: [], lists: [] },
        changed: true,
      });
    });

    it('should return empty payload for string and mark changed', () => {
      const result = normalizeGroceries('string');
      expect(result).toEqual({
        value: { catalog: [], lists: [] },
        changed: true,
      });
    });

    it('should return empty payload for number and mark changed', () => {
      const result = normalizeGroceries(123);
      expect(result).toEqual({
        value: { catalog: [], lists: [] },
        changed: true,
      });
    });

    it('should return empty payload for object with wrong keys and mark changed', () => {
      const result = normalizeGroceries({ wrongKey: 'value' });
      expect(result).toEqual({
        value: { catalog: [], lists: [] },
        changed: true,
      });
    });
  });

  describe('new shape: valid catalog and lists', () => {
    it('should preserve already-normalized payload without marking changed', () => {
      const input: GroceriesVaultPayload = {
        catalog: [
          {
            id: 'catalog-1',
            name: 'Milk',
            category: 'dairy',
            price: 3.5,
            notes: 'Whole milk',
            imageUrl: 'https://example.com/milk.jpg',
            links: ['https://store.com/milk'],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        lists: [
          {
            id: 'list-1',
            name: 'Weekly Shopping',
            lines: [
              {
                id: 'line-1',
                catalogItemId: 'catalog-1',
                checked: false,
                amount: '1L',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = normalizeGroceries(input);
      expect(result.value).toEqual(input);
      expect(result.changed).toBe(false);
    });

    it('should generate IDs and timestamps for missing fields', () => {
      const input = {
        catalog: [{ name: 'Apples' }],
        lists: [
          {
            name: 'Shopping',
            lines: [{ catalogItemId: 'will-be-dropped' }],
          },
        ],
      };

      const result = normalizeGroceries(input);

      expect(result.value.catalog).toHaveLength(1);
      const catalogItem = result.value.catalog[0];
      expect(typeof catalogItem.id).toBe('string');
      expect(catalogItem.id.length).toBeGreaterThan(0);
      expect(catalogItem.name).toBe('Apples');
      expect(catalogItem.category).toBe('other');
      expect(catalogItem.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(catalogItem.updatedAt).toBe('2026-01-01T00:00:00.000Z');

      expect(result.value.lists).toHaveLength(1);
      const list = result.value.lists[0];
      expect(typeof list.id).toBe('string');
      expect(list.id.length).toBeGreaterThan(0);
      expect(list.name).toBe('Shopping');
      expect(list.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(list.updatedAt).toBe('2026-01-01T00:00:00.000Z');

      // Line with invalid catalogItemId should be dropped
      expect(list.lines).toHaveLength(0);

      expect(result.changed).toBe(true);
    });

    it('should normalize empty catalog and lists arrays without marking changed', () => {
      const input = { catalog: [], lists: [] };
      const result = normalizeGroceries(input);
      expect(result.value).toEqual(input);
      expect(result.changed).toBe(false);
    });
  });

  describe('new shape: catalog item validation', () => {
    it('should drop catalog item without name', () => {
      const input = {
        catalog: [{ id: 'catalog-1' }, { id: 'catalog-2', name: 'Valid Item' }],
        lists: [],
      };

      const result = normalizeGroceries(input);
      expect(result.value.catalog).toHaveLength(1);
      expect(result.value.catalog[0].name).toBe('Valid Item');
      expect(result.changed).toBe(true);
    });

    it('should drop catalog item with empty name', () => {
      const input = {
        catalog: [{ name: '   ' }, { name: 'Valid Item' }],
        lists: [],
      };

      const result = normalizeGroceries(input);
      expect(result.value.catalog).toHaveLength(1);
      expect(result.value.catalog[0].name).toBe('Valid Item');
      expect(result.changed).toBe(true);
    });

    it('should trim whitespace from catalog item names', () => {
      const input = {
        catalog: [{ name: '  Milk  ' }],
        lists: [],
      };

      const result = normalizeGroceries(input);
      expect(result.value.catalog[0].name).toBe('Milk');
      expect(result.changed).toBe(true);
    });

    it('should coerce invalid category to "other"', () => {
      const input = {
        catalog: [
          { name: 'Item1', category: 'invalid-category' },
          { name: 'Item2', category: 'dairy' },
        ],
        lists: [],
      };

      const result = normalizeGroceries(input);
      expect(result.value.catalog[0].category).toBe('other');
      expect(result.value.catalog[1].category).toBe('dairy');
      expect(result.changed).toBe(true);
    });

    it('should default missing category to "other"', () => {
      const input = {
        catalog: [{ name: 'Item' }],
        lists: [],
      };

      const result = normalizeGroceries(input);
      expect(result.value.catalog[0].category).toBe('other');
      expect(result.changed).toBe(true);
    });

    it('should accept all valid categories', () => {
      const categories = [
        'produce',
        'dairy',
        'meat',
        'seafood',
        'bakery',
        'frozen',
        'beverages',
        'snacks',
        'condiments',
        'household',
        'personal-care',
        'other',
      ];

      const input = {
        catalog: categories.map((cat) => ({
          name: `Item-${cat}`,
          category: cat,
        })),
        lists: [],
      };

      const result = normalizeGroceries(input);
      result.value.catalog.forEach((item, i) => {
        expect(item.category).toBe(categories[i]);
      });
    });

    it('should remove invalid imageUrl', () => {
      const input = {
        catalog: [
          { name: 'Item1', imageUrl: 'not-a-url' },
          { name: 'Item2', imageUrl: '' },
          { name: 'Item3', imageUrl: 'https://example.com/valid.jpg' },
        ],
        lists: [],
      };

      const result = normalizeGroceries(input);
      expect(result.value.catalog[0].imageUrl).toBeUndefined();
      expect(result.value.catalog[1].imageUrl).toBeUndefined();
      expect(result.value.catalog[2].imageUrl).toBe(
        'https://example.com/valid.jpg',
      );
      expect(result.changed).toBe(true);
    });

    it('should remove links array if any URL is invalid', () => {
      const input = {
        catalog: [
          { name: 'Item1', links: ['https://valid.com', 'not-a-url'] },
          {
            name: 'Item2',
            links: ['https://valid1.com', 'https://valid2.com'],
          },
        ],
        lists: [],
      };

      const result = normalizeGroceries(input);
      expect(result.value.catalog[0].links).toBeUndefined();
      expect(result.value.catalog[1].links).toEqual([
        'https://valid1.com',
        'https://valid2.com',
      ]);
      expect(result.changed).toBe(true);
    });

    it('should remove negative price', () => {
      const input = {
        catalog: [
          { name: 'Item1', price: -5 },
          { name: 'Item2', price: 0 },
          { name: 'Item3', price: 12.99 },
        ],
        lists: [],
      };

      const result = normalizeGroceries(input);
      expect(result.value.catalog[0].price).toBeUndefined();
      expect(result.value.catalog[1].price).toBe(0);
      expect(result.value.catalog[2].price).toBe(12.99);
      expect(result.changed).toBe(true);
    });

    it('should preserve optional notes field', () => {
      const input = {
        catalog: [{ name: 'Item1', notes: 'Some notes' }, { name: 'Item2' }],
        lists: [],
      };

      const result = normalizeGroceries(input);
      expect(result.value.catalog[0].notes).toBe('Some notes');
      expect(result.value.catalog[1].notes).toBeUndefined();
    });
  });

  describe('new shape: list line validation', () => {
    it('should drop list lines with missing catalogItemId', () => {
      const input = {
        catalog: [{ id: 'catalog-1', name: 'Item' }],
        lists: [
          {
            name: 'List',
            lines: [
              { checked: false },
              { catalogItemId: 'catalog-1', checked: true },
            ],
          },
        ],
      };

      const result = normalizeGroceries(input);
      expect(result.value.lists[0].lines).toHaveLength(1);
      expect(result.value.lists[0].lines[0].catalogItemId).toBe('catalog-1');
      expect(result.changed).toBe(true);
    });

    it('should drop list lines with invalid catalogItemId reference', () => {
      const input = {
        catalog: [{ id: 'catalog-1', name: 'Item' }],
        lists: [
          {
            name: 'List',
            lines: [
              { catalogItemId: 'catalog-1', checked: false },
              { catalogItemId: 'non-existent', checked: false },
              { catalogItemId: 'catalog-1', checked: true },
            ],
          },
        ],
      };

      const result = normalizeGroceries(input);
      expect(result.value.lists[0].lines).toHaveLength(2);
      expect(result.value.lists[0].lines[0].catalogItemId).toBe('catalog-1');
      expect(result.value.lists[0].lines[1].catalogItemId).toBe('catalog-1');
      expect(result.changed).toBe(true);
    });

    it('should default checked to false', () => {
      const input = {
        catalog: [{ id: 'catalog-1', name: 'Item' }],
        lists: [
          {
            name: 'List',
            lines: [
              { catalogItemId: 'catalog-1' },
              { catalogItemId: 'catalog-1', checked: true },
            ],
          },
        ],
      };

      const result = normalizeGroceries(input);
      expect(result.value.lists[0].lines[0].checked).toBe(false);
      expect(result.value.lists[0].lines[1].checked).toBe(true);
    });

    it('should preserve optional amount field', () => {
      const input = {
        catalog: [{ id: 'catalog-1', name: 'Item' }],
        lists: [
          {
            name: 'List',
            lines: [
              { catalogItemId: 'catalog-1', amount: '2 kg' },
              { catalogItemId: 'catalog-1' },
            ],
          },
        ],
      };

      const result = normalizeGroceries(input);
      expect(result.value.lists[0].lines[0].amount).toBe('2 kg');
      expect(result.value.lists[0].lines[1].amount).toBeUndefined();
    });

    it('should generate IDs and timestamps for list lines', () => {
      const input = {
        catalog: [{ id: 'catalog-1', name: 'Item' }],
        lists: [
          {
            name: 'List',
            lines: [{ catalogItemId: 'catalog-1' }],
          },
        ],
      };

      const result = normalizeGroceries(input);
      const line = result.value.lists[0].lines[0];
      expect(typeof line.id).toBe('string');
      expect(line.id.length).toBeGreaterThan(0);
      expect(line.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(line.updatedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.changed).toBe(true);
    });
  });

  describe('new shape: grocery list validation', () => {
    it('should drop list without name', () => {
      const input = {
        catalog: [{ id: 'catalog-1', name: 'Item' }],
        lists: [{ lines: [] }, { name: 'Valid List', lines: [] }],
      };

      const result = normalizeGroceries(input);
      expect(result.value.lists).toHaveLength(1);
      expect(result.value.lists[0].name).toBe('Valid List');
      expect(result.changed).toBe(true);
    });

    it('should drop list with empty name', () => {
      const input = {
        catalog: [],
        lists: [
          { name: '   ', lines: [] },
          { name: 'Valid List', lines: [] },
        ],
      };

      const result = normalizeGroceries(input);
      expect(result.value.lists).toHaveLength(1);
      expect(result.value.lists[0].name).toBe('Valid List');
      expect(result.changed).toBe(true);
    });

    it('should trim whitespace from list names', () => {
      const input = {
        catalog: [],
        lists: [{ name: '  Shopping List  ', lines: [] }],
      };

      const result = normalizeGroceries(input);
      expect(result.value.lists[0].name).toBe('Shopping List');
      expect(result.changed).toBe(true);
    });

    it('should handle lists with no lines', () => {
      const input = {
        catalog: [{ id: 'catalog-1', name: 'Item' }],
        lists: [{ name: 'Empty List' }],
      };

      const result = normalizeGroceries(input);
      expect(result.value.lists).toHaveLength(1);
      expect(result.value.lists[0].lines).toEqual([]);
    });
  });

  describe('legacy migration: array of lists with embedded items', () => {
    it('should migrate legacy array to catalog+lists structure', () => {
      const legacyInput = [
        {
          id: 'list-1',
          name: 'Weekly Shopping',
          items: [
            {
              id: 'item-1',
              name: 'Milk',
              amount: '1L',
              price: 3.5,
              category: 'dairy',
              checked: false,
              notes: 'Whole milk',
              imageUrl: 'https://example.com/milk.jpg',
              links: ['https://store.com/milk'],
              createdAt: '2025-12-01T00:00:00.000Z',
              updatedAt: '2025-12-01T00:00:00.000Z',
            },
          ],
          createdAt: '2025-12-01T00:00:00.000Z',
          updatedAt: '2025-12-01T00:00:00.000Z',
        },
      ];

      const result = normalizeGroceries(legacyInput);

      // Should have catalog entry
      expect(result.value.catalog).toHaveLength(1);
      const catalogItem = result.value.catalog[0];
      expect(catalogItem.name).toBe('Milk');
      expect(catalogItem.category).toBe('dairy');
      expect(catalogItem.price).toBe(3.5);
      expect(catalogItem.notes).toBe('Whole milk');
      expect(catalogItem.imageUrl).toBe('https://example.com/milk.jpg');
      expect(catalogItem.links).toEqual(['https://store.com/milk']);
      expect(catalogItem.createdAt).toBe('2025-12-01T00:00:00.000Z');
      expect(catalogItem.updatedAt).toBe('2025-12-01T00:00:00.000Z');

      // Should have list with line referencing catalog
      expect(result.value.lists).toHaveLength(1);
      const list = result.value.lists[0];
      expect(list.id).toBe('list-1');
      expect(list.name).toBe('Weekly Shopping');
      expect(list.lines).toHaveLength(1);

      const line = list.lines[0];
      expect(line.catalogItemId).toBe(catalogItem.id);
      expect(line.checked).toBe(false);
      expect(line.amount).toBe('1L');
      expect(line.createdAt).toBe('2025-12-01T00:00:00.000Z');
      expect(line.updatedAt).toBe('2025-12-01T00:00:00.000Z');

      expect(result.changed).toBe(true);
    });

    it('should deduplicate items across multiple lists by item.id', () => {
      const legacyInput = [
        {
          name: 'List 1',
          items: [
            { id: 'item-1', name: 'Milk', category: 'dairy', checked: false },
          ],
        },
        {
          name: 'List 2',
          items: [
            { id: 'item-1', name: 'Milk', category: 'dairy', checked: true },
            { id: 'item-2', name: 'Bread', category: 'bakery', checked: false },
          ],
        },
      ];

      const result = normalizeGroceries(legacyInput);

      // Should have 2 catalog items (item-1 and item-2)
      expect(result.value.catalog).toHaveLength(2);
      const milkCatalogId = result.value.catalog.find(
        (c) => c.name === 'Milk',
      )?.id;
      const breadCatalogId = result.value.catalog.find(
        (c) => c.name === 'Bread',
      )?.id;
      expect(milkCatalogId).toBeDefined();
      expect(breadCatalogId).toBeDefined();

      // List 1 should have 1 line referencing milk
      expect(result.value.lists[0].lines).toHaveLength(1);
      expect(result.value.lists[0].lines[0].catalogItemId).toBe(milkCatalogId);
      expect(result.value.lists[0].lines[0].checked).toBe(false);

      // List 2 should have 2 lines referencing milk and bread
      expect(result.value.lists[1].lines).toHaveLength(2);
      expect(result.value.lists[1].lines[0].catalogItemId).toBe(milkCatalogId);
      expect(result.value.lists[1].lines[0].checked).toBe(true);
      expect(result.value.lists[1].lines[1].catalogItemId).toBe(breadCatalogId);

      expect(result.changed).toBe(true);
    });

    it('should drop legacy items without name during migration', () => {
      const legacyInput = [
        {
          name: 'Shopping',
          items: [
            { id: 'item-1' }, // no name
            { id: 'item-2', name: 'Valid Item' },
          ],
        },
      ];

      const result = normalizeGroceries(legacyInput);

      expect(result.value.catalog).toHaveLength(1);
      expect(result.value.catalog[0].name).toBe('Valid Item');
      expect(result.value.lists[0].lines).toHaveLength(1);
      expect(result.changed).toBe(true);
    });

    it('should drop legacy lists without name during migration', () => {
      const legacyInput = [
        {
          items: [{ name: 'Item' }],
        },
        {
          name: 'Valid List',
          items: [{ name: 'Another Item' }],
        },
      ];

      const result = normalizeGroceries(legacyInput);

      expect(result.value.lists).toHaveLength(1);
      expect(result.value.lists[0].name).toBe('Valid List');
      expect(result.changed).toBe(true);
    });

    it('should apply all validation rules during legacy migration', () => {
      const legacyInput = [
        {
          name: 'Shopping',
          items: [
            {
              id: 'item-1',
              name: 'Item1',
              category: 'invalid',
              price: -5,
              imageUrl: 'not-a-url',
              links: ['https://valid.com', 'invalid'],
              checked: false,
            },
          ],
        },
      ];

      const result = normalizeGroceries(legacyInput);

      const catalogItem = result.value.catalog[0];
      expect(catalogItem.category).toBe('other');
      expect(catalogItem.price).toBeUndefined();
      expect(catalogItem.imageUrl).toBeUndefined();
      expect(catalogItem.links).toBeUndefined();
      expect(result.changed).toBe(true);
    });

    it('should generate timestamps for legacy items and lists missing them', () => {
      const legacyInput = [
        {
          name: 'Shopping',
          items: [{ name: 'Item' }],
        },
      ];

      const result = normalizeGroceries(legacyInput);

      const catalogItem = result.value.catalog[0];
      expect(catalogItem.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(catalogItem.updatedAt).toBe('2026-01-01T00:00:00.000Z');

      const list = result.value.lists[0];
      expect(list.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(list.updatedAt).toBe('2026-01-01T00:00:00.000Z');

      const line = list.lines[0];
      expect(line.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(line.updatedAt).toBe('2026-01-01T00:00:00.000Z');

      expect(result.changed).toBe(true);
    });

    it('should migrate empty legacy array to empty payload', () => {
      const result = normalizeGroceries([]);
      expect(result.value).toEqual({ catalog: [], lists: [] });
      expect(result.changed).toBe(true);
    });
  });

  describe('changed flag accuracy', () => {
    it('should mark changed: false for null/undefined', () => {
      expect(normalizeGroceries(null).changed).toBe(false);
      expect(normalizeGroceries(undefined).changed).toBe(false);
    });

    it('should mark changed: true for unrecognized shapes', () => {
      expect(normalizeGroceries({}).changed).toBe(true);
      expect(normalizeGroceries('string').changed).toBe(true);
      expect(normalizeGroceries(123).changed).toBe(true);
    });

    it('should mark changed: false for already-normalized new shape', () => {
      const input: GroceriesVaultPayload = {
        catalog: [
          {
            id: 'catalog-1',
            name: 'Item',
            category: 'other',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        lists: [
          {
            id: 'list-1',
            name: 'List',
            lines: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };
      expect(normalizeGroceries(input).changed).toBe(false);
    });

    it('should mark changed: true for new shape with missing IDs', () => {
      const input = {
        catalog: [{ name: 'Item' }],
        lists: [],
      };
      expect(normalizeGroceries(input).changed).toBe(true);
    });

    it('should mark changed: true for new shape with invalid entries dropped', () => {
      const input = {
        catalog: [{ name: 'Valid' }, { id: 'no-name' }],
        lists: [],
      };
      expect(normalizeGroceries(input).changed).toBe(true);
    });

    it('should mark changed: true for new shape with coerced values', () => {
      const input = {
        catalog: [{ name: 'Item', category: 'invalid' }],
        lists: [],
      };
      expect(normalizeGroceries(input).changed).toBe(true);
    });

    it('should mark changed: true for legacy migration', () => {
      const input = [
        {
          name: 'List',
          items: [{ name: 'Item', category: 'dairy', checked: false }],
        },
      ];
      expect(normalizeGroceries(input).changed).toBe(true);
    });
  });

  describe('complex multi-list scenarios', () => {
    it('should handle multiple catalog items and lists with cross-references', () => {
      const input = {
        catalog: [
          { id: 'cat-1', name: 'Milk', category: 'dairy' },
          { id: 'cat-2', name: 'Bread', category: 'bakery' },
          { id: 'cat-3', name: 'Apples', category: 'produce' },
        ],
        lists: [
          {
            name: 'Weekly',
            lines: [
              { catalogItemId: 'cat-1', checked: false },
              { catalogItemId: 'cat-2', checked: true },
            ],
          },
          {
            name: 'Daily',
            lines: [
              { catalogItemId: 'cat-1', checked: false, amount: '2L' },
              { catalogItemId: 'cat-3', checked: false, amount: '1 kg' },
            ],
          },
        ],
      };

      const result = normalizeGroceries(input);

      expect(result.value.catalog).toHaveLength(3);
      expect(result.value.lists).toHaveLength(2);
      expect(result.value.lists[0].lines).toHaveLength(2);
      expect(result.value.lists[1].lines).toHaveLength(2);

      // Verify catalog item can be referenced by multiple lists
      expect(result.value.lists[0].lines[0].catalogItemId).toBe('cat-1');
      expect(result.value.lists[1].lines[0].catalogItemId).toBe('cat-1');
    });

    it('should filter out lines referencing deleted catalog items', () => {
      const input = {
        catalog: [
          { id: 'cat-1', name: 'Milk' },
          { id: 'cat-2' }, // no name, will be dropped
        ],
        lists: [
          {
            name: 'Shopping',
            lines: [
              { catalogItemId: 'cat-1', checked: false },
              { catalogItemId: 'cat-2', checked: false }, // ref to dropped item
            ],
          },
        ],
      };

      const result = normalizeGroceries(input);

      expect(result.value.catalog).toHaveLength(1);
      expect(result.value.lists[0].lines).toHaveLength(1);
      expect(result.value.lists[0].lines[0].catalogItemId).toBe('cat-1');
      expect(result.changed).toBe(true);
    });
  });
});
