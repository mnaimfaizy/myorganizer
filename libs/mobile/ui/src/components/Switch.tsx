import React from 'react';
import {
  Switch as RNSwitch,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
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
 * It draws no P3 focus ring, and that is the platform's limit rather than an
 * omission. React Native 0.87's Android switch never reports its focus —
 * `ReactSwitchManager.addEventEmitters` replaces the step that attaches the
 * focus listener — and it ignores `focusable`, which only plain views
 * implement, so a wrapper can neither hear the switch's focus nor take it
 * over. A keyboard User sees Android's own halo on the thumb instead. A ring
 * here needs a native change, not more JavaScript (#947).
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
      />
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
