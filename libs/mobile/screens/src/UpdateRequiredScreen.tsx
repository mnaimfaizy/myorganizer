import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import {
  EmptyState,
  InlineNotice,
  Screen,
  useTheme,
} from '@myorganizer/mobile/ui';

export interface UpdateRequiredScreenProps {
  /** A Vault Push was refused, so the User's last change was not saved. */
  unsavedChange: boolean;
  onDownload: () => void;
}

/**
 * What the app shows once the backend refuses this build as below the
 * Version Floor (ADR 0114 decision 1). It blocks the whole app: no request
 * this build makes would be answered.
 *
 * Nothing updates the app on its own, so this screen is the only update
 * signal it gives. No design was approved for it (ADR 0110); it is the empty
 * state pattern, built from the existing components.
 */
export function UpdateRequiredScreen({
  unsavedChange,
  onDownload,
}: UpdateRequiredScreenProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen>
      {/* RootNavigator sets the glyph style, and this screen replaces it. */}
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
      />
      <View style={[styles.centre, { gap: theme.spacing.lg }]}>
        <EmptyState
          icon="arrowUp"
          title="Update required"
          description="This version of MyOrganiser is no longer supported. Download the latest version to keep using it. Your data is safe on the server."
          actionLabel="Download the update"
          actionIcon="external"
          actionIconPosition="trailing"
          onAction={onDownload}
        />
        {unsavedChange && (
          <InlineNotice
            tone="warning"
            variant="card"
            message="Your last change was not saved. Make it again after you update."
            style={{ marginHorizontal: theme.spacing.gutter }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    justifyContent: 'center',
  },
});
