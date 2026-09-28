import React, { useState } from 'react';
import {
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
  ...rest
}: TextFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

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
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled: rest.editable === false }}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
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
      {hint != null && error == null && <Text variant="caption">{hint}</Text>}
      {error != null && <InlineNotice tone="destructive" message={error} />}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    includeFontPadding: false,
  },
});
