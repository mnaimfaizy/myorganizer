import type { Theme as NavigationTheme } from '@react-navigation/native';
import type { Theme } from '@myorganizer/mobile/ui';

/**
 * The four font slots React Navigation paints its own chrome with — a header
 * title it renders, a tab label a screen did not style.
 *
 * Named by weight rather than by Type Scale step, because that is the
 * vocabulary React Navigation has. Each slot takes the bundled cut from the
 * step whose weight it means, so navigator chrome is in the brand fonts rather
 * than the system face, and the weight beside it is that step's own — an
 * assertion the spec pins, so a step re-weighted in `tokens.json` fails a test
 * here instead of silently disagreeing with the family it is paired with.
 */
function navigationFonts(type: Theme['type']): NavigationTheme['fonts'] {
  return {
    regular: { fontFamily: type.body.fontFamily, fontWeight: '400' },
    medium: { fontFamily: type.labelCaps.fontFamily, fontWeight: '600' },
    bold: { fontFamily: type.title.fontFamily, fontWeight: '700' },
    heavy: { fontFamily: type.display.fontFamily, fontWeight: '800' },
  };
}

/**
 * The mobile theme as React Navigation reads it.
 *
 * React Navigation paints surfaces this app never renders itself — the scene
 * background behind a native stack transition, the area outside a screen's
 * safe-area container — and it takes them from its own theme, not from ours.
 * With no `theme` prop it falls back to `DefaultTheme`, a module-level
 * light-only constant: exactly the shape ADR 0109 removed from
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
export function navigationTheme(theme: Theme): NavigationTheme {
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
    fonts: navigationFonts(theme.type),
  };
}
