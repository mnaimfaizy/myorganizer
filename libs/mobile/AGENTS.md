# Mobile Libraries Agent Guide

## Scope

React Native libraries consumed by the thin `apps/mobile` shell: screens, hooks, UI, utils, and feature adapters under `libs/mobile/*`.

## Commands

- Test: `yarn nx test <project-name>` (e.g. `mobile-ui`, `mobile-feat-vault`).
- Lint: `yarn nx lint <project-name>`.

## Do

- Keep feature screens, hooks, UI, and platform adapters here; the app stays native wiring and navigation entry.
- Style with React Native `StyleSheet` and the token-derived theme (ADR 0008).
- Keep vault plaintext and the Master Key on the device.

## Do Not

- Do not put this feature code back into `apps/mobile`.
- Do not add NativeWind or `className` styling.
- Do not add a Library README here; Agent Guides only (ADR 0023).
