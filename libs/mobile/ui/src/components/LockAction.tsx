import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { useFocusRing } from '../hooks/useFocusRing';
import { usePressFeedback } from '../hooks/usePressFeedback';
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
  const press = usePressFeedback('borderless');
  const focus = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      android_ripple={press.android_ripple}
      style={({ pressed }) => [
        styles.button,
        {
          // Fixed, not minimum: on iOS 26 the navigation bar stretches a
          // bar button whose width can grow, and a minimum let the Lock
          // action widen into a pill once the keyboard had moved the layout.
          width: MIN_TOUCH_TARGET,
          height: MIN_TOUCH_TARGET,
          borderRadius: theme.radii.full,
        },
        press.pressedStyle(pressed),
        focus.ringStyle,
        style,
      ]}
    >
      {/* The Navigation sheet draws the lock in `brand` at 22pt: it is the
          one header action on every tab root, and the brand colour is what
          marks it as the app's own control rather than a screen's. */}
      <Icon name="lock" size={22} color="brand" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
