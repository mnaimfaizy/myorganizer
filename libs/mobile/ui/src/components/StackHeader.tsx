import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../useTheme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface StackHeaderProps {
  /** The inline title. Empty while the screen draws its own title below. */
  title?: string;
  /** Leaves the screen. Omitted where there is nothing to go back to. */
  onBack?: () => void;
  /** What the back control is announced as. */
  backLabel?: string;
  /** The screen's actions, at the trailing edge — Edit, "⋯", Lock. */
  trailing?: React.ReactNode;
  testID?: string;
}

/**
 * The bar's height: the 56 dp the native stack's toolbar drew here, so a
 * pushed screen's content starts where it did. A component dimension, like the
 * touch target — no step of the spacing scale is it. The rule under the bar is
 * inside the 56, not added to it.
 */
const BAR_HEIGHT = 56;

/**
 * The top bar of a screen pushed inside a tab, on Android: the way back, an
 * inline title, and the screen's actions.
 *
 * Drawn here rather than by the native stack because the native bar is an
 * AppCompat `Toolbar`, and from API 26 a `Toolbar` is a keyboard navigation
 * cluster that blocks focus on a touchscreen device
 * (`Base.V26.Widget.AppCompat.Toolbar`: `touchscreenBlocksFocus` and
 * `keyboardNavigationCluster`). Android leaves such a group out of the Tab
 * order altogether, so on a phone with a hardware keyboard no key reached
 * Back, Edit, or Lock on any pushed screen, though each was focusable (#1029).
 * The same controls in an ordinary view are ordinary Tab stops, first on the
 * screen because they are at its top.
 *
 * The bar insets its own top: with a header of the app's own the native stack
 * no longer clears the status bar for the screen.
 */
export function StackHeader({
  title = '',
  onBack,
  backLabel = 'Navigate up',
  trailing,
  testID,
}: StackHeaderProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const titled = title !== '';

  return (
    <View
      testID={testID}
      style={[
        styles.bar,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left + theme.spacing.xs,
          paddingRight: insets.right + theme.spacing.md,
          backgroundColor: theme.colors.background,
          // The rule under the bar belongs to a bar carrying the title — the
          // same rule as the collapsed `LargeTitleHeader`. While the screen's
          // own large title sits directly below, the two read as one block.
          borderBottomColor: titled ? theme.colors.border : 'transparent',
        },
      ]}
    >
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        {onBack != null && (
          <IconButton
            icon="arrowLeft"
            accessibilityLabel={backLabel}
            onPress={onBack}
          />
        )}
        {/* 22/28/700 on the Platform sheet, which no step carries; it takes
            `title` (20/26/700), the nearest — as the native bar's title did. */}
        {titled ? (
          <Text variant="title" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        ) : (
          <View style={styles.title} />
        )}
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT - StyleSheet.hairlineWidth,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
  },
});
