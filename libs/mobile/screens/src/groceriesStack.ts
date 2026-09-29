import type { TabName } from './tabs';

/**
 * The Groceries tab, named out of the one tab vocabulary rather than as a
 * loose string. Renaming the tab makes this `never`, and every route name
 * derived from it below stops matching — which is the point.
 */
type GroceriesTab = Extract<TabName, 'Groceries'>;

/**
 * The Groceries tab's own navigation stack.
 *
 * Each tab owns a stack (see `MainTabs`), so pushing the trip view leaves the
 * other tabs where they were and the tab bar stays visible over it. The home
 * screen's key is built from the tab name with the same `${name}Home` shape
 * `tabStack` registers, so the two cannot be spelled differently.
 */
export type GroceriesStackParamList = {
  [Home in `${GroceriesTab}Home`]: undefined;
} & {
  /** One Grocery List, arranged for the shop. */
  GroceryTrip: { listId: string };
};

/**
 * The route names, in one place.
 *
 * A pushed screen is named three times — where it is registered, where it is
 * navigated to, and where it reads its params — and React Navigation checks
 * none of them against each other once the navigator's param list is widened
 * to take screens from a table. The `satisfies` clause is what does: a name
 * that is not a key of `GroceriesStackParamList` fails to compile here, so a
 * typo cannot reach a device as an undefined `listId`.
 */
export const GROCERIES_ROUTES = {
  home: 'GroceriesHome',
  trip: 'GroceryTrip',
} as const satisfies Record<string, keyof GroceriesStackParamList>;
