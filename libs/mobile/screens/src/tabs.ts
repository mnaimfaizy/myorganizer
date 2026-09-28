/**
 * The Mobile App's five tabs, in the order they appear in the tab bar.
 *
 * This list is the tab vocabulary: the navigator's param list, the screen
 * table, and the validation of a last used tab read back out of the Device
 * Settings are all derived from it rather than restating it (ADR 0053).
 */
export const TAB_NAMES = [
  'Groceries',
  'Tasks',
  'Subscriptions',
  'Details',
  'Account',
] as const;

export type TabName = (typeof TAB_NAMES)[number];

/** No tab takes params; a tab's own stack owns anything that does. */
export type MainTabParamList = Record<TabName, undefined>;

/**
 * The tab opened when nothing else says otherwise — a first launch, or a
 * stored tab this build no longer has.
 */
export const DEFAULT_TAB: TabName = 'Tasks';

/**
 * Whether a string stored by an earlier build is still a tab in this one.
 *
 * The Device Settings store holds the last used tab as a plain string on
 * purpose: a name that was valid when it was written must not crash the app
 * that reads it back after a tab is renamed or removed.
 */
export function isTabName(value: string | null | undefined): value is TabName {
  return value != null && (TAB_NAMES as readonly string[]).includes(value);
}
