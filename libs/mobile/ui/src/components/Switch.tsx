import React from 'react';
import {
  Switch as RNSwitch,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { useFocusRing } from '../hooks/useFocusRing';
import { Text } from './Text';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** What the switch turns on. Also what the control is announced as. */
  label?: string;
  /** One line under the label, for a setting whose effect is not obvious. */
  hint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * A setting that takes effect the moment it is flipped — Account's Biometric
 * Unlock and keep-screen-on.
 *
 * The platform switch, themed, rather than a drawn one: it is the control
 * every other app on the device uses for this, and its gesture, its animation,
 * and its screen-reader behaviour are the ones the User already knows.
 *
 * It draws the P3 focus ring like any other control, round the switch. On
 * Android the focus it is told about comes from the app's native code: React
 * Native 0.87's switch never reports its own, because
 * `ReactSwitchManager.addEventEmitters` replaces the step that attaches the
 * focus listener (#1017, `SwitchFocusEvents.kt`).
 */
export function Switch({
  value,
  onValueChange,
  label,
  hint,
  accessibilityLabel,
  disabled = false,
  style,
}: SwitchProps): React.JSX.Element {
  const theme = useTheme();
  const focus = useFocusRing();

  return (
    <View
      style={[
        styles.row,
        { gap: theme.spacing.md, minHeight: MIN_TOUCH_TARGET },
        style,
      ]}
    >
      {label != null && (
        <View style={styles.labels}>
          <Text variant="body">{label}</Text>
          {hint != null && <Text variant="caption">{hint}</Text>}
        </View>
      )}
      {/* The ring is drawn round the switch rather than on it: on Android an
          outline colour set on anything but a plain view stops the app. Not
          collapsable, because a view that exists only once it has a ring came
          up without its radius and drew the ring square. */}
      <View
        collapsable={false}
        style={[{ borderRadius: theme.radii.full }, focus.ringStyle]}
      >
        <RNSwitch
          accessibilityLabel={accessibilityLabel ?? label}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{
            false: theme.colors.muted,
            true: theme.colors.primary,
          }}
          thumbColor={theme.colors.raisedSurface}
          ios_backgroundColor={theme.colors.muted}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labels: {
    flexShrink: 1,
  },
});
