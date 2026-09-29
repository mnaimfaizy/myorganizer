import {
  GROCERY_CATEGORY_ORDER,
  type GroceryCategoryType,
} from '@myorganizer/vault-core';

/**
 * The grocery category vocabulary, as this page library has always named it.
 *
 * The values themselves live in `@myorganizer/vault-core` so that the Mobile
 * App's trip view groups by the same order and prints the same labels — two
 * copies of a shop order are two shop orders. This module is the web's own
 * spelling of those exports and nothing more; nothing here decides anything.
 */
export {
  GROCERY_CATEGORY_EMOJIS as CATEGORY_EMOJIS,
  GROCERY_CATEGORY_LABELS as CATEGORY_LABELS,
  groceryCategoryEmoji as getCategoryEmoji,
  groceryCategoryLabel as getCategoryLabel,
} from '@myorganizer/vault-core';

/**
 * A copy rather than a re-export, because the shared order is `readonly` and
 * this page library's callers pass it where a mutable `GroceryCategoryType[]`
 * is expected. It is built from the shared order at module load, so it cannot
 * drift from it.
 */
export const CATEGORY_ORDER: GroceryCategoryType[] = [
  ...GROCERY_CATEGORY_ORDER,
];
