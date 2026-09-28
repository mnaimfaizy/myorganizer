import type { TextStyle } from 'react-native';
import {
  typeBodyLineHeight,
  typeBodySize,
  typeBodySmLineHeight,
  typeBodySmSize,
  typeBodySmTracking,
  typeBodySmWeight,
  typeBodyTracking,
  typeBodyWeight,
  typeCaptionLineHeight,
  typeCaptionSize,
  typeCaptionTracking,
  typeCaptionWeight,
  typeDisplayLineHeight,
  typeDisplaySize,
  typeDisplayTracking,
  typeDisplayWeight,
  typeLabelCapsLineHeight,
  typeLabelCapsSize,
  typeLabelCapsTracking,
  typeLabelCapsWeight,
  typeTitleLgLineHeight,
  typeTitleLgSize,
  typeTitleLgTracking,
  typeTitleLgWeight,
  typeTitleLineHeight,
  typeTitleSize,
  typeTitleTracking,
  typeTitleWeight,
} from '@myorganizer/design-tokens';

/**
 * A step of the shared type scale, named as the tokens name it. `titleLg` and
 * `bodySm` are the camelCase spellings of the `title-lg` and `body-sm` tokens.
 */
export type TypeScaleStep =
  | 'display'
  | 'titleLg'
  | 'title'
  | 'body'
  | 'bodySm'
  | 'labelCaps'
  | 'caption';

/** One type-scale step as React Native reads it: numbers, not CSS lengths. */
export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: TextStyle['fontWeight'];
  textTransform?: TextStyle['textTransform'];
}

/**
 * The bundled font files, named after their own PostScript names.
 *
 * Neither platform can reach a 600 or an 800 cut through a family name plus a
 * weight — Android maps only regular/bold/italic onto a family, and these are
 * separate static families on iOS — so a weight is selected by naming its file.
 * See apps/mobile/src/assets/fonts/README.md.
 */
export const FONT_FAMILY = {
  displayBold: 'PlusJakartaSans-Bold',
  displayExtraBold: 'PlusJakartaSans-ExtraBold',
  bodyRegular: 'Inter-Regular',
  bodySemiBold: 'Inter-SemiBold',
} as const;

/**
 * Which bundled cut renders each step. Pinned to the step set, so a new step
 * without a font is a compile error rather than a silent system-font fallback.
 */
const FONT_FAMILY_BY_STEP = {
  display: FONT_FAMILY.displayExtraBold,
  titleLg: FONT_FAMILY.displayBold,
  title: FONT_FAMILY.displayBold,
  body: FONT_FAMILY.bodyRegular,
  bodySm: FONT_FAMILY.bodyRegular,
  labelCaps: FONT_FAMILY.bodySemiBold,
  caption: FONT_FAMILY.bodyRegular,
} as const satisfies Record<TypeScaleStep, string>;

/** A CSS length token (`16px` | `1rem`) as React Native density pixels. */
export function toRnSize(value: string): number {
  const size = value.endsWith('rem')
    ? parseFloat(value) * 16
    : parseFloat(value);
  if (Number.isNaN(size)) {
    throw new Error(`Design token is not a usable length: ${value}`);
  }
  return size;
}

/**
 * Letter-spacing as React Native wants it: points, not em.
 *
 * The token is in em against the step's own size — one value that means the
 * same thing in CSS and here — so converting needs the size it belongs to.
 */
export function toRnLetterSpacing(tracking: string, fontSize: number): number {
  if (!tracking.endsWith('em')) {
    throw new Error(`Type-scale tracking must be in em, got: ${tracking}`);
  }
  return parseFloat(tracking) * fontSize;
}

/** The weights the scale uses, pinned so an unhandled one fails loudly. */
const FONT_WEIGHTS = {
  '400': '400',
  '600': '600',
  '700': '700',
  '800': '800',
} as const;

export function toRnFontWeight(value: string): TextStyle['fontWeight'] {
  if (!Object.prototype.hasOwnProperty.call(FONT_WEIGHTS, value)) {
    throw new Error(`Type-scale weight is not one this app bundles: ${value}`);
  }
  return FONT_WEIGHTS[value as keyof typeof FONT_WEIGHTS];
}

function step(
  name: TypeScaleStep,
  size: string,
  lineHeight: string,
  weight: string,
  tracking: string,
): TypeStyle {
  const fontSize = toRnSize(size);
  return {
    fontFamily: FONT_FAMILY_BY_STEP[name],
    fontSize,
    lineHeight: toRnSize(lineHeight),
    letterSpacing: toRnLetterSpacing(tracking, fontSize),
    fontWeight: toRnFontWeight(weight),
    // `labelCaps` is the one step whose name is a claim about its casing, so
    // the step carries the casing. A step is used whole or not at all.
    ...(name === 'labelCaps' ? { textTransform: 'uppercase' as const } : {}),
  };
}

/**
 * The shared type scale, converted once. Pinned to the step set in both
 * directions: a step with no entry and an entry for no step both fail here.
 */
export const typeScale = {
  display: step(
    'display',
    typeDisplaySize,
    typeDisplayLineHeight,
    typeDisplayWeight,
    typeDisplayTracking,
  ),
  titleLg: step(
    'titleLg',
    typeTitleLgSize,
    typeTitleLgLineHeight,
    typeTitleLgWeight,
    typeTitleLgTracking,
  ),
  title: step(
    'title',
    typeTitleSize,
    typeTitleLineHeight,
    typeTitleWeight,
    typeTitleTracking,
  ),
  body: step(
    'body',
    typeBodySize,
    typeBodyLineHeight,
    typeBodyWeight,
    typeBodyTracking,
  ),
  bodySm: step(
    'bodySm',
    typeBodySmSize,
    typeBodySmLineHeight,
    typeBodySmWeight,
    typeBodySmTracking,
  ),
  labelCaps: step(
    'labelCaps',
    typeLabelCapsSize,
    typeLabelCapsLineHeight,
    typeLabelCapsWeight,
    typeLabelCapsTracking,
  ),
  caption: step(
    'caption',
    typeCaptionSize,
    typeCaptionLineHeight,
    typeCaptionWeight,
    typeCaptionTracking,
  ),
} satisfies Record<TypeScaleStep, TypeStyle>;
