import type { IconName } from '@myorganizer/mobile/ui';

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

/** What the tab bar prints and draws for one tab. */
export interface TabMeta {
  /**
   * The name printed under the icon. The full name, never an abbreviation:
   * the bar is sized so that all five fit at the default text size, and a
   * truncated label is what the interim bar shipped in #909.
   */
  label: string;
  icon: IconName;
}

/**
 * The bar's own vocabulary, pinned to the tab list so a tab cannot be added
 * without a label and a glyph. Without the pin a new tab renders as a nameless
 * gap, which is what an absent `tabBarIcon` did to all five in #909.
 */
export const TAB_META = {
  Groceries: { label: 'Groceries', icon: 'groceries' },
  Tasks: { label: 'Tasks', icon: 'tasks' },
  Subscriptions: { label: 'Subscriptions', icon: 'subscriptions' },
  Details: { label: 'Details', icon: 'details' },
  Account: { label: 'Account', icon: 'account' },
} as const satisfies Record<TabName, TabMeta>;

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
