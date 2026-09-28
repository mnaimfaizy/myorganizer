import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenContainer, ThemedText, useTheme } from '@myorganizer/mobile/ui';

export interface PlaceholderScreenProps {
  title: string;
  /** What this tab will do, in one sentence. Not a promise about when. */
  description: string;
}

/**
 * A tab that exists in the shell before its feature does. It says which tab it
 * is and what will live here, rather than showing an empty screen the User
 * cannot tell from a failure to load.
 */
export function PlaceholderScreen({
  title,
  description,
}: PlaceholderScreenProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <ScreenContainer>
      <View style={[styles.content, { gap: theme.spacing.sm }]}>
        <ThemedText variant="titleLg">{title}</ThemedText>
        <ThemedText variant="body" color="mutedForeground">
          {description}
        </ThemedText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
