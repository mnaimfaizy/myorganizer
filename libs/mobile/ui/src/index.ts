// @myorganizer/mobile/ui — shared theme + RN primitives.
export {
  darkTheme,
  lightTheme,
  themeForMode,
  type ColorMode,
  type Theme,
  type ThemeColors,
} from './theme';
export {
  FONT_FAMILY,
  toRnFontWeight,
  toRnLetterSpacing,
  toRnSize,
  typeScale,
  type TypeScaleStep,
  type TypeStyle,
} from './typeScale';
export { resolveColorMode } from './appearance';
export { ThemeProvider, useTheme, type ThemeProviderProps } from './useTheme';

export {
  ScreenContainer,
  type ScreenContainerProps,
} from './components/ScreenContainer';
export { ThemedText, type ThemedTextProps } from './components/ThemedText';
export {
  ThemedButton,
  type ThemedButtonProps,
  type ButtonVariant,
} from './components/ThemedButton';
export { ThemedInput, type ThemedInputProps } from './components/ThemedInput';
