import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import type { ThemeColors } from '../theme';

export type ButtonVariant = 'primary' | 'brand' | 'outline' | 'ghost';

/**
 * What each variant is made of, named by Semantic Role rather than by resolved
 * colour so one table serves both colour modes. Pinned to the variant set, and
 * one table rather than two: a variant renamed in one of a pair of literals and
 * not the other compiles.
 */
const VARIANTS = {
  primary: { fill: 'primary', label: 'primaryForeground', edge: null },
  brand: { fill: 'brand', label: 'brandForeground', edge: null },
  outline: { fill: null, label: 'foreground', edge: 'controlEdge' },
  ghost: { fill: null, label: 'foreground', edge: null },
} as const satisfies Record<
  ButtonVariant,
  {
    fill: keyof ThemeColors | null;
    label: keyof ThemeColors;
    edge: keyof ThemeColors | null;
  }
>;

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
  const { fill, label: labelRole, edge } = VARIANTS[variant];

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: theme.radii.md,
          backgroundColor: fill === null ? 'transparent' : theme.colors[fill],
          borderWidth: edge === null ? 0 : 1,
          borderColor: edge === null ? undefined : theme.colors[edge],
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          theme.type.body,
          { color: theme.colors[labelRole] },
        ]}
      >
        {label}
      </Text>
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
    includeFontPadding: false,
  },
});
