import React from 'react';
import { Platform } from 'react-native';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import { LargeTitleHeader } from '@myorganizer/mobile/ui';

/**
 * The safe-area edges a tab screen's root takes.
 *
 * The tab bar owns the bottom inset, so no tab screen takes it again —
 * insetting twice leaves a visible gap above the bar. The top follows the
 * title rule below: on Android the screen draws its own header and insets
 * above it; on iOS the native large-title header sits over the screen, and
 * the screen's scroll view clears it with `contentInsetAdjustmentBehavior`
 * rather than a padding that only knows the status bar's height. A screen
 * that insets its top on iOS puts its first row under the navigation bar,
 * where the bar takes every tap.
 */
export const TAB_SCREEN_EDGES =
  Platform.OS === 'ios'
    ? (['left', 'right'] as const)
    : (['top', 'left', 'right'] as const);

/**
 * The safe-area edges a screen pushed inside a tab takes.
 *
 * It has a native header on both platforms — the stack draws one with a back
 * affordance, which is the way back out of it — so it never insets its own
 * top, and the tab bar still owns the bottom.
 */
export const STACK_SCREEN_EDGES = ['left', 'right'] as const;

export interface TabScreenHeaderProps {
  title: string;
  /** An extra control before Lock — a tab's own header action, e.g. Groceries' "New list". */
  trailing?: React.ReactNode;
}

/**
 * A tab screen's title, on the platform that needs one drawn.
 *
 * iOS gets its large title from the native stack — it collapses into the
 * navigation bar on scroll, which cannot be reproduced in JavaScript — so this
 * renders nothing there and the header options in `MainTabs` supply the title
 * and the Lock action instead. Android's native stack has no large title, so
 * the header is drawn here. Lock is the trailing action on both.
 *
 * The decision lives in this one component rather than in each screen, so a
 * screen added later cannot get it half right.
 */
export function TabScreenHeader({
  title,
  trailing,
}: TabScreenHeaderProps): React.JSX.Element | null {
  const { lock } = useVaultSession();

  if (Platform.OS === 'ios') return null;

  return (
    <LargeTitleHeader
      title={title}
      trailing={trailing}
      onLock={() => lock('manual')}
    />
  );
}
