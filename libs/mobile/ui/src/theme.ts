import {
  colorPrimary,
  colorSecondary,
  colorTertiary,
  colorCyan,
  colorDestructive,
  colorSurface,
  colorSurfaceContainer,
  colorCard,
  colorBorder,
  colorMuted,
  colorOnPrimary,
  colorOnSecondary,
  radiusSm,
  radiusMd,
  radiusLg,
  radiusXl,
  radius2xl,
  radiusFull,
  spaceXs,
  spaceSm,
  spaceMd,
  spaceLg,
  spaceXl,
  spaceGutter,
  fontDisplay,
  fontBody,
} from '@myorganizer/design-tokens';

/** Convert a CSS length token ("16px" | "1rem") to React Native density pixels. */
function toRnSize(value: string): number {
  if (value.endsWith('rem')) return parseFloat(value) * 16;
  return parseFloat(value);
}

/** Extract the first concrete font family from a CSS font-family stack. */
function firstFamily(stack: string): string {
  const first = stack.split(',')[0]?.trim() ?? '';
  return first.replace(/^['"]|['"]$/g, '');
}

/**
 * The mobile design theme, derived from the SAME `@myorganizer/design-tokens`
 * source the web app uses — colours, spacing, radii, and fonts stay aligned
 * across platforms. CSS length units are normalised to React Native numbers.
 */
export const theme = {
  colors: {
    primary: colorPrimary,
    secondary: colorSecondary,
    tertiary: colorTertiary,
    cyan: colorCyan,
    destructive: colorDestructive,
    surface: colorSurface,
    surfaceContainer: colorSurfaceContainer,
    card: colorCard,
    border: colorBorder,
    muted: colorMuted,
    onPrimary: colorOnPrimary,
    onSecondary: colorOnSecondary,
  },
  spacing: {
    xs: toRnSize(spaceXs),
    sm: toRnSize(spaceSm),
    md: toRnSize(spaceMd),
    lg: toRnSize(spaceLg),
    xl: toRnSize(spaceXl),
    gutter: toRnSize(spaceGutter),
  },
  radii: {
    sm: toRnSize(radiusSm),
    md: toRnSize(radiusMd),
    lg: toRnSize(radiusLg),
    xl: toRnSize(radiusXl),
    '2xl': toRnSize(radius2xl),
    full: toRnSize(radiusFull),
  },
  fonts: {
    display: firstFamily(fontDisplay),
    body: firstFamily(fontBody),
  },
} as const;

export type Theme = typeof theme;
