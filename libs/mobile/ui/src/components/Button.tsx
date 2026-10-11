import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import type { ThemeColors } from '../theme';
import type { TypeScaleStep } from '../typeScale';
import { disabledNatively } from '../hooks/focusHeld';
import { useFocusRing } from '../hooks/useFocusRing';
import { usePressFeedback } from '../hooks/usePressFeedback';
import { labelRipple, PressedLayer } from './feedback';
import { Icon, type IconName } from './Icon';
import { useSurface } from './surface';
import { Text } from './Text';

/**
 * - `primary`, `secondary`, `destructive`, `ghost` — the four the Controls
 *   sheet draws.
 * - `brand` — the violet Unlock action (Entry · Unlock sheets). The brand fill
 *   is for the Vault's own secure action and nothing else.
 * - `link` — the underlined text action ("Forgot password?", "Use Recovery Key
 *   instead"), in a touch target but with no fill.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'ghost'
  | 'brand'
  | 'link';

/**
 * - `regular` — the 48pt button every sheet and form uses.
 * - `large` — the 56pt biometric Unlock action.
 * - `compact` — the touch-target minimum, for a header action like Log out.
 */
export type ButtonSize = 'compact' | 'regular' | 'large';

type Fill = keyof ThemeColors | null;

interface VariantRoles {
  fill: Fill;
  label: keyof ThemeColors;
  underline: boolean;
}

/**
 * What each variant is made of, named by Semantic Role rather than by resolved
 * colour so one table serves both colour modes. Pinned to the variant set, and
 * one table rather than several: a variant renamed in one of a set of literals
 * and not the others compiles.
 */
const VARIANTS = {
  primary: {
    fill: 'primary',
    label: 'primaryForeground',
    underline: false,
  },
  secondary: {
    fill: 'secondary',
    label: 'secondaryForeground',
    underline: false,
  },
  destructive: {
    fill: 'destructive',
    label: 'destructiveForeground',
    underline: false,
  },
  ghost: {
    fill: null,
    label: 'foreground',
    underline: false,
  },
  brand: {
    fill: 'brand',
    label: 'brandForeground',
    underline: false,
  },
  link: {
    fill: null,
    label: 'foreground',
    underline: true,
  },
} as const satisfies Record<ButtonVariant, VariantRoles>;

/**
 * `secondary` on a sheet. In dark the sheet is the raised `muted` surface
 * (P6), which is what `secondary` resolves to, so the design draws the button
 * in `accent` there; in light the two are the same grey.
 */
const SECONDARY_ON_SHEET: VariantRoles = {
  fill: 'accent',
  label: 'accentForeground',
  underline: false,
};

/**
 * Each size's height, label step and glyph size.
 *
 * The heights are the Controls sheet's own numbers — no token carries a
 * control height. The label is the step the type sheet names for buttons,
 * `bodySm` at 600; the sheet draws it at 16/20, a size between two steps, so
 * it takes `bodySm` (15/20), whose line height is the one drawn. The large
 * size's 17/22 label likewise takes `body`.
 */
const SIZES = {
  compact: { height: MIN_TOUCH_TARGET, step: 'bodySm', icon: 20 },
  regular: { height: 48, step: 'bodySm', icon: 20 },
  large: { height: 56, step: 'body', icon: 24 },
} as const satisfies Record<
  ButtonSize,
  { height: number; step: TypeScaleStep; icon: number }
>;

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A glyph beside the label. Decorative — the label is what is announced. */
  icon?: IconName;
  /** Which side of the label the glyph sits. Leading unless it points away. */
  iconPosition?: 'leading' | 'trailing';
  /**
   * Shows a spinner in place of the label and stops accepting presses. The
   * label stays laid out, invisibly, so the button's width does not jump.
   */
  busy?: boolean;
  style?: ViewStyle;
  /** The button's view, for a screen that moves focus to it. */
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

export function Button({
  label,
  variant = 'primary',
  size = 'regular',
  icon,
  iconPosition = 'leading',
  busy = false,
  disabled = false,
  style,
  ref,
  onFocus,
  onBlur,
  onPress,
  ...rest
}: ButtonProps): React.JSX.Element {
  const theme = useTheme();
  const surface = useSurface();
  const ring = useFocusRing();
  // Unfilled variants answer a press as every unfilled control does — the
  // accent fill on iOS, a foreground ripple on Android. Filled ones take a
  // layer (or ripple) of their own label colour, which shows on the fill.
  const unfilledFeedback = usePressFeedback();
  const roles =
    variant === 'secondary' && surface === 'sheet'
      ? SECONDARY_ON_SHEET
      : VARIANTS[variant];
  const { height, step, icon: iconSize } = SIZES[size];
  const inert = disabled || busy;
  // Not told to the view while the button is where keyboard focus is; the
  // press is refused here instead (see `disabledNatively`).
  const nativelyDisabled = disabledNatively(inert, ring.focused);
  const radius = theme.radii.md;
  const isLink = variant === 'link';

  const glyph =
    icon != null ? (
      <Icon name={icon} size={iconSize} color={roles.label} />
    ) : null;

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: nativelyDisabled, busy }}
      disabled={nativelyDisabled}
      onPress={inert ? undefined : onPress}
      android_ripple={ring.ripple(
        inert
          ? undefined
          : roles.fill === null
            ? unfilledFeedback.android_ripple
            : labelRipple(theme, roles.label),
      )}
      onFocus={(event) => {
        ring.onFocus(event);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        ring.onBlur(event);
        onBlur?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: Math.max(height, MIN_TOUCH_TARGET),
          // The sheet pads a button 20pt a side and a text link 8pt; 20 falls
          // between two steps and takes the larger.
          paddingHorizontal: isLink ? theme.spacing.sm : theme.spacing.lg,
          borderRadius: radius,
          backgroundColor:
            roles.fill === null ? 'transparent' : theme.colors[roles.fill],
        },
        roles.fill === null && unfilledFeedback.pressedStyle(pressed && !inert),
        ring.ringStyle,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {({ pressed }) => (
        <>
          {roles.fill !== null && (
            <PressedLayer
              pressed={pressed && !inert}
              color={theme.colors[roles.label]}
              radius={radius}
            />
          )}
          <View
            // Always a view of its own. With layout styles alone React
            // Native draws no view for this row and gives its children to the
            // button; `opacity` while busy makes it one, and Android then
            // moves the glyph's view between the two parents each time busy
            // flips — which failed with "The specified child already has a
            // parent" as "Archive instead" finished (#1088).
            collapsable={false}
            style={[
              styles.content,
              { gap: theme.spacing.sm },
              busy && styles.hidden,
            ]}
          >
            {iconPosition === 'leading' && glyph}
            <Text
              variant={step}
              weight="semibold"
              color={roles.label}
              style={[styles.label, roles.underline && styles.underline]}
            >
              {label}
            </Text>
            {iconPosition === 'trailing' && glyph}
          </View>
          {busy && (
            <View style={styles.spinner} pointerEvents="none">
              <ActivityIndicator color={theme.colors[roles.label]} />
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  hidden: {
    opacity: 0,
  },
  spinner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
