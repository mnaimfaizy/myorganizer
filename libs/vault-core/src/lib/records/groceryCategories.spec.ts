import {
  GROCERY_CATEGORY_ORDER,
  GROCERY_CATEGORY_LABELS,
  GROCERY_CATEGORY_EMOJIS,
  groceryCategoryLabel,
  groceryCategoryEmoji,
} from './groceryCategories';
import { GROCERY_PREDEFINED_CATEGORIES } from './grocery';

describe('groceryCategories', () => {
  describe('GROCERY_CATEGORY_ORDER', () => {
    it('contains every member of GROCERY_PREDEFINED_CATEGORIES exactly once', () => {
      const predefined = new Set(GROCERY_PREDEFINED_CATEGORIES);
      const order = new Set(GROCERY_CATEGORY_ORDER);

      expect(order.size).toBe(predefined.size);
      for (const category of predefined) {
        expect(GROCERY_CATEGORY_ORDER).toContain(category);
      }
    });

    it('has the shop-walk order: produce, dairy, meat, seafood, bakery, frozen, beverages, snacks, condiments, household, personal-care, other', () => {
      expect(GROCERY_CATEGORY_ORDER).toEqual([
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
      ]);
    });
  });

  describe('GROCERY_CATEGORY_LABELS', () => {
    it('has a non-empty entry for every member of GROCERY_PREDEFINED_CATEGORIES', () => {
      for (const category of GROCERY_PREDEFINED_CATEGORIES) {
        expect(GROCERY_CATEGORY_LABELS[category]).toBeDefined();
        expect(typeof GROCERY_CATEGORY_LABELS[category]).toBe('string');
        expect(GROCERY_CATEGORY_LABELS[category].length).toBeGreaterThan(0);
      }
    });

    it('labels personal-care as "Personal Care"', () => {
      expect(GROCERY_CATEGORY_LABELS['personal-care']).toBe('Personal Care');
    });
  });

  describe('GROCERY_CATEGORY_EMOJIS', () => {
    it('has a non-empty entry for every member of GROCERY_PREDEFINED_CATEGORIES', () => {
      for (const category of GROCERY_PREDEFINED_CATEGORIES) {
        expect(GROCERY_CATEGORY_EMOJIS[category]).toBeDefined();
        expect(typeof GROCERY_CATEGORY_EMOJIS[category]).toBe('string');
        expect(GROCERY_CATEGORY_EMOJIS[category].length).toBeGreaterThan(0);
      }
    });
  });

  describe('groceryCategoryLabel', () => {
    it('returns the label for every predefined category', () => {
      expect(groceryCategoryLabel('produce')).toBe('Produce');
      expect(groceryCategoryLabel('dairy')).toBe('Dairy');
      expect(groceryCategoryLabel('meat')).toBe('Meat');
      expect(groceryCategoryLabel('household')).toBe('Household');
      expect(groceryCategoryLabel('personal-care')).toBe('Personal Care');
    });

    it('falls back to "Other" for unrecognised category', () => {
      // Now that the parameter accepts `string & {}`, unrecognised strings compile
      expect(groceryCategoryLabel('unknown')).toBe('Other');
    });

    it('falls back to "Other" for undefined', () => {
      // @ts-expect-error value from decrypted JSON is untyped
      expect(groceryCategoryLabel(undefined)).toBe('Other');
    });

    it('falls back to "Other" for null', () => {
      // @ts-expect-error value from decrypted JSON is untyped
      expect(groceryCategoryLabel(null)).toBe('Other');
    });
  });

  describe('groceryCategoryEmoji', () => {
    it('returns the emoji for every predefined category', () => {
      expect(groceryCategoryEmoji('produce')).toBe('🥬');
      expect(groceryCategoryEmoji('dairy')).toBe('🥛');
      expect(groceryCategoryEmoji('meat')).toBe('🍖');
      expect(groceryCategoryEmoji('household')).toBe('🏠');
      expect(groceryCategoryEmoji('personal-care')).toBe('🧼');
    });

    it('falls back to "📦" for unrecognised category', () => {
      // Now that the parameter accepts `string & {}`, unrecognised strings compile
      expect(groceryCategoryEmoji('unknown')).toBe('📦');
    });

    it('falls back to "📦" for undefined', () => {
      // @ts-expect-error value from decrypted JSON is untyped
      expect(groceryCategoryEmoji(undefined)).toBe('📦');
    });

    it('falls back to "📦" for null', () => {
      // @ts-expect-error value from decrypted JSON is untyped
      expect(groceryCategoryEmoji(null)).toBe('📦');
    });
  });
});
