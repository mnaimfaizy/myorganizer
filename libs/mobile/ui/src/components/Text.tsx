import React from 'react';
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
} from 'react-native';
import { useTheme } from '../useTheme';
import { TEXT_SCALE_CAP } from '../metrics';
import type { ThemeColors } from '../theme';
import {
  FONT_FAMILY,
  fontCutFor,
  type TypeFace,
  type TypeScaleStep,
} from '../typeScale';

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

/**
 * A weight a step can be set at instead of its own.
 *
 * The approved type sheet draws steps re-weighted in place — "body-sm …
 * buttons (at 600, 16 px)" — and the component sheets follow it: a field
 * label is `bodySm` at 600, a chip label `bodySm` at 500, a field error
 * `caption` at 500. Size, line height and tracking stay the step's; only the
 * cut changes, and it is reached through the same weight table the scale
 * uses, so a weight this app bundles no cut for is ignored rather than handed
 * to the platform to render in the system font.
 */
export type TextWeight =
  | 'regular'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'extrabold';

const WEIGHT_VALUE = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const satisfies Record<TextWeight, string>;

const DISPLAY_CUTS: ReadonlySet<string> = new Set([
  FONT_FAMILY.displayBold,
  FONT_FAMILY.displayExtraBold,
]);

/** The bundled cut for `weight` on the face `fontFamily` belongs to, if any. */
function cutForWeight(fontFamily: string, weight: TextWeight): string | null {
  const face: TypeFace = DISPLAY_CUTS.has(fontFamily) ? 'display' : 'body';
  try {
    return fontCutFor(face, WEIGHT_VALUE[weight]);
  } catch {
    return null;
  }
}

export interface TextProps extends RNTextProps {
  children?: React.ReactNode;
  /** A step of the shared type scale. Used whole — size, line height, weight, tracking. */
  variant?: TypeScaleStep;
  /**
   * Sets the step at another weight — size, line height and tracking stay the
   * step's. A weight with no bundled cut on the step's face is ignored.
   */
  weight?: TextWeight;
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
  weight,
  color,
  style,
  maxFontSizeMultiplier = TEXT_SCALE_CAP,
  ...rest
}: TextProps): React.JSX.Element {
  const theme = useTheme();
  const step = theme.type[variant];
  const cut =
    weight === undefined ? null : cutForWeight(step.fontFamily, weight);

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        styles.base,
        step,
        cut !== null && { fontFamily: cut },
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
