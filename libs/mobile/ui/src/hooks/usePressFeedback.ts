import { useMemo } from 'react';
import {
  Platform,
  type PressableAndroidRippleConfig,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import type { ColorMode } from '../theme';

/**
 * `bounded` for rows and buttons, `borderless` for an icon-only control —
 * Lock, a reveal toggle — whose ripple spreads past its glyph as a circle.
 */
export type PressFeedbackShape = 'bounded' | 'borderless';

/** The ripple's strength over `foreground`, per mode (Platform sheet). */
const RIPPLE_ALPHA = {
  light: 0.12,
  dark: 0.16,
} as const satisfies Record<ColorMode, number>;

/**
 * A `#rrggbb` role at an alpha, as `rgba()`. The ripple is `foreground` at a
 * strength, so it is derived from the role rather than written down as a
 * second colour that would miss a change to the first.
 */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) {
    throw new Error(`Expected a #rrggbb colour, got: ${hex}`);
  }
  const [r, g, b] = match.slice(1).map((pair) => parseInt(pair, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The press state every control in this library shares, per platform.
 *
 * The approved Platform sheet keeps one thing platform-specific: iOS has no
 * ripple, so a pressed row or ghost control takes the `accent` fill for as
 * long as the finger is down; Android draws `android_ripple` in `foreground`
 * at 12% (16% in dark) — bounded on rows and buttons, borderless at radius 22
 * on icon buttons. Nothing presses by fading: an opacity change reads as
 * disabled, which is the opposite of what a press means.
 *
 * A control that can take keyboard focus passes the ripple through its
 * `useFocusRing().ripple`, which keeps Android from filling it while focused.
 */
export function usePressFeedback(shape: PressFeedbackShape = 'bounded'): {
  android_ripple: PressableAndroidRippleConfig | undefined;
  pressedStyle: (pressed: boolean) => ViewStyle | null;
} {
  const theme = useTheme();

  return useMemo(() => {
    if (Platform.OS === 'android') {
      return {
        android_ripple: {
          color: withAlpha(theme.colors.foreground, RIPPLE_ALPHA[theme.mode]),
          borderless: shape === 'borderless',
          radius: shape === 'borderless' ? MIN_TOUCH_TARGET / 2 : undefined,
          foreground: true,
        },
        pressedStyle: () => null,
      };
    }
    const fill: ViewStyle = { backgroundColor: theme.colors.accent };
    return {
      android_ripple: undefined,
      pressedStyle: (pressed: boolean) => (pressed ? fill : null),
    };
  }, [shape, theme]);
}
