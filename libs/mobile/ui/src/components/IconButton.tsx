import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  /** What the control is announced as. An icon carries no label of its own. */
  accessibilityLabel: string;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * A single glyph as a tappable control — a header's trailing action, a
 * trigger for a sheet. `LockAction` is this shape with its glyph and label
 * fixed; this is the same touch target and press feedback for every other
 * icon-only control, so a screen adding one does not redraw its own.
 */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
}: IconButtonProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
          borderRadius: theme.radii.full,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon
        name={icon}
        size={24}
        color={disabled ? 'mutedForeground' : 'foreground'}
      />
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
  disabled: {
    opacity: 0.4,
  },
});
