---
status: accepted
---

# Mobile styling uses NativeWind over a generated native token preset

The mobile app styles components with NativeWind v4 (Tailwind syntax on React Native). Color, spacing, radius, and font alignment with the web app is guaranteed by generating a second Tailwind preset from the same `libs/design-tokens` source.

## Context

The existing `tailwind-preset.js` maps tokens to CSS custom properties (`var(--color-primary)`), which React Native cannot resolve. Rather than hand-maintain a parallel mobile palette (which would drift), `design-tokens` emits an additional Style Dictionary output — a native preset with the resolved hex values — from the same `tokens.json`. Web keeps the var-based preset; mobile consumes the hex-based one.

## Considered Options

- **StyleSheet + a typed theme object from `tokens.ts`** — zero new dependencies and simplest to compile, but no shared className DX with web.
- **NativeWind + generated native preset** — chosen. Familiar Tailwind authoring shared with web, and alignment is enforced because both presets regenerate from one token source. Cost: NativeWind native wiring (babel/Metro) and one design-tokens generator addition.

## Consequences

- A single `tokens.json` remains the source of truth for both platforms; regenerating tokens updates web and mobile presets together.
- The mobile build gains NativeWind's babel plugin and Metro transformer as native-build surface.
