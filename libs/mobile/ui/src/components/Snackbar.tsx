import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { useFocusRing } from '../hooks/useFocusRing';
import { withAlpha } from '../hooks/usePressFeedback';
import type { ColorMode, ThemeColors } from '../theme';
import { Text } from './Text';

/** How long a snackbar stays up when nothing dismisses it (Overlays sheet). */
const DEFAULT_DURATION_MS = 6000;

/** The pressed Undo action's cyan wash. */
const ACTION_PRESSED_ALPHA = 0.16;

/**
 * The bar's surface per colour mode. In light it is the inverse surface —
 * `primary`, with its own edge and a popover shadow. In dark `primary` is
 * near-white, so the bar takes the raised `muted` surface with a `border`
 * edge instead (P6), and drops the shadow a near-black ground cannot show.
 */
const SURFACE_BY_MODE = {
  light: {
    fill: 'primary',
    edge: 'primary',
    text: 'primaryForeground',
    shadow: true,
  },
  dark: {
    fill: 'raisedSurface',
    edge: 'border',
    text: 'foreground',
    shadow: false,
  },
} as const satisfies Record<
  ColorMode,
  {
    fill: keyof ThemeColors;
    edge: keyof ThemeColors;
    text: keyof ThemeColors;
    shadow: boolean;
  }
>;

export interface SnackbarProps {
  visible: boolean;
  /** What just happened, in the past tense. Never repeats the action. */
  message: string;
  /** The way back. `Undo` for anything reversible. */
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  /** Milliseconds before it dismisses itself. */
  durationMs?: number;
}

/**
 * Confirmation of something that already happened, with the way back.
 *
 * It is the app's alternative to asking first: an action that can be undone
 * runs immediately and offers Undo here, which is both faster and less
 * frightening than a confirmation sheet in front of every tap. The timer is
 * what makes that a real offer, so it is six seconds — long enough to read the
 * line and reach the button — and it stops while the action has focus or a
 * finger on it, so the offer is never withdrawn from someone who is taking it.
 *
 * It sits 8pt above the tab bar, which owns the bottom inset.
 *
 * `polite` rather than `assertive`: the action already succeeded, so this does
 * not need to interrupt whatever a screen reader is in the middle of saying.
 */
export function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
}: SnackbarProps): React.JSX.Element | null {
  const theme = useTheme();
  const [held, setHeld] = useState(false);
  // Inset: the action sits flush against the bar's trailing edge.
  const ring = useFocusRing('inset');
  const focused = ring.focused;
  const surface = SURFACE_BY_MODE[theme.mode];
  const actionRadius = theme.radii.md;

  useEffect(() => {
    if (!visible || held || focused) return undefined;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, held, focused, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.bar,
        {
          gap: theme.spacing.sm,
          marginHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          // The action is a 44pt target inside a 52pt bar; the bar pads it 4
          // top and bottom and 4 at the trailing edge, the message 16 in.
          paddingVertical: theme.spacing.xs,
          paddingLeft: theme.spacing.md,
          paddingRight: theme.spacing.xs,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors[surface.edge],
          backgroundColor: theme.colors[surface.fill],
        },
        surface.shadow && theme.shadows.popover,
      ]}
    >
      <Text variant="bodySm" color={surface.text} style={styles.message}>
        {message}
      </Text>
      {actionLabel != null && onAction != null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          onPressIn={() => setHeld(true)}
          onPressOut={() => setHeld(false)}
          android_ripple={ring.ripple()}
          onFocus={ring.onFocus}
          onBlur={ring.onBlur}
          style={({ pressed }) => [
            styles.action,
            {
              minHeight: MIN_TOUCH_TARGET,
              // The sheet pads the action 14 a side, which rounds to `md`,
              // and rounds it at 6, halfway between two radii.
              paddingHorizontal: theme.spacing.md,
              borderRadius: actionRadius,
            },
            pressed && {
              backgroundColor: withAlpha(
                theme.colors.cyan,
                ACTION_PRESSED_ALPHA,
              ),
            },
            // On the inverse surface the `focus` role is the bar's own colour
            // in light, so the ring takes the bar's text colour instead.
            ring.ringStyle !== null && {
              ...ring.ringStyle,
              outlineColor: theme.colors[surface.text],
            },
          ]}
        >
          <Text variant="bodySm" weight="bold" color="cyan">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flexShrink: 1,
    flexGrow: 1,
  },
  action: {
    justifyContent: 'center',
  },
});
