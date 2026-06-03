import { normalizeGroceries } from './groceriesNormalization';

describe('normalizeGroceries', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('null/undefined input', () => {
    it('should return empty list for null without marking changed', () => {
      expect(normalizeGroceries(null)).toEqual({ value: [], changed: false });
    });

    it('should return empty list for undefined without marking changed', () => {
      expect(normalizeGroceries(undefined)).toEqual({
        value: [],
        changed: false,
      });
    });
  });

  describe('non-array input', () => {
    it('should return empty list for non-array and mark changed', () => {
      expect(normalizeGroceries({})).toEqual({ value: [], changed: true });
      expect(normalizeGroceries('string')).toEqual({
        value: [],
        changed: true,
      });
      expect(normalizeGroceries(123)).toEqual({ value: [], changed: true });
    });
  });

  describe('empty array', () => {
    it('should return empty array without marking changed', () => {
      expect(normalizeGroceries([])).toEqual({ value: [], changed: false });
    });
  });

  describe('valid GroceryList', () => {
    it('should preserve exact normalized data without marking changed', () => {
      const input = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Weekly Shopping',
          items: [
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              name: 'Milk',
              amount: '1L',
              price: 3.5,
              category: 'dairy',
              checked: false,
              notes: 'Whole milk',
              imageUrl: 'https://example.com/milk.jpg',
              links: ['https://store.com/milk'],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const result = normalizeGroceries(input);
      expect(result.value).toEqual(input);
      expect(result.changed).toBe(false);
    });
  });

  describe('item missing required fields', () => {
    it('should generate id for item without id', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Weekly Shopping',
          items: [{ name: 'Apples' }],
        },
      ]);

      expect(res.value).toHaveLength(1);
      expect(res.value[0].items).toHaveLength(1);
      expect(typeof res.value[0].items[0].id).toBe('string');
      expect(res.changed).toBe(true);
    });

    it('should reject item without name and drop it', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Weekly Shopping',
          items: [{ id: '550e8400-e29b-41d4-a716-446655440001' }],
        },
      ]);

      expect(res.value).toHaveLength(1);
      expect(res.value[0].items).toHaveLength(0);
      expect(res.changed).toBe(true);
    });
  });

  describe('category validation and coercion', () => {
    it('should coerce invalid category to "other"', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              category: 'invalid_category',
            },
          ],
        },
      ]);

      expect(res.value[0].items[0].category).toBe('other');
      expect(res.changed).toBe(true);
    });

    it('should use default category "other" when not specified', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [{ name: 'Item' }],
        },
      ]);

      expect(res.value[0].items[0].category).toBe('other');
      expect(res.changed).toBe(true);
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

      for (const category of categories) {
        const res = normalizeGroceries([
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Shopping',
            items: [{ name: 'Item', category }],
          },
        ]);

        expect(res.value[0].items[0].category).toBe(category);
      }
    });
  });

  describe('checked field defaults', () => {
    it('should default checked to false when not specified', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [{ name: 'Item' }],
        },
      ]);

      expect(res.value[0].items[0].checked).toBe(false);
      expect(res.changed).toBe(true);
    });

    it('should preserve checked value when specified', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [{ name: 'Item', checked: true }],
        },
      ]);

      expect(res.value[0].items[0].checked).toBe(true);
      expect(res.changed).toBe(true);
    });
  });

  describe('optional field handling', () => {
    it('should remove invalid imageUrl (non-URL string)', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              imageUrl: 'not-a-url',
            },
          ],
        },
      ]);

      expect(res.value[0].items[0].imageUrl).toBeUndefined();
      expect(res.changed).toBe(true);
    });

    it('should convert empty string imageUrl to undefined', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              imageUrl: '',
            },
          ],
        },
      ]);

      expect(res.value[0].items[0].imageUrl).toBeUndefined();
      expect(res.changed).toBe(true);
    });

    it('should preserve valid imageUrl', () => {
      const url = 'https://example.com/image.jpg';
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              imageUrl: url,
            },
          ],
        },
      ]);

      expect(res.value[0].items[0].imageUrl).toBe(url);
    });

    it('should validate links as URL arrays', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              links: ['https://example.com', 'not-a-url'],
            },
          ],
        },
      ]);

      // Should reject the entire links array if any URL is invalid
      expect(res.value[0].items[0].links).toBeUndefined();
      expect(res.changed).toBe(true);
    });

    it('should preserve valid links array', () => {
      const links = ['https://example.com', 'https://store.com'];
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              links,
            },
          ],
        },
      ]);

      expect(res.value[0].items[0].links).toEqual(links);
    });
  });

  describe('price validation', () => {
    it('should reject negative price', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              price: -5,
            },
          ],
        },
      ]);

      expect(res.value[0].items[0].price).toBeUndefined();
      expect(res.changed).toBe(true);
    });

    it('should accept zero price', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              price: 0,
            },
          ],
        },
      ]);

      expect(res.value[0].items[0].price).toBe(0);
    });

    it('should accept positive price', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              price: 12.99,
            },
          ],
        },
      ]);

      expect(res.value[0].items[0].price).toBe(12.99);
    });
  });

  describe('timestamps', () => {
    it('should generate ISO 8601 timestamps for missing fields', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [{ name: 'Item' }],
        },
      ]);

      expect(res.value[0].items[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(res.value[0].items[0].updatedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(res.changed).toBe(true);
    });

    it('should preserve valid ISO 8601 timestamps', () => {
      const timestamp = '2025-12-31T12:30:45.000Z';
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        },
      ]);

      expect(res.value[0].items[0].createdAt).toBe(timestamp);
      expect(res.value[0].items[0].updatedAt).toBe(timestamp);
    });
  });

  describe('multiple items and lists', () => {
    it('should handle multiple lists with multiple items', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Weekly Shopping',
          items: [
            { name: 'Milk', category: 'dairy' },
            { name: 'Bread', category: 'bakery' },
          ],
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Dinner Planning',
          items: [{ name: 'Chicken', category: 'meat' }],
        },
      ]);

      expect(res.value).toHaveLength(2);
      expect(res.value[0].items).toHaveLength(2);
      expect(res.value[1].items).toHaveLength(1);
      expect(res.changed).toBe(true);
    });
  });

  describe('item-by-item recovery', () => {
    it('should drop invalid lists and keep valid ones', () => {
      const res = normalizeGroceries([
        null,
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [{ name: 'Item' }],
        },
        'invalid',
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Another List',
          items: [{ name: 'Another Item' }],
        },
      ]);

      expect(res.value).toHaveLength(2);
      expect(res.changed).toBe(true);
    });

    it('should drop list without name', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          items: [{ name: 'Item' }],
        },
      ]);

      expect(res.value).toHaveLength(0);
      expect(res.changed).toBe(true);
    });
  });

  describe('unknown fields', () => {
    it('should strip unknown extra fields from items and mark changed', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [
            {
              name: 'Item',
              unknownField: 'should be removed',
              anotherUnknown: 123,
            },
          ],
        },
      ]);

      const item = res.value[0].items[0];
      expect('unknownField' in item).toBe(false);
      expect('anotherUnknown' in item).toBe(false);
      expect(res.changed).toBe(true);
    });

    it('should strip unknown fields from lists and mark changed', () => {
      const res = normalizeGroceries([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Shopping',
          items: [],
          unknownListField: 'should be removed',
        },
      ]);

      const list = res.value[0];
      expect('unknownListField' in list).toBe(false);
      expect(res.changed).toBe(true);
    });
  });

  describe('complex scenarios', () => {
    it('should normalize all defaults for minimal input', () => {
      const res = normalizeGroceries([
        {
          name: 'Minimal List',
          items: [{ name: 'Apples' }],
        },
      ]);

      expect(res.value).toHaveLength(1);
      const list = res.value[0];
      expect(typeof list.id).toBe('string');
      expect(list.name).toBe('Minimal List');
      expect(list.items).toHaveLength(1);
      expect(typeof list.createdAt).toBe('string');
      expect(typeof list.updatedAt).toBe('string');

      const item = list.items[0];
      expect(typeof item.id).toBe('string');
      expect(item.name).toBe('Apples');
      expect(item.category).toBe('other');
      expect(item.checked).toBe(false);
      expect(item.amount).toBeUndefined();
      expect(item.price).toBeUndefined();
      expect(item.notes).toBeUndefined();
      expect(item.imageUrl).toBeUndefined();
      expect(item.links).toBeUndefined();

      expect(res.changed).toBe(true);
    });
  });
});
