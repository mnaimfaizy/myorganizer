# Mobile UI Agent Guide

## Scope

Shared React Native primitives and the token-derived theme for the mobile client.

Root-level React Native rules (package-root imports, edge-to-edge via `react-native-safe-area-context`, `StyleSheet` over the token theme) live in the root [Agent Guide](../../../AGENTS.md#react-native) and are not restated here.

## Commands

- Test: `yarn nx test mobile-ui`.
- Lint: `yarn nx lint mobile-ui`.

## Do

- This library owns the token-derived theme: derive it from `@myorganizer/design-tokens` (ADR 0008), and let the rest of `libs/mobile` reach tokens through it rather than importing the package directly.
- Export public components from `src/index.ts`.

## Do Not

- Do not add NativeWind, `className` styling, or a second token palette.
- Do not put feature or vault session logic in this library.
