import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { EmptyState, OfflineBanner, Screen } from '@myorganizer/mobile/ui';
import { TAB_SCREEN_EDGES, TabScreenHeader } from './TabScreenHeader';
import { useRememberedScroll } from './useRememberedScroll';

export interface PlaceholderScreenProps {
  title: string;
  /** What this tab will do, in one sentence. Not a promise about when. */
  description: string;
}

/**
 * A tab that exists in the shell before its feature does. It says which tab it
 * is and what will live here, rather than showing an empty screen the User
 * cannot tell from a failure to load.
 *
 * The content sits in a scroll view even though it is short, because on iOS
 * the scroll view is what clears the native large-title header; without it the
 * offline banner would appear under the navigation bar.
 */
export function PlaceholderScreen({
  title,
  description,
}: PlaceholderScreenProps): React.JSX.Element {
  const rememberedScroll = useRememberedScroll(title);

  return (
    <Screen edges={TAB_SCREEN_EDGES}>
      <TabScreenHeader title={title} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...rememberedScroll}
      >
        <OfflineBanner />
        <EmptyState title="Coming soon" description={description} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});
