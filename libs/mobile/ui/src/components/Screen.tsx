import React from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../useTheme';

export interface ScreenProps extends ViewProps {
  children?: React.ReactNode;
  /** Drops the screen gutter, for a screen whose content runs edge to edge. */
  noPadding?: boolean;
  /**
   * Which sides take a safe-area inset. All four by default; a screen sitting
   * above the tab bar passes `['top', 'left', 'right']`, because the bar
   * already owns the bottom inset and insetting twice leaves a visible gap.
   */
  edges?: readonly Edge[];
}

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

/**
 * The root of every screen.
 *
 * The inset comes from `react-native-safe-area-context` rather than from a
 * status-bar height: `targetSdk 36` means Android draws this app
 * edge-to-edge whether it asks to or not, so the system bars overlap the
 * window and a manual inset is wrong on every device with a cutout.
 */
export function Screen({
  children,
  noPadding = false,
  edges = ALL_EDGES,
  style,
  ...rest
}: ScreenProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.base,
        { backgroundColor: theme.colors.background },
        !noPadding && { paddingHorizontal: theme.spacing.gutter },
        style,
      ]}
      {...rest}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
