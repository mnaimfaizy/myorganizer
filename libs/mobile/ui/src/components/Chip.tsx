import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import type { ThemeColors } from '../theme';
import { useFocusRing } from '../hooks/useFocusRing';
import { usePressFeedback } from '../hooks/usePressFeedback';
import { labelRipple, PressedLayer } from './feedback';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * The chip's visible height on the Controls sheet. It is drawn below the touch
 * target on purpose — a row of 44pt chips reads as a row of buttons — and the
 * difference is made up with hit slop, so the target still meets the floor.
 */
const CHIP_HEIGHT = 36;

/** How the chip is announced: a plain toggle, one of a set, or one of many. */
export type ChipRole = 'button' | 'radio' | 'checkbox';

/**
 * What each selection state is made of. Selected takes `primary` — the brand
 * violet is for the Vault's secure actions, and a filter is not one — and the
 * unselected edge is `controlEdge` (P4), because the `border` hairline marks a
 * control at only 1.23:1.
 */
const STATES = {
  selected: {
    fill: 'primary',
    edge: 'primary',
    label: 'primaryForeground',
  },
  unselected: { fill: 'card', edge: 'controlEdge', label: 'foreground' },
} as const satisfies Record<
  'selected' | 'unselected',
  {
    fill: keyof ThemeColors;
    edge: keyof ThemeColors;
    label: keyof ThemeColors;
  }
>;

export interface ChipProps {
  label: string;
  /**
   * A glyph before the label. Decorative — the label is what is announced.
   * On selection it becomes a check (Controls sheet), so the state is carried
   * by a shape as well as by the fill.
   */
  icon?: IconName;
  selected?: boolean;
  /** Omitted for a chip that only labels something. */
  onPress?: () => void;
  /**
   * `radio` inside a single-choice group (a Subscription's status), `checkbox`
   * inside a multi-choice one, `button` for a lone toggle. Defaults to
   * `button`.
   */
  accessibilityRole?: ChipRole;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: ViewStyle;
  /**
   * The pressable chip's view, for a screen that moves focus to it. A chip
   * with no `onPress` takes no focus and attaches nothing.
   */
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

/**
 * A short, tappable choice — a filter, a status, a tag.
 *
 * Radius 8 rather than a pill, because pills are reserved for status: a
 * `StatusPill` is never pressed and a chip always can be.
 *
 * A chip with no `onPress` renders as plain content rather than as a disabled
 * button, because a screen reader announcing "button, dimmed" for something
 * that was never meant to be pressed is worse than announcing nothing.
 */
export function Chip({
  label,
  icon,
  selected = false,
  onPress,
  accessibilityRole = 'button',
  accessibilityLabel,
  disabled = false,
  style,
  ref,
}: ChipProps): React.JSX.Element {
  const theme = useTheme();
  const ring = useFocusRing();
  const unselectedFeedback = usePressFeedback();
  const roles = STATES[selected ? 'selected' : 'unselected'];
  const glyph: IconName | null = selected ? 'check' : (icon ?? null);
  const radius = theme.radii.md;

  const body = (
    <>
      {glyph !== null && (
        <Icon
          name={glyph}
          size={16}
          color={roles.label}
          // The sheet draws the selected check heavier than the glyph it
          // replaces, so it reads at 16pt on a filled chip.
          strokeWidth={selected ? 2.6 : undefined}
        />
      )}
      <Text
        variant="bodySm"
        weight="medium"
        color={roles.label}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );

  const shape: ViewStyle = {
    minHeight: CHIP_HEIGHT,
    // The sheet pads 10 on the glyph side and 12 on the other; 10 takes the
    // nearer step and 12, halfway between two, takes the larger. The 6pt
    // glyph gap is likewise halfway and takes `sm`.
    paddingLeft: glyph !== null ? theme.spacing.sm : theme.spacing.md,
    paddingRight: theme.spacing.md,
    gap: theme.spacing.sm,
    borderRadius: radius,
    borderColor: theme.colors[roles.edge],
    backgroundColor: theme.colors[roles.fill],
  };

  if (onPress === undefined) {
    return <View style={[styles.chip, shape, style]}>{body}</View>;
  }

  const slop = Math.max(0, (MIN_TOUCH_TARGET - CHIP_HEIGHT) / 2);
  const checkable = accessibilityRole !== 'button';

  return (
    <Pressable
      ref={ref}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={
        checkable ? { checked: selected, disabled } : { selected, disabled }
      }
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: slop, bottom: slop }}
      android_ripple={
        selected
          ? labelRipple(theme, roles.label)
          : unselectedFeedback.android_ripple
      }
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      style={({ pressed }) => [
        styles.chip,
        shape,
        // Unselected takes the accent fill when pressed; selected is a filled
        // shape and takes the 14% label layer instead.
        !selected && unselectedFeedback.pressedStyle(pressed),
        ring.ringStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {selected && (
            <PressedLayer
              pressed={pressed}
              color={theme.colors[roles.label]}
              radius={radius}
            />
          )}
          {body}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.4,
  },
});
