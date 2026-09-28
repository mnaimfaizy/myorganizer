import React from 'react';
import { EmptyState, OfflineBanner, Screen } from '@myorganizer/mobile/ui';
import { TabScreenHeader } from './TabScreenHeader';

export interface PlaceholderScreenProps {
  title: string;
  /** What this tab will do, in one sentence. Not a promise about when. */
  description: string;
}

/**
 * The tab bar owns the bottom inset, so a screen inside a tab does not take it
 * again — insetting twice leaves a visible gap above the bar.
 */
const SCREEN_EDGES = ['top', 'left', 'right'] as const;

/**
 * A tab that exists in the shell before its feature does. It says which tab it
 * is and what will live here, rather than showing an empty screen the User
 * cannot tell from a failure to load.
 */
export function PlaceholderScreen({
  title,
  description,
}: PlaceholderScreenProps): React.JSX.Element {
  return (
    <Screen edges={SCREEN_EDGES}>
      <TabScreenHeader title={title} />
      <OfflineBanner />
      <EmptyState title="Coming soon" description={description} />
    </Screen>
  );
}
