import type { GroceryCategoryType } from '@myorganizer/core';

export const CATEGORY_EMOJIS: Record<GroceryCategoryType, string> = {
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

export const CATEGORY_LABELS: Record<GroceryCategoryType, string> = {
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

export function getCategoryEmoji(category: GroceryCategoryType): string {
  return CATEGORY_EMOJIS[category] ?? '📦';
}

export function getCategoryLabel(category: GroceryCategoryType): string {
  return CATEGORY_LABELS[category] ?? 'Other';
}

export const CATEGORY_ORDER: GroceryCategoryType[] = [
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
