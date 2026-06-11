import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

export interface ThemedButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  style?: ViewStyle;
}

export function ThemedButton({
  label,
  variant = 'primary',
  disabled = false,
  style,
  ...rest
}: ThemedButtonProps): React.JSX.Element {
  const theme = useTheme();

  const variantContainerStyle: ViewStyle = {
    primary: {
      backgroundColor: theme.colors.primary,
      borderWidth: 0,
    },
    secondary: {
      backgroundColor: theme.colors.secondary,
      borderWidth: 0,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.primary,
      borderWidth: 1,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
  }[variant];

  const labelColor = {
    primary: theme.colors.onPrimary,
    secondary: theme.colors.onSecondary,
    outline: theme.colors.primary,
    ghost: theme.colors.primary,
  }[variant];

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { borderRadius: theme.radii.md },
        variantContainerStyle,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
