# Mobile UI Agent Guide

## Scope

The mobile client's **UI Primitives** and the token-derived theme they read. Every screen in `libs/mobile/*` is composed out of this library; a screen that reaches for `View` and `Pressable` to build a control is building a second, unthemed one.

Root-level React Native rules (package-root imports, edge-to-edge via `react-native-safe-area-context`, `StyleSheet` over the token theme) live in the root [Agent Guide](../../../AGENTS.md#react-native) and are not restated here.

## Commands

- Test: `node node_modules/.bin/jest --config=libs/mobile/ui/jest.config.ts --no-coverage --forceExit` (or `yarn nx test mobile-ui`).
- Lint: `yarn nx lint mobile-ui`.

## The test project renders components

This is the one Jest project in `libs/mobile` with a renderer. Two things about it are load-bearing:

- **`render` is async.** `@testing-library/react-native` 14 returns a promise; `await render(<X />)` or `screen` throws "`render` function has not been called", which reads as a broken component rather than a missing `await`.
- **React is mapped to `react-for-native`.** React Native 0.79's bundled renderer asserts an exact version match against the React it was built for, and `findNodeHandle` — which the gesture handler calls on mount — loads that renderer. Without the mapping every spec that renders a `GestureDetector` fails on the version pair rather than on anything it asserts.

Native modules are stubbed once in `jest.setup.ts`, each with the double its own package publishes. Add a new native dependency there rather than in a spec, so every spec sees the same device.

## Do

- This library owns the token-derived theme: derive it from `@myorganizer/design-tokens` (ADR 0008), and let the rest of `libs/mobile` reach tokens through it rather than importing the package directly.
- Export public components from `src/index.ts`.
- **Where the approved design draws a value the token scale does not carry, use the nearest token and say so in a comment.** Ties round up — the design sheet's 10pt tab button and 6pt checkbox radius both fall exactly between two steps and both take the larger. A component that hard-codes the sheet's own number instead is a component that stops following the scale the moment the scale moves.
- Give every control a minimum touch target of `MIN_TOUCH_TARGET` (44pt on iOS, 48dp on Android), not a literal.
- Cap text scaling through the `Text` and `TextField` primitives, which apply `TEXT_SCALE_CAP` by default. That is what makes the cap app-wide rather than something each screen has to remember.
- Gate every animation on `useReduceMotion`. The rule is that **motion goes and behaviour stays**: a row still opens, a sheet still appears, a skeleton still marks its space — they just arrive without travelling.
- Expose every gesture as an accessibility action as well. A swipe is unreachable to a screen reader, a switch control, and an external keyboard, so a swipe that is the only way to do something is a feature those Users do not have.

## Do Not

- Do not add NativeWind, `className` styling, or a second token palette.
- Do not put feature or vault session logic in this library. A primitive that needs to lock the Vault takes an `onLock` prop; the screen wires it.
- Do not set a `fontWeight` beside a bundled cut — the file is the weight. See [the fonts README](../../../apps/mobile/src/assets/fonts/README.md).
