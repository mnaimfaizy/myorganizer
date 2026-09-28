import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { Text } from './Text';

export interface Segment<Value extends string> {
  value: Value;
  label: string;
}

export interface SegmentedControlProps<Value extends string> {
  segments: readonly Segment<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** What the whole control chooses between, for a screen reader. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * One choice from a short, fixed set, all of them visible at once.
 *
 * Each segment is its own button with a selected state rather than the group
 * being one control: that is what lets a screen reader read out which of the
 * segments is chosen without the User having to step through them.
 */
export function SegmentedControl<Value extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  style,
}: SegmentedControlProps<Value>): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        {
          padding: theme.spacing.xs,
          gap: theme.spacing.xs,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.muted,
        },
        style,
      ]}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(segment.value)}
            style={[
              styles.segment,
              {
                // The whole minimum, not the minimum less the track's own
                // padding: the track pads the segments apart and that padding
                // is not tappable, so subtracting it leaves a target below the
                // floor while the control as a whole looks big enough.
                minHeight: MIN_TOUCH_TARGET,
                paddingHorizontal: theme.spacing.sm,
                // The design sheet draws the segment at 7, which rounds to the
                // `md` radius. Its shadow, drawn at 0.12, takes the `card`
                // elevation — the nearer token by alpha is `popover` (0.08 to
                // card's 0.05), but `popover` is a 24px-blur overlay shadow
                // and this is a 1px-lift thumb, so `card` is the nearer
                // elevation even though it is not the nearer number.
                borderRadius: theme.radii.md,
              },
              selected && {
                backgroundColor: theme.colors.raisedSurface,
                ...theme.shadows.card,
              },
            ]}
          >
            <Text
              variant="bodySm"
              color={selected ? 'foreground' : 'mutedForeground'}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
