import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import type { ColorMode, ThemeColors } from '../theme';
import { useFocusRing } from '../hooks/useFocusRing';
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
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * How the selected segment is raised, per colour mode (Controls sheet): in
 * light it is the raised surface with a lift shadow; in dark a shadow does not
 * read against a near-black ground, so it takes the `accent` fill with a
 * `border` edge instead.
 */
const SELECTED_BY_MODE = {
  light: { fill: 'raisedSurface', edge: null, lifted: true },
  dark: { fill: 'accent', edge: 'border', lifted: false },
} as const satisfies Record<
  ColorMode,
  {
    fill: keyof ThemeColors;
    edge: keyof ThemeColors | null;
    lifted: boolean;
  }
>;

/**
 * One choice from a short, fixed set, all of them visible at once.
 *
 * Each segment is its own button with a selected state rather than the group
 * being one control: that is what lets a screen reader read out which of the
 * segments is chosen without the User having to step through them.
 *
 * Labels are `secondaryForeground` whether selected or not (P5) — `muted` on
 * the track fails 4.5:1 — and selection is carried by the raised thumb and the
 * weight (600 against 500), so colour is never the only cue.
 */
export function SegmentedControl<Value extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  style,
}: SegmentedControlProps<Value>): React.JSX.Element {
  const theme = useTheme();
  const inset = theme.spacing.xs;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        {
          padding: inset,
          // The sheet's 2pt hairline between segments: half the smallest step.
          gap: theme.spacing.xs / 2,
          // The sheet draws the track at 10, halfway between `md` and `lg`,
          // so it takes the larger.
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.muted,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {segments.map((segment) => (
        <SegmentButton
          key={segment.value}
          label={segment.label}
          selected={segment.value === value}
          disabled={disabled}
          inset={inset}
          onPress={() => onChange(segment.value)}
        />
      ))}
    </View>
  );
}

function SegmentButton({
  label,
  selected,
  disabled,
  inset,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  inset: number;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  // Inset: the segment sits flush inside the track, where a ring outside it
  // would collide with its neighbour.
  const ring = useFocusRing('inset');
  const selectedLook = SELECTED_BY_MODE[theme.mode];

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={ring.ripple()}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      // The thumb is drawn inside the track's padding, so the track and the
      // thumb together are the 44pt the sheet draws; the padding is given back
      // to the target as slop, so the tappable height meets the floor while
      // the thumb keeps its drawn size.
      hitSlop={{ top: inset, bottom: inset }}
      style={({ pressed }) => [
        styles.segment,
        {
          minHeight: MIN_TOUCH_TARGET - inset * 2,
          paddingHorizontal: theme.spacing.sm,
          // The sheet draws the thumb at 7, which rounds to `md`.
          borderRadius: theme.radii.md,
        },
        pressed && !selected && { backgroundColor: theme.colors.accent },
        selected && { backgroundColor: theme.colors[selectedLook.fill] },
        selected &&
          selectedLook.edge !== null && {
            borderWidth: 1,
            borderColor: theme.colors[selectedLook.edge],
          },
        // The sheet's thumb shadow is 0 1 3 at 0.12; the nearest elevation
        // token is `card` (the same offset and blur at 0.05).
        selected && selectedLook.lifted && theme.shadows.card,
        ring.ringStyle,
      ]}
    >
      <Text
        variant="bodySm"
        weight={selected ? 'semibold' : 'medium'}
        color="secondaryForeground"
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
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
  disabled: {
    opacity: 0.4,
  },
});
