# Mobile testing (`apps/mobile`, `libs/mobile/*`)

> **There are no mobile tests, and the toolchain cannot currently run one.** Read this before
> writing the first mobile spec. See the Mobile Test Toolchain Note in
> [`TECH_STACK.md`](../../../TECH_STACK.md) and the mobile lane in
> [`unit-test-delegation-workflow`](../../../.agents/skills/unit-test-delegation-workflow/SKILL.md).

## Current state

`apps/mobile/jest.config.ts` exists and is wired to `yarn nx test mobile`, but there are **zero**
test files under `apps/mobile/` or `libs/mobile/`. The config sets `passWithNoTests: true` and
`src/test-setup.ts` is empty, so the target reports success by finding nothing.

That success is not evidence the toolchain works.

## Why the first test is blocked

| Package                         | Pinned    | Problem                                                                                                                                                                    |
| ------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@testing-library/react-native` | `~13.2.0` | The 13.x line is the React 18 line. This repo runs React `19.2.3`, outside its support window.                                                                             |
| `react-test-renderer`           | `19.0.0`  | Deprecated upstream by React, **and** off-version: a test renderer must match React exactly, so `19.0.0` against `19.2.3` is already wrong independent of the deprecation. |

Resolving this means moving to RNTL v14 and dropping `react-test-renderer` — a package change that
waits on whether mobile gets a test gate at all. Until then the mobile verification gate is
**lint + typecheck + format** (ADR 0005) plus `yarn mobile-platform:check`, and mobile work takes no
specialist hop (see the gate matrix in [`AGENTS.md`](../../../AGENTS.md)).

## If you are about to write a mobile test

Stop and resolve the toolchain first, or the spec will not run meaningfully. Do not add a mobile
test file to make a target look covered.

Note that `tools/scripts/check-mobile-platform.test.mjs` is **not** a Jest test — it is a
`node --test` sibling of its checker, like every other `tools/scripts/check-*.mjs`, and it runs
through `yarn gates:run` rather than through Jest.
