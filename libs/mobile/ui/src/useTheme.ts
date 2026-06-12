import { theme, type Theme } from './theme';

/**
 * Returns the shared mobile theme. Exposed as a hook (not just the constant)
 * so feature slices can later introduce a ThemeProvider/context for runtime
 * theming without changing any call sites.
 */
export function useTheme(): Theme {
  return theme;
}
