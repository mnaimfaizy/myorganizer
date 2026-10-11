import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { haptics } from '../haptics';
import { EASING, MOTION, PRESS_SCALE } from '../motion';
import { disabledNatively } from '../hooks/focusHeld';
import { useFocusRing } from '../hooks/useFocusRing';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Text } from './Text';

/**
 * How big the box is. `large` is the grocery trip view's: a shopping list is
 * ticked one-handed, in a supermarket, often at arm's length, and the standard
 * box is the one that gets mis-tapped there.
 */
export type CheckboxSize = 'standard' | 'large';

/** The box and its tick, in points, pinned to the size set. */
export const CHECKBOX_BOX = {
  standard: { box: 24, tick: 16 },
  large: { box: 28, tick: 18 },
} as const satisfies Record<CheckboxSize, { box: number; tick: number }>;

/** The tick, as the Lists sheet draws it, and its drawn length on the grid. */
const TICK_PATH = 'M5 12.5l4.5 4.5L19 7.5';
const TICK_LENGTH = 20;
const TICK_STROKE = 3;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The label beside the box. Also what the control is announced as. */
  label?: string;
  /** Read out instead of the label, when the label alone is not enough. */
  accessibilityLabel?: string;
  size?: CheckboxSize;
  disabled?: boolean;
  style?: ViewStyle;
  /**
   * The control's view, for a list that hands focus on when a focused row
   * leaves (`useFocusSuccession`).
   */
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

/**
 * A tickable box in a 44 × 44 (48 dp) target — the start of the Motion
 * sheet's tick sequence.
 *
 * - **Press** (touch down): the box scales to 0.92 and an `accent` state
 *   layer fills the target, 80 ms ease-out. No haptic yet.
 * - **Commit** (touch up): the haptic fires once, the `primary` fill fades in
 *   and the tick draws, 160 ms on the emphasized curve.
 *
 * Under Reduce Motion the state layer still shows and the fill and tick
 * appear at once — the haptic stays, because a haptic is not motion. The rest
 * of the sequence (strike, dwell, leave) belongs to the row; see `ListRow`.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  accessibilityLabel,
  size = 'standard',
  disabled = false,
  style,
  ref,
}: CheckboxProps): React.JSX.Element {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const focus = useFocusRing();
  const { box, tick } = CHECKBOX_BOX[size];

  const scale = useSharedValue(1);
  const progress = useSharedValue(checked ? 1 : 0);
  const previous = useRef(checked);

  useEffect(() => {
    if (previous.current === checked) return;
    previous.current = checked;
    const to = checked ? 1 : 0;
    progress.value = reduceMotion
      ? to
      : withTiming(to, { duration: MOTION.commit, easing: EASING.emphasized });
  }, [checked, reduceMotion, progress]);

  const boxMotion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const fillMotion = useAnimatedStyle(() => ({ opacity: progress.value }));
  const tickMotion = useAnimatedProps(() => ({
    strokeDashoffset: TICK_LENGTH * (1 - progress.value),
  }));

  // Not told to the view while the box is where keyboard focus is; it stays
  // dimmed and refuses the press here instead (see `disabledNatively`).
  const nativelyDisabled = disabledNatively(disabled, focus.focused);

  const pressTo = (value: number): void => {
    if (reduceMotion) return;
    scale.value = withTiming(value, {
      duration: MOTION.press,
      easing: EASING.out,
    });
  };

  return (
    <Pressable
      ref={ref}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked, disabled: nativelyDisabled }}
      disabled={nativelyDisabled}
      focusable={!nativelyDisabled}
      onPressIn={() => {
        if (!disabled) pressTo(PRESS_SCALE);
      }}
      onPressOut={() => pressTo(1)}
      android_ripple={focus.ripple()}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      onPress={() => {
        if (disabled) return;
        // Ticking and unticking feel different on purpose; see `haptics`.
        if (checked) haptics.untick();
        else haptics.tick();
        onChange(!checked);
      }}
      style={[
        styles.row,
        { gap: theme.spacing.sm, borderRadius: theme.radii.full },
        focus.ringStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          <View
            testID="checkbox-target"
            style={[
              styles.target,
              {
                // Both axes, because the box is the whole control when there
                // is no label — which is how a list row uses it. A 24pt box
                // in a row that is only tall enough is a target that meets
                // the floor in one direction and misses it in the other.
                width: MIN_TOUCH_TARGET,
                height: MIN_TOUCH_TARGET,
                borderRadius: theme.radii.full,
                backgroundColor:
                  pressed && !disabled ? theme.colors.accent : 'transparent',
              },
            ]}
          >
            <Animated.View
              testID="checkbox-box"
              style={[
                styles.box,
                {
                  width: box,
                  height: box,
                  // The design sheet draws this at 6, which falls exactly
                  // between the `sm` and `md` radius steps; a tie rounds up.
                  borderRadius: theme.radii.md,
                  borderColor: checked
                    ? theme.colors.primary
                    : theme.colors.controlEdge,
                },
                boxMotion,
              ]}
            >
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: theme.colors.primary },
                  fillMotion,
                ]}
              />
              <Svg
                width={tick}
                height={tick}
                viewBox="0 0 24 24"
                fill="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <AnimatedPath
                  d={TICK_PATH}
                  stroke={theme.colors.primaryForeground}
                  strokeWidth={TICK_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={TICK_LENGTH}
                  animatedProps={tickMotion}
                />
              </Svg>
            </Animated.View>
          </View>
          {label != null && (
            <Text variant="body" style={styles.label}>
              {label}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  target: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.4,
  },
});
