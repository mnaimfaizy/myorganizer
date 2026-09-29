import React, { useEffect } from 'react';
import { StyleSheet, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../useTheme';
import { useReduceMotion } from '../hooks/useReduceMotion';

/** How long one half of the pulse takes: 1 → 0.5 over 1 s (Lists sheet). */
const PULSE_MS = 1000;

/** The two ends of the pulse. The low end still reads as a filled shape. */
const DIM = 0.5;
const BRIGHT = 1;

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** Defaults to the shape of a line of text. */
  radius?: number;
  style?: ViewStyle;
}

/**
 * The shape of something that has not arrived yet.
 *
 * It holds the space the real content will take, so the screen does not jump
 * when it arrives. It pulses from full opacity to half and back, a second each
 * way; under Reduce Motion it stops pulsing and sits at full opacity — still
 * visible, still the right shape, just still.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius,
  style,
}: SkeletonProps): React.JSX.Element {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(BRIGHT);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = BRIGHT;
      return;
    }
    opacity.value = withRepeat(
      withTiming(DIM, { duration: PULSE_MS }),
      -1,
      true,
    );
  }, [reduceMotion, opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: radius ?? theme.radii.sm,
          backgroundColor: theme.colors.muted,
        },
        pulse,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
