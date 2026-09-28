import React from 'react';
import { Platform } from 'react-native';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import { LargeTitleHeader } from '@myorganizer/mobile/ui';

export interface TabScreenHeaderProps {
  title: string;
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
}: TabScreenHeaderProps): React.JSX.Element | null {
  const { lock } = useVaultSession();

  if (Platform.OS === 'ios') return null;

  return <LargeTitleHeader title={title} onLock={lock} />;
}
