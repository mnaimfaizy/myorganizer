import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { useFocusRing } from '../hooks/useFocusRing';
import { usePressFeedback } from '../hooks/usePressFeedback';
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
  const press = usePressFeedback('borderless');
  const focus = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      // A disabled control is not a stop on the focus path (Lists sheet).
      focusable={!disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      android_ripple={disabled ? undefined : press.android_ripple}
      style={({ pressed }) => [
        styles.button,
        {
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
          borderRadius: theme.radii.full,
        },
        press.pressedStyle(pressed),
        focus.ringStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} size={22} color="foreground" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
