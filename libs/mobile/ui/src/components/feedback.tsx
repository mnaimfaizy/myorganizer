import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type PressableAndroidRippleConfig,
} from 'react-native';
import { withAlpha } from '../hooks/usePressFeedback';
import type { ColorMode, Theme, ThemeColors } from '../theme';

/**
 * Press feedback for a **filled** control — a primary, destructive or brand
 * button, a selected chip — which `usePressFeedback` does not cover: that hook
 * answers an unfilled control with the `accent` fill (iOS) or a `foreground`
 * ripple (Android), and a `foreground` ripple on a `primary` fill is the same
 * colour as the fill. The Controls sheet draws a pressed filled control as a
 * 14% layer of its own label colour instead, and the Platform sheet keeps the
 * Android ripple at 12% (16% in dark) — here in the label colour too, so it
 * shows on the fill it lands on.
 *
 * Internal to the library — screens get this by using the controls.
 */

/** How much of the label colour the iOS pressed layer is. */
const PRESSED_LAYER_ALPHA = 0.14;

/** How much of the label colour the Android ripple is, per colour mode. */
const RIPPLE_ALPHA = { light: 0.12, dark: 0.16 } as const satisfies Record<
  ColorMode,
  number
>;

const USES_RIPPLE = Platform.OS === 'android';

/** A bounded Android ripple in the label role `role`; nothing off Android. */
export function labelRipple(
  theme: Theme,
  role: keyof ThemeColors,
): PressableAndroidRippleConfig | undefined {
  if (!USES_RIPPLE) return undefined;
  return {
    color: withAlpha(theme.colors[role], RIPPLE_ALPHA[theme.mode]),
    borderless: false,
    foreground: true,
  };
}

/**
 * The iOS pressed layer over a filled control: its label colour at 14%,
 * clipped to the control's own radius. Renders nothing on Android, where the
 * ripple is the feedback, and nothing when not pressed.
 */
export function PressedLayer({
  pressed,
  color,
  radius,
}: {
  pressed: boolean;
  color: string;
  radius: number;
}): React.JSX.Element | null {
  if (!pressed || USES_RIPPLE) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: color,
          opacity: PRESSED_LAYER_ALPHA,
          borderRadius: radius,
        },
      ]}
    />
  );
}
