import type { Theme, ThemeColors } from '@myorganizer/mobile/ui';
import { navigationTheme } from './navigationTheme';

/**
 * Build a minimal fixture theme for testing.
 *
 * Sentinel colour values ensure the mapping catches slot errors: the real light
 * theme has `card` and `raisedSurface` both as `#ffffff`, so asserting equality
 * would pass if the implementation wrongly read `card` instead of `raisedSurface`.
 * Distinct fixtures catch that mistake; role correctness itself is covered by
 * `libs/mobile/ui/src/theme.test.ts`.
 *
 * Type scale steps use the real font weights (body 400, labelCaps 600, title 700,
 * display 800) so a step re-weighted in tokens.json fails a test here rather than
 * silently disagreeing with the family it is paired with.
 */
function buildFixtureTheme(mode: 'light' | 'dark'): Theme {
  const colors = {
    brand: '#brand00',
    background: '#bg0000',
    raisedSurface: '#raised0',
    card: '#card000', // distinct from raisedSurface to catch mapping errors
    foreground: '#fg0000',
    border: '#border0',
    destructive: '#destr00',
    errorText: '#errtxt0', // distinct from destructive to catch mapping errors
    // Placeholder roles not read by navigationTheme (required to satisfy ThemeColors)
    primary: '#prim00',
    secondary: '#sec000',
    tertiary: '#tert00',
    neutral: '#neut00',
    neutralVariant: '#nvar00',
    outline: '#outl00',
    outlineVariant: '#ovar00',
    scrim: '#scrim0',
    surfaceDim: '#sdim00',
    surface: '#surf00',
    surfaceBright: '#sbri00',
    surfaceContainerLowest: '#scl000',
    surfaceContainerLow: '#scll00',
    surfaceContainer: '#scnt00',
    surfaceContainerHigh: '#sch000',
    surfaceContainerHighest: '#schs00',
    onBrand: '#obra00',
    onBrandContainer: '#obrc00',
    onBackground: '#obg000',
    onSurface: '#osrf00',
    onSurfaceVariant: '#osrv00',
    onErrorContainer: '#oerrc0',
    onTertiary: '#oter00',
    onTertiaryContainer: '#oterc0',
    tertiaryContainer: '#terc00',
    onSecondaryContainer: '#osecc0',
    secondaryContainer: '#secc00',
    onPrimaryContainer: '#oprc00',
    primaryContainer: '#primc0',
    onNeutral: '#oneut0',
    onOutline: '#oout00',
  } as unknown as ThemeColors;

  const type = {
    body: {
      fontFamily: 'body-font',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0,
      fontWeight: 400 as const,
    },
    labelCaps: {
      fontFamily: 'labelcaps-font',
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.5,
      fontWeight: 600 as const,
    },
    title: {
      fontFamily: 'title-font',
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: 0,
      fontWeight: 700 as const,
    },
    display: {
      fontFamily: 'display-font',
      fontSize: 57,
      lineHeight: 64,
      letterSpacing: 0,
      fontWeight: 800 as const,
    },
    // Placeholder steps not read by navigationTheme
    bodySm: {
      fontFamily: 'bodysm-font',
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.25,
      fontWeight: 400 as const,
    },
    titleLg: {
      fontFamily: 'titlelg-font',
      fontSize: 32,
      lineHeight: 40,
      letterSpacing: 0,
      fontWeight: 700 as const,
    },
    caption: {
      fontFamily: 'caption-font',
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.4,
      fontWeight: 400 as const,
    },
  };

  return {
    mode,
    colors,
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, gutter: 16 },
    radii: { sm: 4, md: 8, lg: 12, xl: 16, '2xl': 20, full: 999 },
    type,
  } as unknown as Theme;
}

describe('navigationTheme', () => {
  describe('dark mode indicator', () => {
    it('sets dark=true when theme mode is dark', () => {
      const darkTheme = buildFixtureTheme('dark');
      const result = navigationTheme(darkTheme);
      expect(result.dark).toBe(true);
    });

    it('sets dark=false when theme mode is light', () => {
      const lightTheme = buildFixtureTheme('light');
      const result = navigationTheme(lightTheme);
      expect(result.dark).toBe(false);
    });
  });

  describe('colour mapping', () => {
    it('maps brand to primary', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.colors.primary).toBe('#brand00');
    });

    it('maps background to background', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.colors.background).toBe('#bg0000');
    });

    it('maps raisedSurface to card (not the card role)', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.colors.card).toBe('#raised0');
      expect(result.colors.card).not.toBe('#card000');
    });

    it('maps foreground to text', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.colors.text).toBe('#fg0000');
    });

    it('maps border to border', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.colors.border).toBe('#border0');
    });

    it('maps destructive to notification (not the errorText role)', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.colors.notification).toBe('#destr00');
      expect(result.colors.notification).not.toBe('#errtxt0');
    });

    it('returns exactly six colour slots with no undefined values', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      const colorKeys = Object.keys(result.colors);
      expect(colorKeys).toEqual([
        'primary',
        'background',
        'card',
        'text',
        'border',
        'notification',
      ]);
      expect(
        colorKeys.every(
          (key) =>
            result.colors[key as keyof typeof result.colors] !== undefined,
        ),
      ).toBe(true);
    });
  });

  describe('font mapping', () => {
    it('maps body to regular with fontWeight="400"', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.fonts.regular.fontFamily).toBe(theme.type.body.fontFamily);
      expect(result.fonts.regular.fontWeight).toBe(
        String(theme.type.body.fontWeight),
      );
    });

    it('maps labelCaps to medium with fontWeight="600"', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.fonts.medium.fontFamily).toBe(
        theme.type.labelCaps.fontFamily,
      );
      expect(result.fonts.medium.fontWeight).toBe(
        String(theme.type.labelCaps.fontWeight),
      );
    });

    it('maps title to bold with fontWeight="700"', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.fonts.bold.fontFamily).toBe(theme.type.title.fontFamily);
      expect(result.fonts.bold.fontWeight).toBe(
        String(theme.type.title.fontWeight),
      );
    });

    it('maps display to heavy with fontWeight="800"', () => {
      const theme = buildFixtureTheme('light');
      const result = navigationTheme(theme);
      expect(result.fonts.heavy.fontFamily).toBe(theme.type.display.fontFamily);
      expect(result.fonts.heavy.fontWeight).toBe(
        String(theme.type.display.fontWeight),
      );
    });
  });

  describe('immutability', () => {
    it('does not mutate the input theme', () => {
      const theme = buildFixtureTheme('light');
      const themeBefore = JSON.stringify(theme);
      navigationTheme(theme);
      const themeAfter = JSON.stringify(theme);
      expect(themeAfter).toBe(themeBefore);
    });
  });

  describe('end-to-end mapping consistency across modes', () => {
    it('applies the same colour and font mappings in both light and dark modes', () => {
      const lightTheme = buildFixtureTheme('light');
      const darkTheme = buildFixtureTheme('dark');
      const lightResult = navigationTheme(lightTheme);
      const darkResult = navigationTheme(darkTheme);

      // Colours should map identically (same sentinel values)
      expect(lightResult.colors).toEqual(darkResult.colors);

      // Fonts should map identically
      expect(lightResult.fonts).toEqual(darkResult.fonts);

      // Only dark flag should differ
      expect(lightResult.dark).toBe(false);
      expect(darkResult.dark).toBe(true);
    });
  });
});
