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
  textTransform?: TextStyle['textTransform'];
}

/**
 * The bundled font files, named after their own PostScript names.
 *
 * Neither platform can reach a 600 or an 800 cut through a family name plus a
 * weight — Android maps only regular/bold/italic onto a family, and these are
 * separate static families on iOS — so a weight is selected by naming its file.
 * The file *is* the weight, which is why a step carries no `fontWeight` at all:
 * on Android any weight of 700 or more makes React Native look for a
 * `<name>_bold.ttf` that does not exist and fall back to the system font, and
 * on iOS a weight sends the lookup back through the family instead of the cut
 * that was named. See apps/mobile/src/assets/fonts/README.md.
 */
export const FONT_FAMILY = {
  displayBold: 'PlusJakartaSans-Bold',
  displayExtraBold: 'PlusJakartaSans-ExtraBold',
  bodyRegular: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
  bodySemiBold: 'Inter-SemiBold',
  bodyBold: 'Inter-Bold',
} as const;

/** The two faces of the scale: Plus Jakarta Sans for headings, Inter for the rest. */
export type TypeFace = 'display' | 'body';

/**
 * Which face sets each step. Pinned to the step set, so a new step without a
 * face is a compile error rather than a silent system-font fallback.
 */
const FACE_BY_STEP = {
  display: 'display',
  titleLg: 'display',
  title: 'display',
  body: 'body',
  bodySm: 'body',
  labelCaps: 'body',
  caption: 'body',
} as const satisfies Record<TypeScaleStep, TypeFace>;

/**
 * The cuts bundled for each face, keyed by the token weight they carry. A step
 * reaches its cut through its token weight, so re-weighting a step in
 * tokens.json either picks the matching file or fails at load — it cannot keep
 * rendering the old cut while claiming the new weight.
 *
 * The body face carries two weights no Type Scale step names — 500 and 700.
 * They are the tab bar's, whose label the approved design sets in Inter 11/14
 * at 500 inactive and 700 active rather than at a step; a component with a
 * style of its own still reaches its cut here rather than naming a file.
 */
const CUTS = {
  display: {
    '700': FONT_FAMILY.displayBold,
    '800': FONT_FAMILY.displayExtraBold,
  },
  body: {
    '400': FONT_FAMILY.bodyRegular,
    '500': FONT_FAMILY.bodyMedium,
    '600': FONT_FAMILY.bodySemiBold,
    '700': FONT_FAMILY.bodyBold,
  },
} as const satisfies Record<TypeFace, Record<string, string>>;

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

/**
 * The bundled cut that renders `face` at a token weight. Throws for a weight
 * this app bundles no cut for, rather than handing the platform a weight it
 * would silently render in the system font.
 */
export function fontCutFor(face: TypeFace, weight: string): string {
  const cuts: Readonly<Record<string, string>> = CUTS[face];
  if (!Object.prototype.hasOwnProperty.call(cuts, weight)) {
    throw new Error(
      `Type-scale weight ${weight} has no bundled ${face} cut: ${Object.keys(cuts).join(', ')}`,
    );
  }
  return cuts[weight];
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
    fontFamily: fontCutFor(FACE_BY_STEP[name], weight),
    fontSize,
    lineHeight: toRnSize(lineHeight),
    letterSpacing: toRnLetterSpacing(tracking, fontSize),
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
