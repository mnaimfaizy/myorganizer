import type { GroceryCategoryType } from '@myorganizer/core';

import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getCategoryEmoji,
  getCategoryLabel,
} from '../categories';

const EXPECTED_CATEGORIES = [
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
] as const;

const EXPECTED_EMOJIS: Record<string, string> = {
  produce: '🥬',
  dairy: '🥛',
  meat: '🍖',
  seafood: '🦞',
  bakery: '🍞',
  frozen: '🧊',
  beverages: '🧃',
  snacks: '🍿',
  condiments: '🧂',
  household: '🏠',
  'personal-care': '🧼',
  other: '📦',
};

const EXPECTED_LABELS: Record<string, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat',
  seafood: 'Seafood',
  bakery: 'Bakery',
  frozen: 'Frozen',
  beverages: 'Beverages',
  snacks: 'Snacks',
  condiments: 'Condiments',
  household: 'Household',
  'personal-care': 'Personal Care',
  other: 'Other',
};

const emojiRegex = /\p{Extended_Pictographic}/u;

describe('groceries categories constants and helpers', () => {
  describe('CATEGORY_EMOJIS', () => {
    it('has exactly 12 entries and includes all expected categories', () => {
      const keys = Object.keys(CATEGORY_EMOJIS).sort();
      const expected = Array.from(EXPECTED_CATEGORIES).sort();
      expect(keys).toEqual(expected);
      expect(keys.length).toBe(12);
    });

    it('contains the correct emoji for each category', () => {
      for (const cat of EXPECTED_CATEGORIES) {
        expect(CATEGORY_EMOJIS[cat]).toBe(EXPECTED_EMOJIS[cat]);
      }
    });

    it('each emoji is a non-empty emoji string and contains at least one emoji glyph', () => {
      const values = Object.values(CATEGORY_EMOJIS);
      for (const v of values) {
        expect(typeof v).toBe('string');
        expect(v.trim().length).toBeGreaterThan(0);
        expect(emojiRegex.test(v)).toBe(true);
      }
    });

    it('has no duplicate or empty values', () => {
      const values = Object.values(CATEGORY_EMOJIS);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
      expect(values.every((v) => v !== '')).toBe(true);
    });
  });

  describe('CATEGORY_LABELS', () => {
    it('has exactly 12 entries and includes all expected categories', () => {
      const keys = Object.keys(CATEGORY_LABELS).sort();
      const expected = Array.from(EXPECTED_CATEGORIES).sort();
      expect(keys).toEqual(expected);
      expect(keys.length).toBe(12);
    });

    it('contains the correct label for each category and proper capitalization', () => {
      for (const cat of EXPECTED_CATEGORIES) {
        const actual = CATEGORY_LABELS[cat];
        const expected = EXPECTED_LABELS[cat];
        expect(actual).toBe(expected);
        // Check capitalization for each space-separated word
        const capitalized = actual
          .split(' ')
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
          .join(' ');
        expect(actual).toBe(capitalized);
      }
    });

    it("hyphenated category 'personal-care' displays as 'Personal Care'", () => {
      expect(CATEGORY_LABELS['personal-care']).toBe('Personal Care');
    });
  });

  describe('getCategoryEmoji', () => {
    it('returns correct emoji for known categories', () => {
      expect(getCategoryEmoji('produce' as any)).toBe('🥬');
      expect(getCategoryEmoji('dairy' as any)).toBe('🥛');
      expect(getCategoryEmoji('personal-care' as any)).toBe('🧼');
      expect(getCategoryEmoji('other' as any)).toBe('📦');
    });

    it('returns correct emoji for all 12 categories', () => {
      for (const [cat, emoji] of Object.entries(CATEGORY_EMOJIS)) {
        expect(getCategoryEmoji(cat as any)).toBe(emoji);
      }
    });

    it("returns fallback '📦' for unknown, undefined, or null input", () => {
      expect(getCategoryEmoji('not-a-category' as any)).toBe('📦');
      expect(getCategoryEmoji(undefined as any)).toBe('📦');
      expect(getCategoryEmoji(null as any)).toBe('📦');
    });
  });

  describe('getCategoryLabel', () => {
    it('returns correct label for known categories', () => {
      expect(getCategoryLabel('produce' as any)).toBe('Produce');
      expect(getCategoryLabel('dairy' as any)).toBe('Dairy');
      expect(getCategoryLabel('personal-care' as any)).toBe('Personal Care');
      expect(getCategoryLabel('other' as any)).toBe('Other');
    });

    it('returns correct label for all 12 categories', () => {
      for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
        expect(getCategoryLabel(cat as any)).toBe(label);
      }
    });

    it("returns fallback 'Other' for unknown, undefined, or null input", () => {
      expect(getCategoryLabel('not-a-category' as any)).toBe('Other');
      expect(getCategoryLabel(undefined as any)).toBe('Other');
      expect(getCategoryLabel(null as any)).toBe('Other');
    });
  });

  describe('CATEGORY_ORDER', () => {
    it('contains all 12 categories in the expected order', () => {
      expect(CATEGORY_ORDER).toEqual(Array.from(EXPECTED_CATEGORIES));
      expect(CATEGORY_ORDER.length).toBe(12);
    });

    it('has no duplicates', () => {
      expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
    });

    it('is typed as GroceryCategoryType[] (compile-time check)', () => {
      // This assignment enforces the TypeScript type at compile time.
      const _typed: GroceryCategoryType[] = CATEGORY_ORDER;
      void _typed;
    });
  });
});
