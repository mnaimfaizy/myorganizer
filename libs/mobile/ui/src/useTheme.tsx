import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Appearance as NativeAppearance, useColorScheme } from 'react-native';
import type { Appearance } from '@myorganizer/mobile/core';
import { resolveColorMode } from './appearance';
import { themeForMode, type Theme } from './theme';

const ThemeContext = createContext<Theme | undefined>(undefined);

export interface ThemeProviderProps {
  /** The User's appearance choice for this device. */
  appearance: Appearance;
  children?: React.ReactNode;
}

/**
 * Resolves the appearance setting against the device's colour scheme and hands
 * the matching theme down. `useColorScheme` re-renders on an OS mode change, so
 * switching the device between light and dark re-themes the app in place.
 *
 * The setting arrives as a prop rather than being read here: the theme is what
 * a colour mode *is*, and where the choice is stored is the app's business.
 */
export function ThemeProvider({
  appearance,
  children,
}: ThemeProviderProps): React.JSX.Element {
  // The same choice for what the platform draws — the Material date dialog,
  // the keyboard, an alert — which otherwise follows the device alone. `null`
  // hands the choice back to the device, so `system` still means it. The
  // web preview has no native appearance to set.
  useEffect(() => {
    if (typeof NativeAppearance.setColorScheme !== 'function') return;
    NativeAppearance.setColorScheme(
      appearance === 'system' ? null : appearance,
    );
  }, [appearance]);

  const systemScheme = useColorScheme();
  const theme = useMemo(
    () => themeForMode(resolveColorMode(appearance, systemScheme)),
    [appearance, systemScheme],
  );

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/**
 * The theme for the current colour mode.
 *
 * Throws outside a `ThemeProvider` rather than falling back to light: a missing
 * provider would otherwise show every dark-mode User a light app, which reads
 * as a design bug rather than as the wiring mistake it is.
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === undefined) {
    throw new Error('useTheme must be used inside a ThemeProvider.');
  }
  return theme;
}
