# Mobile UI Agent Guide

## Scope

Shared React Native primitives and the token-derived theme for the mobile client.

## Commands

- Test: `yarn nx test mobile-ui`.
- Lint: `yarn nx lint mobile-ui`.

## Do

- Style with React Native `StyleSheet` and values from `@myorganizer/design-tokens` (ADR 0008).
- Export public components from `src/index.ts`.

## Do Not

- Do not add NativeWind, `className` styling, or a second token palette.
- Do not put feature or vault session logic in this library.
