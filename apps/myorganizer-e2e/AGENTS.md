# E2E Agent Guide

## Scope

Playwright end-to-end tests for the MyOrganizer frontend.

## Commands

- Chromium: `yarn nx e2e myorganizer-e2e`.
- Interactive: `yarn nx e2e myorganizer-e2e --ui`.
- Cross-browser targets: `myorganizer-e2e:e2e-firefox`, `myorganizer-e2e:e2e-webkit`, `myorganizer-e2e:e2e-all`.

## How the app is served

The suite runs against a **production build** by default, locally as well as in CI, so that
a local pass means the same thing a CI pass does ([ADR 0050](../../docs/adr/0050-e2e-runs-as-a-blocking-chromium-lane-and-a-nightly-rot-detector.md)).

For the fast edit-run loop, opt out:

```sh
E2E_DEV_SERVER=1 yarn nx e2e myorganizer-e2e
```

That boots the dev server instead. It is quicker, but it no longer matches CI — dev-only
behaviour (unminified bundles, `NODE_ENV` branches, the Next.js dev overlay) is present, and
production-only failures will not reproduce. Reach for it while iterating, not to confirm a fix.

## CI lanes

- **Blocking** — Chromium, on pull requests that `nx affected` says touch `myorganizer-e2e`,
  split across 3 shards in `.github/workflows/ci.yml`. Keeps `retries: 2` and passes on retry.
- **Nightly** — all three browsers as a matrix in `.github/workflows/nightly-e2e.yml`, run with
  `--fail-on-flaky-tests`. Failures open or comment on a single tracking issue.

## Waiting

Do not add `page.waitForLoadState('networkidle')` or `waitForTimeout`. Playwright marks
`networkidle` DISCOURAGED — "rely on web assertions to assess readiness instead" — and two of
the calls were found to hang against a production build. The suite has **none of either** as of
issue #524; keep it that way.

Wait on an assertion about what the page should show:

- A route that can settle into more than one state: one `expect(a.or(b).first()).toBeVisible()`.
- Something disappearing: `await expect(locator).toHaveCount(0, { timeout })` — **not**
  `locator.isHidden({ timeout })`, which samples once and ignores the timeout it is given.
- A controlled input, before the handler that reads its React state fires:
  `await expect(input).toHaveValue(value)`.
- Hydration of a controlled form: probe it with `waitForLoginFormInteractive` from
  `src/e2e/helpers/auth.ts`. `networkidle` never observed hydration, and the WebKit sleeps that
  papered over it are gone.

`src/e2e/helpers/auth.ts` also carries `submitLoginForm` and `waitForDashboardReady`. Use them
rather than growing a seventh copy of the login helper.

## Do

- Test critical user flows and use stable selectors or user-facing queries.
- Build a flow matrix before adding or changing specs: route, preconditions, user steps, selectors, network/data expectations, side effects, and unsupported behavior to avoid.
- Trace the route wrapper into the owning page library before choosing selectors or assertions.
- Keep fixtures deterministic and avoid real third-party services.
- Add focused e2e coverage for meaningful route or workflow changes.

## Do Not

- Do not depend on live Google, email, or external APIs.
- Do not write brittle tests tied to incidental styling.
- Do not test retry, recovery, timeout, or concurrency behavior unless the UI implements it.
- Do not leave generated traces or screenshots committed unless intentionally added.
