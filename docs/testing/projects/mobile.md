# Mobile testing (`apps/mobile`, `libs/mobile/*`)

> **Pure logic can be tested here. Rendering a component cannot.** Read this before writing a
> mobile spec. See the Mobile Test Toolchain Note in
> [`TECH_STACK.md`](../../../TECH_STACK.md) and the mobile lane in
> [`unit-test-delegation-workflow`](../../../.agents/skills/unit-test-delegation-workflow/SKILL.md).

## Current state

One mobile library has a Jest project: `libs/mobile/ui/jest.config.ts`, with
`libs/mobile/ui/src/theme.test.ts` in it, covering theme resolution, appearance resolution, and the
Type Scale conversion. It sets `testEnvironment: 'node'` — not the Nx preset's jsdom — because a
mobile library is typechecked without `dom` on purpose ([ADR 0103](../../adr/0103-mobile-native-code-is-typechecked-without-dom-and-reaches-shared-libraries-through-a-portable-entry-point.md)),
and a jsdom environment would let a browser global that cannot exist on a device pass a test.

`apps/mobile/jest.config.ts` also exists, wired to `yarn nx test mobile`, and still holds no test
files. Its `passWithNoTests: true` means that target reports success by finding nothing, which is
not evidence of anything.

## What a mobile spec may import

**Nothing that reaches a renderer.** A spec in a mobile library must not import `react-native`,
`react`, `@testing-library/react-native`, the library's own barrel, or any component — the barrel
and the components reach React Native, and the toolchain below is why that does not run.

A type-only import (`import type { TextStyle } from 'react-native'`) is fine: it is erased before
Jest sees it. That is how `libs/mobile/ui/src/typeScale.ts` is testable while naming React Native
types.

The practical consequence is a design one, not a testing one: keep the logic worth asserting
reachable without a renderer, and the seam stays open. Theme resolution, the Type Scale conversion,
and the Device Settings parsing are all pure for that reason.

## Why rendering is still blocked

| Package                         | Pinned                       | Problem                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@testing-library/react-native` | `~13.2.0` (installed 13.2.2) | Declares **`react-test-renderer` as a peer dependency**, and React has deprecated that package. Its `react` peer is `>=18.2.0` with no upper bound, so React 19.2.3 satisfies it — the React version is _not_ the blocker. RNTL v14 is the line that drops the `react-test-renderer` peer. |
| `react-test-renderer`           | `19.0.0`                     | Deprecated upstream by React, and pinned off-version against React `19.2.3` — a skew in a package React publishes in lockstep with itself.                                                                                                                                                 |

Resolving this means moving to RNTL v14 and dropping `react-test-renderer` — a package change that
waits on whether mobile gets a test gate at all. Neither package is needed by a pure-logic spec,
which is why one exists while this stays open. The mobile verification gate is
**lint + typecheck + format** (ADR 0005) plus `yarn mobile-platform:check`, and mobile work takes no
specialist hop (see the gate matrix in [`AGENTS.md`](../../../AGENTS.md)).

## If you are about to write a mobile test

Ask whether the thing you want to assert is reachable without a renderer. If it is, add it to the
`mobile-ui` project (or a sibling project shaped the same way) and run it with:

```bash
node node_modules/.bin/jest --config=libs/mobile/ui/jest.config.ts --no-coverage --forceExit
```

If it is not — you need to mount a component, fire a press, or read rendered output — stop and
resolve the toolchain first, because the spec will not run. Do not add a mobile test file to make a
target look covered, and do not reach for the blocked packages to get one written.

Note that `tools/scripts/check-mobile-platform.test.mjs` is **not** a Jest test — it is a
`node --test` sibling of its checker, like every other `tools/scripts/check-*.mjs`, and it runs
through `yarn gates:run` rather than through Jest.
