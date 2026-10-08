# Mobile Libraries Agent Guide

## Scope

React Native libraries consumed by the thin `apps/mobile` shell: screens, hooks, UI, utils, and feature adapters under `libs/mobile/*`. This guide also covers `screens`, `core`, `hooks`, and `utils` — four libraries with no Agent Guide of their own, reached only by directory walk-up from this parent.

Root-level React Native rules (package-root imports, edge-to-edge via `react-native-safe-area-context`, `StyleSheet` over the token theme) live in the root [Agent Guide](../../AGENTS.md#react-native) and are not restated here.

## Commands

- Test: `node node_modules/.bin/jest --config=libs/mobile/<lib>/jest.config.ts --no-coverage --forceExit`. Five libraries carry a Jest project — `ui`, `core`, `screens`, `feat/vault`, and `feat/auth` — and `@nx/jest` infers a `test` target from each, so `yarn nx test mobile-ui|mobile-core|mobile-screens|mobile-feat-vault|mobile-feat-auth` works and CI's `nx affected -t test` picks them up. `hooks` and `utils` have none yet.
- **`ui` renders components; `core`, `screens`, `feat/vault`, and `feat/auth` do not.** `ui` runs on `preset: '@react-native/jest-preset'` with `@testing-library/react-native` 14, which dropped the deprecated `react-test-renderer` peer that blocked mobile component tests until #910 — see [its Agent Guide](ui/AGENTS.md) for the two things that catch people out (`render` is async, and the project chains Reanimated's Jest resolver into the Nx one). `core`, `screens`, `feat/vault`, and `feat/auth` still run pure logic in a `node` environment: a spec in any of them must not import `react-native`, `react`, `@testing-library/react-native`, the library barrel, or any component, because those projects have no renderer configured and importing one stops the suite. Logic that must be tested and needs no renderer belongs in a pure module either way.
- Lint: `yarn nx lint <project-name>`.

## Do

- Keep feature screens, hooks, UI, and platform adapters here; the app stays native wiring and navigation entry.
- Compose a screen out of the UI Primitives in `@myorganizer/mobile/ui` rather than assembling one out of `View` and `Pressable`. The primitives are where the touch-target minimum, the text-scaling cap, the Reduce Motion behaviour, and the accessibility roles live; a hand-rolled control has none of them and nothing will tell you.
- Reach for `useSafeAreaInsets` when `SafeAreaView` will not do — e.g. offsetting a fixed-position element or a custom scroll inset — rather than a manual inset calculation.
- Keep vault plaintext and the Master Key on the device.
- Size text with a Type Scale step — `<Text variant="title">` or `theme.type.title` — never a raw `fontSize`. A step carries its line height, weight, tracking, and the bundled font cut that has its weight; picking the size alone loses the other four.
- Read colours from `theme.colors`, which is the Semantic Role set for the resolved colour mode. A Brand Primitive has one value, so a screen reaching one is a screen that only works in light mode.
- Store anything that belongs to one installation of the app as a Device Setting (`@myorganizer/mobile/core`), not in the vault. It is not encrypted, not synced, and not reconciled.

## Do Not

- Do not put this feature code back into `apps/mobile`.
- Do not add NativeWind or `className` styling.
- Do not add a Library README here; Agent Guides only (ADR 0023).
- Do not reach for a theme outside a `ThemeProvider`. `useTheme` throws there rather than defaulting to light, because a silent light fallback reads as a design bug instead of the wiring mistake it is.
