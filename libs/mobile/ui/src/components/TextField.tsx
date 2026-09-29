import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET, TEXT_SCALE_CAP } from '../metrics';
import { InlineNotice } from './InlineNotice';
import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  /** What is wrong with the value, in one line. Announced when it appears. */
  error?: string;
  /** How to fill the field in, when that is not obvious from the label. */
  hint?: string;
  containerStyle?: ViewStyle;
  /**
   * Renders a reveal toggle beside a secure field, which then owns
   * `secureTextEntry` instead of the caller.
   */
  revealable?: boolean;
  /**
   * The noun the reveal toggle's accessibility label names — 'Show
   * password' / 'Hide password' by default. A field holding the Vault
   * secret passes 'passphrase', never leaving the default: 'passphrase' and
   * 'password' name two different secrets (CONTEXT.md), and a shared default
   * would otherwise call the Vault secret a password on every screen that
   * reveals it.
   */
  revealLabel?: string;
}

export function TextField({
  label,
  error,
  hint,
  containerStyle,
  style,
  onFocus,
  onBlur,
  maxFontSizeMultiplier = TEXT_SCALE_CAP,
  revealable = false,
  revealLabel = 'password',
  secureTextEntry,
  ...rest
}: TextFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // An error marks the edge in errorEdge; the message itself is an
  // InlineNotice, which is where the tone's text colour is decided.
  const borderColor = error
    ? theme.colors.errorEdge
    : focused
      ? theme.colors.focus
      : theme.colors.controlEdge;

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {label != null && (
        <Text variant="labelCaps" color="mutedForeground">
          {label}
        </Text>
      )}
      <View style={[styles.inputRow, { gap: theme.spacing.sm }]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityState={{ disabled: rest.editable === false }}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          secureTextEntry={revealable ? !revealed : secureTextEntry}
          style={[
            styles.input,
            theme.type.body,
            {
              minHeight: MIN_TOUCH_TARGET,
              borderColor,
              borderRadius: theme.radii.md,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              backgroundColor: theme.colors.card,
              color: theme.colors.foreground,
            },
            style,
          ]}
          placeholderTextColor={theme.colors.mutedForeground}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {revealable && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              revealed ? `Hide ${revealLabel}` : `Show ${revealLabel}`
            }
            onPress={() => setRevealed((current) => !current)}
            hitSlop={theme.spacing.sm}
            style={({ pressed }) => [
              styles.revealButton,
              { minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET },
              pressed && styles.pressed,
            ]}
          >
            <Text variant="bodySm" color="brand">
              {revealed ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        )}
      </View>
      {hint != null && error == null && <Text variant="caption">{hint}</Text>}
      {error != null && <InlineNotice tone="destructive" message={error} />}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    includeFontPadding: false,
  },
  revealButton: {
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
