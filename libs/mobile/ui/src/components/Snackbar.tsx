import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { Text } from './Text';

/** How long a snackbar stays up when nothing dismisses it. */
const DEFAULT_DURATION_MS = 5000;

export interface SnackbarProps {
  visible: boolean;
  /** What just happened, in the past tense. */
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
 * what makes that a real offer, so it is long enough to read the line and
 * reach the button.
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
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.bar,
        {
          gap: theme.spacing.md,
          margin: theme.spacing.md,
          marginBottom: theme.spacing.md + insets.bottom,
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.primary,
          ...theme.shadows.popover,
        },
      ]}
    >
      <Text variant="bodySm" color="primaryForeground" style={styles.message}>
        {message}
      </Text>
      {actionLabel != null && onAction != null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={theme.spacing.sm}
          style={({ pressed }) => [
            styles.action,
            { minHeight: MIN_TOUCH_TARGET },
            pressed && styles.pressed,
          ]}
        >
          <Text variant="bodySm" color="primaryForeground">
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
  pressed: {
    opacity: 0.6,
  },
});
