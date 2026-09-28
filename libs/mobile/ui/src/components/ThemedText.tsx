import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { useTheme } from '../useTheme';
import type { ThemeColors } from '../theme';
import type { TypeScaleStep } from '../typeScale';

/**
 * Which Semantic Role each step is read in unless the caller says otherwise.
 * Pinned to the step set: the scale decides how big a thing is, and the two
 * metadata steps are the ones that are quieter by default.
 */
const DEFAULT_COLOR_BY_VARIANT = {
  display: 'foreground',
  titleLg: 'foreground',
  title: 'foreground',
  body: 'foreground',
  bodySm: 'foreground',
  labelCaps: 'mutedForeground',
  caption: 'mutedForeground',
} as const satisfies Record<TypeScaleStep, keyof ThemeColors>;

export interface ThemedTextProps extends TextProps {
  children?: React.ReactNode;
  /** A step of the shared type scale. Used whole — size, line height, weight, tracking. */
  variant?: TypeScaleStep;
  /** A Semantic Role to read this text in, overriding the step's default. */
  color?: keyof ThemeColors;
}

export function ThemedText({
  children,
  variant = 'body',
  color,
  style,
  ...rest
}: ThemedTextProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Text
      style={[
        styles.base,
        theme.type[variant],
        { color: theme.colors[color ?? DEFAULT_COLOR_BY_VARIANT[variant]] },
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
