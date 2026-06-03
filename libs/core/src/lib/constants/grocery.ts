export const GROCERY_PREDEFINED_CATEGORIES = [
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

export type GroceryCategoryType =
  (typeof GROCERY_PREDEFINED_CATEGORIES)[number];

export interface GroceryItem {
  id: string; // UUID v4
  name: string; // Required
  amount?: string; // Free text, e.g. "2", "500g", "1 dozen"
  price?: number; // Optional — for budget tracking (in user's local currency)
  category: GroceryCategoryType; // Defaults to 'other'
  checked: boolean; // Shopping-list checked state
  notes?: string; // Optional free text notes
  imageUrl?: string; // Optional external image URL (display only, no uploads)
  links?: string[]; // Optional array of external links
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface GroceryList {
  id: string; // UUID v4
  name: string; // Required, user-defined list name
  items: GroceryItem[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
