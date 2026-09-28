import {
  radius2xl,
  radiusFull,
  radiusLg,
  radiusMd,
  radiusSm,
  radiusXl,
  roleDark,
  roleLight,
  spaceGutter,
  spaceLg,
  spaceMd,
  spaceSm,
  spaceXl,
  spaceXs,
  type SemanticRoleName,
} from '@myorganizer/design-tokens';
import { shadows, type Shadow, type ShadowName } from './shadows';
import {
  toRnSize,
  typeScale,
  type TypeScaleStep,
  type TypeStyle,
} from './typeScale';

/** Which of the two colour modes a theme is. */
export type ColorMode = 'light' | 'dark';

/** Every Semantic Role, resolved for one colour mode. */
export type ThemeColors = Record<SemanticRoleName, string>;

/**
 * The mobile design theme for one colour mode.
 *
 * Colours come from the **Semantic Roles**, not the Brand Primitives: a
 * primitive has one value and a themed app needs the pair, so reading
 * primitives is what made the old single theme light-only. Spacing, radii, and
 * the type scale are mode-independent and are converted from the same tokens
 * the web reads, with CSS lengths normalised to React Native numbers.
 */
export interface Theme {
  mode: ColorMode;
  colors: ThemeColors;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    gutter: number;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
    full: number;
  };
  type: Record<TypeScaleStep, TypeStyle>;
  shadows: Record<ShadowName, Shadow>;
}

function themeFor(mode: ColorMode, colors: ThemeColors): Theme {
  return {
    mode,
    colors,
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
    type: typeScale,
    shadows,
  };
}

export const lightTheme: Theme = themeFor('light', roleLight);
export const darkTheme: Theme = themeFor('dark', roleDark);

/** The two themes, pinned to the mode set so neither can go missing. */
const THEME_BY_MODE = {
  light: lightTheme,
  dark: darkTheme,
} as const satisfies Record<ColorMode, Theme>;

/** The theme for a resolved colour mode. */
export function themeForMode(mode: ColorMode): Theme {
  return THEME_BY_MODE[mode];
}
