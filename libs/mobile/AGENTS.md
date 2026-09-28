# Mobile Libraries Agent Guide

## Scope

React Native libraries consumed by the thin `apps/mobile` shell: screens, hooks, UI, utils, and feature adapters under `libs/mobile/*`. This guide also covers `screens`, `core`, `hooks`, and `utils` — four libraries with no Agent Guide of their own, reached only by directory walk-up from this parent.

Root-level React Native rules (package-root imports, edge-to-edge via `react-native-safe-area-context`, `StyleSheet` over the token theme) live in the root [Agent Guide](../../AGENTS.md#react-native) and are not restated here.

## Commands

- Test: `node node_modules/.bin/jest --config=libs/mobile/<lib>/jest.config.ts --no-coverage --forceExit`. Three libraries carry a Jest project — `ui`, `core`, and `screens` — and `@nx/jest` infers a `test` target from each, so `yarn nx test mobile-ui|mobile-core|mobile-screens` works and CI's `nx affected -t test` picks them up. `feat/auth`, `feat/vault`, `hooks`, and `utils` have none yet.
- Those projects run **pure logic only** — theme resolution and the Type Scale conversion. A spec here must not import `react-native`, `react`, `@testing-library/react-native`, the library barrel, or any component: rendering a mobile component is still blocked by the Mobile Test Toolchain Note in `TECH_STACK.md`, and importing any of those pulls the blocked toolchain in and the suite stops running. Logic that must be tested and cannot be reached without a renderer belongs in a shared library such as `vault-core` instead.
- Lint: `yarn nx lint <project-name>`.

## Do

- Keep feature screens, hooks, UI, and platform adapters here; the app stays native wiring and navigation entry.
- Reach for `useSafeAreaInsets` when `SafeAreaView` will not do — e.g. offsetting a fixed-position element or a custom scroll inset — rather than a manual inset calculation.
- Keep vault plaintext and the Master Key on the device.
- Size text with a Type Scale step — `<ThemedText variant="title">` or `theme.type.title` — never a raw `fontSize`. A step carries its line height, weight, tracking, and the bundled font cut that has its weight; picking the size alone loses the other four.
- Read colours from `theme.colors`, which is the Semantic Role set for the resolved colour mode. A Brand Primitive has one value, so a screen reaching one is a screen that only works in light mode.
- Store anything that belongs to one installation of the app as a Device Setting (`@myorganizer/mobile/core`), not in the vault. It is not encrypted, not synced, and not reconciled.

## Do Not

- Do not put this feature code back into `apps/mobile`.
- Do not add NativeWind or `className` styling.
- Do not add a Library README here; Agent Guides only (ADR 0023).
- Do not reach for a theme outside a `ThemeProvider`. `useTheme` throws there rather than defaulting to light, because a silent light fallback reads as a design bug instead of the wiring mistake it is.
