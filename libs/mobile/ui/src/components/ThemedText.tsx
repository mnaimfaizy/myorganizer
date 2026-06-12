import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { useTheme } from '../useTheme';
import type { Theme } from '../theme';

export type TextVariant = 'heading' | 'body' | 'label' | 'caption';

export interface ThemedTextProps extends TextProps {
  children?: React.ReactNode;
  variant?: TextVariant;
  color?: keyof Theme['colors'];
}

export function ThemedText({
  children,
  variant = 'body',
  color,
  style,
  ...rest
}: ThemedTextProps): React.JSX.Element {
  const theme = useTheme();

  const variantStyle = {
    heading: {
      fontSize: 24,
      fontWeight: '700' as const,
      fontFamily: theme.fonts.display,
      color: theme.colors.primary,
    },
    body: {
      fontSize: 16,
      fontFamily: theme.fonts.body,
      color: theme.colors.primary,
    },
    label: {
      fontSize: 14,
      fontWeight: '600' as const,
      fontFamily: theme.fonts.body,
      color: theme.colors.primary,
    },
    caption: {
      fontSize: 12,
      fontFamily: theme.fonts.body,
      color: theme.colors.muted,
    },
  }[variant];

  return (
    <Text
      style={[
        styles.base,
        variantStyle,
        color != null && { color: theme.colors[color] },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
