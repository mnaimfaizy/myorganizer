import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';

export interface ThemedInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function ThemedInput({
  label,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: ThemedInputProps): React.JSX.Element {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.destructive
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label != null && (
        <Text style={[styles.label, { color: theme.colors.primary, fontFamily: theme.fonts.body }]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          {
            borderColor,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.card,
            color: theme.colors.primary,
            fontFamily: theme.fonts.body,
          },
          style,
        ]}
        placeholderTextColor={theme.colors.muted}
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
      {error != null && (
        <Text style={[styles.error, { color: theme.colors.destructive, fontFamily: theme.fonts.body }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    includeFontPadding: false,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
    includeFontPadding: false,
  },
  error: {
    fontSize: 12,
    includeFontPadding: false,
  },
});
