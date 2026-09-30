import type { GroceryCategoryType } from './grocery';

/**
 * The one shopping order for grocery categories, shared by every client.
 *
 * It is a shop walk, not an alphabet: produce first, freezer and household
 * last, because that is the order the aisles come in and a trip view that
 * ignores it sends the User back across the shop. The web groceries page and
 * the Mobile App trip view both read this — it lived in the web page library
 * until the Mobile App needed it, and two copies of an order are two orders.
 *
 * Every member of `GROCERY_PREDEFINED_CATEGORIES` appears exactly once;
 * `groceryCategories.spec.ts` is what asserts that, because an array can omit
 * a member and still compile.
 */
export const GROCERY_CATEGORY_ORDER: readonly GroceryCategoryType[] = [
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

/**
 * What each category is called in the interface.
 *
 * Annotated `Record<GroceryCategoryType, string>` rather than inferred, so a
 * thirteenth category cannot be added to the vocabulary without a label: the
 * annotation fails to compile on a missing key, where an inferred object
 * would happily render `undefined`.
 */
export const GROCERY_CATEGORY_LABELS: Record<GroceryCategoryType, string> = {
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

/** The glyph each category is shown with. Decorative, never the only cue. */
export const GROCERY_CATEGORY_EMOJIS: Record<GroceryCategoryType, string> = {
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

/**
 * A category's label, falling back to `Other` for anything unrecognised.
 *
 * The fallback is not defensive clutter, and the widened parameter is what
 * makes it reachable: a category arrives out of decrypted JSON, so a
 * `CatalogItem.category` typed `GroceryCategoryType` is a claim rather than a
 * fact. A Catalog Item written by a later build — or a corrupted one — must
 * render as a row the User can still tick, not as `undefined`. Typed to the
 * union alone, the branch below would be code no caller could ever enter and
 * no test could reach without lying to the compiler.
 *
 * The `(string & {})` arm keeps the twelve members offered as completions
 * while still accepting a string that is not one of them.
 */
export function groceryCategoryLabel(
  category: GroceryCategoryType | (string & {}),
): string {
  return GROCERY_CATEGORY_LABELS[category as GroceryCategoryType] ?? 'Other';
}

/** A category's glyph, falling back to the `other` box for the same reason. */
export function groceryCategoryEmoji(
  category: GroceryCategoryType | (string & {}),
): string {
  return GROCERY_CATEGORY_EMOJIS[category as GroceryCategoryType] ?? '📦';
}
