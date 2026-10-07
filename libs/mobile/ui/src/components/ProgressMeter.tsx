import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../useTheme';
import { MOTION } from '../motion';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { staticElement } from '../staticElement';
import { Text } from './Text';

export interface ProgressMeterProps {
  /** How far along, from 0 to 1. Values outside that range are clamped. */
  value: number;
  /**
   * The count that carries the value — "7 of 12". Drawn at the leading edge
   * in tabular figures, and what the meter is announced as.
   */
  label?: string;
  /** A muted note at the trailing edge — "checked", "All checked", "3 to go". */
  meta?: string;
  /**
   * What a screen reader hears as the value — "7 of 12 checked". Defaults to
   * the percentage, which is right only when no count exists.
   */
  accessibilityValueText?: string;
  style?: ViewStyle;
}

/**
 * How far through something is — the Lists sheet's meter.
 *
 * The text carries the value; the bar only shows it. The fill is `primary`
 * and turns `success` once complete, so "done" is said by the words and the
 * colour together, never by colour alone. The fill's width tweens over 220 ms
 * while the text changes at once (Motion sheet); under Reduce Motion the
 * bar jumps.
 *
 * The value is announced rather than drawn, through `accessibilityValue`: a
 * bar is the one thing on a screen that a screen reader cannot read out of
 * the layout, so the number has to be given to it.
 */
export function ProgressMeter({
  value,
  label,
  meta,
  accessibilityValueText,
  style,
}: ProgressMeterProps): React.JSX.Element {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const fraction = Math.min(Math.max(value, 0), 1);
  const complete = fraction >= 1;

  const width = useSharedValue(fraction);
  useEffect(() => {
    width.value = reduceMotion
      ? fraction
      : withTiming(fraction, { duration: MOTION.meter });
  }, [fraction, reduceMotion, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      // One accessibility element is what makes the role and the value real:
      // a View carrying only a role is not one on iOS, so the value would
      // never be announced. It is no keyboard stop (`staticElement`) when it
      // has a label to be read by; a meter without one is read by its `meta`,
      // which only plain `accessible` folds in on Android.
      {...(label != null ? staticElement() : { accessible: true })}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={
        accessibilityValueText != null
          ? { text: accessibilityValueText }
          : { min: 0, max: 100, now: Math.round(fraction * 100) }
      }
      style={[{ gap: theme.spacing.sm }, style]}
    >
      {(label != null || meta != null) && (
        <View style={[styles.labels, { gap: theme.spacing.sm }]}>
          {label != null && (
            <Text
              importantForAccessibility="no"
              variant="bodySm"
              weight="semibold"
              style={styles.label}
              numberOfLines={1}
            >
              {label}
            </Text>
          )}
          {meta != null && (
            <Text
              importantForAccessibility={label != null ? 'no' : undefined}
              variant="caption"
            >
              {meta}
            </Text>
          )}
        </View>
      )}
      <View
        style={[
          styles.track,
          {
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.muted,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              borderRadius: theme.radii.sm,
              backgroundColor: complete
                ? theme.colors.success
                : theme.colors.primary,
            },
            fill,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
