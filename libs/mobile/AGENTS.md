# Mobile Libraries Agent Guide

## Scope

React Native libraries consumed by the thin `apps/mobile` shell: screens, hooks, UI, utils, and feature adapters under `libs/mobile/*`. This guide also covers `screens`, `core`, `hooks`, and `utils` — four libraries with no Agent Guide of their own, reached only by directory walk-up from this parent.

Root-level React Native rules (package-root imports, edge-to-edge via `react-native-safe-area-context`, `StyleSheet` over the token theme) live in the root [Agent Guide](../../AGENTS.md#react-native) and are not restated here.

## Commands

- Test: `yarn nx test <project-name>` (e.g. `mobile-ui`, `mobile-feat-vault`).
- Lint: `yarn nx lint <project-name>`.

## Do

- Keep feature screens, hooks, UI, and platform adapters here; the app stays native wiring and navigation entry.
- Reach for `useSafeAreaInsets` when `SafeAreaView` will not do — e.g. offsetting a fixed-position element or a custom scroll inset — rather than a manual inset calculation.
- Keep vault plaintext and the Master Key on the device.

## Do Not

- Do not put this feature code back into `apps/mobile`.
- Do not add NativeWind or `className` styling.
- Do not add a Library README here; Agent Guides only (ADR 0023).
