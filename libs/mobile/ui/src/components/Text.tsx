import React from 'react';
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
} from 'react-native';
import { useTheme } from '../useTheme';
import { TEXT_SCALE_CAP } from '../metrics';
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

export interface TextProps extends RNTextProps {
  children?: React.ReactNode;
  /** A step of the shared type scale. Used whole — size, line height, weight, tracking. */
  variant?: TypeScaleStep;
  /** A Semantic Role to read this text in, overriding the step's default. */
  color?: keyof ThemeColors;
}

/**
 * Every string the app renders.
 *
 * It is the one place the app-wide text-scaling cap is applied, which is what
 * makes the cap app-wide rather than a thing each screen has to remember: a
 * caller can lower it for a control whose width is fixed — the tab bar does —
 * but nothing renders above it.
 */
export function Text({
  children,
  variant = 'body',
  color,
  style,
  maxFontSizeMultiplier = TEXT_SCALE_CAP,
  ...rest
}: TextProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        styles.base,
        theme.type[variant],
        { color: theme.colors[color ?? DEFAULT_COLOR_BY_VARIANT[variant]] },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
