---
status: accepted
supersedes: ADR-0007
---

# Mobile styling uses React Native StyleSheet over a token-derived theme

Mobile components style themselves with React Native `StyleSheet` consuming a typed `theme` object built from `@myorganizer/design-tokens`. There is no Tailwind/NativeWind on mobile.

## Context

ADR-0007 chose NativeWind v4 so mobile could reuse Tailwind authoring and the design-token preset. On implementation this proved impossible: NativeWind (via `react-native-css-interop`) requires **Tailwind CSS v3** (`>3.3.0 <4.0.0`), but the web app and `web-ui` are built on **Tailwind v4**. A single-`package.json` Nx monorepo cannot cleanly hold both Tailwind majors, and downgrading the web app to Tailwind 3 is a non-starter.

## Decision

`libs/mobile/ui` exposes a `theme` (colours, spacing, radii, fonts) and a `useTheme()` hook, derived from the same `design-tokens` source the web app uses — CSS length units are normalised to React Native numbers. Components use `StyleSheet.create` with `theme` values. Colour/spacing/radius/font alignment with web is preserved because both platforms read the one token source; #141's resolved-value output feeds the mobile theme.

## Consequences

- No `className` DX on mobile and no Tailwind/NativeWind dependency — zero toolchain conflict, simplest to build.
- The `tailwind-preset.native.js` from #141 is retained as token data feeding the theme (not consumed by NativeWind).
- ADR-0007 is superseded.
