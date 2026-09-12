# Mobile App Agent Guide

## Scope

React Native app shell. Feature screens, hooks, UI, and platform adapters live under `libs/mobile/*`. Shares the vault format and auth contract with the web client.

Root-level React Native rules (package-root imports, edge-to-edge via `react-native-safe-area-context`, `StyleSheet` over the token theme) live in the root [Agent Guide](../../AGENTS.md#react-native) and are not restated here.

## Commands

- Start Metro: `yarn nx start mobile`.
- iOS: `yarn nx run-ios mobile`.
- Android: `yarn nx run-android mobile`.
- Test: `yarn nx test mobile`.
- Lint: `yarn nx lint mobile`.
- Typecheck: `yarn nx run mobile:typecheck`.

The autonomous verification gate for mobile is lint + typecheck + format. Do not use `nx run mobile:bundle` (ADR 0005).

## Do

- Keep this app thin: native wiring, root providers, and navigation entry.
- Put feature code in `libs/mobile/*`.
- Store the refresh token in the OS keychain and send it in the refresh body (ADR 0006).
- Keep vault plaintext and the Master Key on the device.

## Do Not

- Do not put feature screens or domain logic in this app beyond the shell.
- Do not add an Operational README here; how to run mobile lives in `DEVELOPMENT.md`.
- Do not run `nx run mobile:bundle` as a slice or PR gate.
- Do not treat mobile refresh as an httpOnly cookie.
- Do not add NativeWind or `className` styling.
- Do not "fix" or exempt `jest.config.ts`'s `require.resolve('react-native/jest/assetFileTransformer.js')` — it's the React Native Jest preset's own transformer, and `yarn mobile-platform:check` already ignores `require.resolve` calls (see the checker's own comment).
