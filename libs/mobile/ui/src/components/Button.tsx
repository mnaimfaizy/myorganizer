import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import type { ThemeColors } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

/**
 * What each variant is made of, named by Semantic Role rather than by resolved
 * colour so one table serves both colour modes. Pinned to the variant set, and
 * one table rather than two: a variant renamed in one of a pair of literals
 * and not the other compiles.
 */
const VARIANTS = {
  primary: { fill: 'primary', label: 'primaryForeground', edge: null },
  secondary: {
    fill: 'secondary',
    label: 'secondaryForeground',
    edge: 'border',
  },
  destructive: {
    fill: 'destructive',
    label: 'destructiveForeground',
    edge: null,
  },
  ghost: { fill: null, label: 'foreground', edge: null },
} as const satisfies Record<
  ButtonVariant,
  {
    fill: keyof ThemeColors | null;
    label: keyof ThemeColors;
    edge: keyof ThemeColors | null;
  }
>;

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  /** A glyph before the label. Decorative — the label is what is announced. */
  icon?: IconName;
  /** Shows a spinner in place of the label and stops accepting presses. */
  busy?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  variant = 'primary',
  icon,
  busy = false,
  disabled = false,
  style,
  ...rest
}: ButtonProps): React.JSX.Element {
  const theme = useTheme();
  const { fill, label: labelRole, edge } = VARIANTS[variant];
  const inert = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy }}
      disabled={inert}
      style={({ pressed }) => [
        styles.base,
        {
          gap: theme.spacing.sm,
          minHeight: MIN_TOUCH_TARGET,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
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
      {busy ? (
        <ActivityIndicator color={theme.colors[labelRole]} />
      ) : (
        <View style={[styles.content, { gap: theme.spacing.sm }]}>
          {icon != null && <Icon name={icon} size={20} color={labelRole} />}
          <Text variant="body" color={labelRole} style={styles.label}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
});
