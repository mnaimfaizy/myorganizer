# Testing `apps/myorganizer-e2e`

Playwright E2E · `@playwright/test` · `yarn nx e2e myorganizer-e2e`

> **Canonical E2E guidance lives in the skill, not here.**
>
> - Workflow, gate routing, and the never-execute-autonomously policy:
>   [`.github/skills/playwright-e2e-workflow/SKILL.md`](../../../.github/skills/playwright-e2e-workflow/SKILL.md)
> - Flow matrix, selector rules, validation:
>   [`references/runbook.md`](../../../.github/skills/playwright-e2e-workflow/references/runbook.md)
> - Code-level patterns and anti-patterns (Radix, vault unlock, CORS, forms, cross-browser):
>   [`references/e2e-patterns.md`](../../../.github/skills/playwright-e2e-workflow/references/e2e-patterns.md)
>
> This file covers only the tooling facts specific to the Nx project.

## Config summary

```ts
// apps/myorganizer-e2e/playwright.config.ts
nxE2EPreset(__filename, { testDir: './src/e2e' })
baseURL: process.env.BASE_URL || 'http://localhost:4200'
webServer: { command: 'npx nx run myorganizer:serve:development', ... }
browsers: chromium, firefox, webkit
```

## File naming

```
apps/myorganizer-e2e/src/e2e/<flow>.spec.ts
```

Use `@playwright/test` (`test`, `expect`) here — **never** Jest. Conversely, never use
`@playwright/test` outside this project.

## Commands

```bash
yarn nx e2e myorganizer-e2e                             # headless, all browsers
yarn nx e2e myorganizer-e2e --ui                        # interactive UI mode
yarn nx e2e-ci myorganizer-e2e                          # CI mode (no reuse of existing server)
yarn nx e2e myorganizer-e2e --testFile=<path>.spec.ts   # single spec
```

Do not commit traces, screenshots, videos, or other generated artifacts.
