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

/**
 * CatalogItem — Durable grocery identity owned by the user.
 * Lives in the vault catalog; referenced by multiple ListLines.
 */
export interface CatalogItem {
  id: string; // UUID v4
  name: string; // Required
  category: GroceryCategoryType; // Defaults to 'other'
  price?: number; // Optional default price for budget tracking
  notes?: string; // Optional free text notes
  imageUrl?: string; // Optional external image URL (display only, no uploads)
  links?: string[]; // Optional array of external links
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * ListLine — A grocery list's reference to a CatalogItem for a trip.
 * Carries trip-local state (checked, quantity/amount).
 */
export interface ListLine {
  id: string; // UUID v4 — unique line ID
  catalogItemId: string; // Reference to CatalogItem.id
  checked: boolean; // Checked state for this trip
  amount?: string; // Trip-specific quantity, e.g. "2", "500g", "1 dozen"
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * GroceryList — A named trip-oriented collection of ListLines.
 */
export interface GroceryList {
  id: string; // UUID v4
  name: string; // Required, user-defined list name
  lines: ListLine[]; // References to catalog items
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * GroceriesVaultPayload — The complete vault payload for groceries.
 * Separates durable catalog from trip-oriented lists.
 */
export interface GroceriesVaultPayload {
  catalog: CatalogItem[];
  lists: GroceryList[];
}

/**
 * @deprecated Use CatalogItem and ListLine instead.
 * Kept for backward compatibility during migration.
 */
export interface GroceryItem {
  id: string;
  name: string;
  amount?: string;
  price?: number;
  category: GroceryCategoryType;
  checked: boolean;
  notes?: string;
  imageUrl?: string;
  links?: string[];
  createdAt: string;
  updatedAt: string;
}
