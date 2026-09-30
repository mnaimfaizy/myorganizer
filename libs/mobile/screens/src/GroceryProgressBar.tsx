import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@myorganizer/mobile/ui';

/**
 * How thick each Groceries bar is drawn (Groceries sheet): the Lists screen's
 * mini bar under a list's name, and the trip view's bar beside its count.
 * Component dimensions, like the touch target — no spacing step is either.
 */
const BAR = {
  mini: { height: 4, width: 72 },
  trip: { height: 6, width: undefined },
} as const satisfies Record<
  'mini' | 'trip',
  { height: number; width: number | undefined }
>;

export interface GroceryProgressBarProps {
  /** How much of the list is checked, from 0 to 1. */
  fraction: number;
  /** `mini` — the Lists row's fixed 72pt bar; `trip` — the trip view's, which fills its row. */
  size: 'mini' | 'trip';
  style?: ViewStyle;
}

/**
 * A Grocery List's checked share as a bar — decorative, because the words
 * beside it ("8 of 12 left", "All done") carry the value and are what a
 * screen reader hears. The fill is `primary` and turns `success` once every
 * line is checked, so "done" is said by the words and the colour together.
 *
 * Not `ProgressMeter`: that primitive stacks its label over an 8pt track,
 * and both Groceries bars sit inline beside their label at their own weight.
 */
export function GroceryProgressBar({
  fraction,
  size,
  style,
}: GroceryProgressBarProps): React.JSX.Element {
  const theme = useTheme();
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const { height, width } = BAR[size];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.track,
        size === 'trip' && styles.grow,
        {
          height,
          width,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.muted,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            borderRadius: theme.radii.full,
            backgroundColor:
              clamped >= 1 ? theme.colors.success : theme.colors.primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
  },
  fill: {
    height: '100%',
  },
});
