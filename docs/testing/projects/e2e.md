# Testing `apps/myorganizer-e2e`

Playwright E2E · `@playwright/test` · `yarn nx e2e myorganizer-e2e`

> **Canonical E2E guidance lives in the skill, not here.**
>
> - Workflow, gate routing, and the never-execute-autonomously policy:
>   [`.agents/skills/playwright-e2e-workflow/SKILL.md`](../../../.agents/skills/playwright-e2e-workflow/SKILL.md)
> - Flow matrix, selector rules, validation:
>   [`references/runbook.md`](../../../.agents/skills/playwright-e2e-workflow/references/runbook.md)
> - Code-level patterns and anti-patterns (Radix, vault unlock, CORS, forms, cross-browser):
>   [`references/e2e-patterns.md`](../../../.agents/skills/playwright-e2e-workflow/references/e2e-patterns.md)
>
> This file covers only the tooling facts specific to the Nx project.

## Config summary

```ts
// apps/myorganizer-e2e/playwright.config.ts
nxE2EPreset(__filename, { testDir: './src/e2e' })
baseURL: process.env.BASE_URL || `http://localhost:${port}`  // 4200 production, 4201 dev
webServer: { command: 'corepack yarn nx run myorganizer:build:production && corepack yarn nx run myorganizer:serve:production', ... }
browsers: chromium, firefox, webkit
```

The suite serves a **production build** by default, locally as well as in CI
([ADR 0050](../../adr/0050-e2e-runs-as-a-blocking-chromium-lane-and-a-nightly-rot-detector.md)).
`E2E_DEV_SERVER=1` swaps in `serve:development` for the fast edit-run loop.

The two modes use different ports — 4200 for production, 4201 for the dev loop
— so that reusing a server can only ever reuse one started for the mode asking.
The production path never reuses at all, and fails with `already used` if
something holds 4200.

The production command builds before it serves, and must keep doing so.
`serve:production` is `next start` against whatever `dist/` already holds — it
never rebuilds — so dropping the build lets the suite test a stale bundle and
report a missing feature as a failing assertion. Nx caches the build, so it is
a no-op when nothing changed.

## File naming

```
apps/myorganizer-e2e/src/e2e/<flow>.spec.ts
```

Use `@playwright/test` (`test`, `expect`) here — **never** Jest. Conversely, never use
`@playwright/test` outside this project.

## Commands

```bash
yarn nx e2e myorganizer-e2e                             # headless, Chromium only
yarn nx e2e myorganizer-e2e --ui                        # interactive UI mode
yarn nx run myorganizer-e2e:e2e-firefox                 # Firefox
yarn nx run myorganizer-e2e:e2e-webkit                  # WebKit
yarn nx run myorganizer-e2e:e2e-all                     # all three, in sequence
yarn nx e2e myorganizer-e2e --grep "<test name>"        # single test by name
```

`e2e` is Chromium-only — the blocking lane's browser. The other browsers are
separate targets, which is what the nightly matrix runs.

Do not commit traces, screenshots, videos, or other generated artifacts.
