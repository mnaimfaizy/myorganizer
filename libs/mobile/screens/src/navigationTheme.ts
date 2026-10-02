import type { Theme as NavigationTheme } from '@react-navigation/native';
import type { Theme } from '@myorganizer/mobile/ui';

/**
 * Which platform's font rules to build for. Not read from `Platform` here:
 * this module derives everything from what it is handed, which is what lets it
 * be tested without reaching React Native.
 */
export type NavigationPlatform = 'ios' | 'android';

/**
 * The four font slots React Navigation paints its own chrome with — a header
 * title it renders, a tab label a screen did not style.
 *
 * Named by weight rather than by Type Scale step, because that is the
 * vocabulary React Navigation has. Each slot takes the bundled cut from the
 * step whose weight it means, so navigator chrome is in the brand fonts rather
 * than the system face.
 *
 * **The weight beside the cut is platform-specific, and it has to be.** React
 * Navigation's font type requires a weight, but the two platforms read one
 * differently: iOS turns a weight into a lookup inside the named family, so
 * the step's own weight is what lands on the right cut, while React Native
 * on Android treats any weight of 700 or more as bold and goes looking for a
 * `<name>_bold.ttf` that this app does not ship (`ReactFontManager`, seen on
 * 0.79 and unchanged in 0.87) — which is how #909's header titles came out in
 * Roboto. The Type Scale answers this by setting no weight at all (see
 * `typeScale.ts`); here a weight is not optional, so the two heavy slots say
 * 400 on Android and let the cut carry the weight.
 */
function navigationFonts(
  type: Theme['type'],
  platform: NavigationPlatform,
): NavigationTheme['fonts'] {
  // Only 700 and above is misread, so the two lighter slots are the same on
  // both platforms.
  const heavyWeight = platform === 'android' ? '400' : null;

  return {
    regular: { fontFamily: type.body.fontFamily, fontWeight: '400' },
    medium: { fontFamily: type.labelCaps.fontFamily, fontWeight: '600' },
    bold: {
      fontFamily: type.title.fontFamily,
      fontWeight: heavyWeight ?? '700',
    },
    heavy: {
      fontFamily: type.display.fontFamily,
      fontWeight: heavyWeight ?? '800',
    },
  };
}

/**
 * The mobile theme as React Navigation reads it.
 *
 * React Navigation paints surfaces this app never renders itself — the scene
 * background behind a native stack transition, the area outside a screen's
 * safe-area container — and it takes them from its own theme, not from ours.
 * With no `theme` prop it falls back to `DefaultTheme`, a module-level
 * light-only constant: exactly the shape ADR 0112 removed from
 * `libs/mobile/ui`, and with the same consequence, a light seam in a dark app.
 *
 * Derived wholly from the `Theme` it is handed, with no module constant of its
 * own — including the fonts, which is why this module imports nothing at
 * runtime and can be tested without reaching React Native.
 *
 * `card` is the raised surface rather than the `card` role: React Navigation
 * means by it the chrome sitting above the page — a header, a tab bar — which
 * is what `raisedSurface` names here. `notification` is the badge tint, and a
 * badge is an attention fill, so it reads `destructive` rather than
 * `errorText`.
 */
export function navigationTheme(
  theme: Theme,
  platform: NavigationPlatform,
): NavigationTheme {
  return {
    dark: theme.mode === 'dark',
    colors: {
      primary: theme.colors.brand,
      background: theme.colors.background,
      card: theme.colors.raisedSurface,
      text: theme.colors.foreground,
      border: theme.colors.border,
      notification: theme.colors.destructive,
    },
    fonts: navigationFonts(theme.type, platform),
  };
}
