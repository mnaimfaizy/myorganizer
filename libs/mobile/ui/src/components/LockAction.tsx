import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { Icon } from './Icon';

export interface LockActionProps {
  onPress: () => void;
  /** What the control is announced as. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * The control that locks the Vault, as one component.
 *
 * It is the trailing action of a screen's header on both platforms, and the
 * two platforms reach it by different routes — Android through
 * `LargeTitleHeader`, iOS through the native stack's `headerRight`. Built once
 * here rather than at each of those two sites, because two copies drift: the
 * announced label and the touch target would end up platform-specific by
 * accident rather than by decision.
 */
export function LockAction({
  onPress,
  accessibilityLabel = 'Lock vault',
  style,
}: LockActionProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
          borderRadius: theme.radii.full,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon name="lock" size={24} color="foreground" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
