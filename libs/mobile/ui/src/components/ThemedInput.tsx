import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
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
    ? theme.colors.errorText
    : focused
      ? theme.colors.focus
      : theme.colors.controlEdge;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label != null && (
        <Text
          style={[
            styles.label,
            theme.type.labelCaps,
            { color: theme.colors.mutedForeground },
          ]}
        >
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          theme.type.body,
          {
            borderColor,
            borderRadius: theme.radii.md,
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
      {error != null && (
        <Text
          style={[
            styles.error,
            theme.type.caption,
            { color: theme.colors.errorText },
          ]}
        >
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
    includeFontPadding: false,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    includeFontPadding: false,
  },
  error: {
    includeFontPadding: false,
  },
});
