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

The production command builds before it serves, and must keep doing so. `serve:production` is
`next start` against whatever `dist/` already holds and never rebuilds it, so a suite that only
serves will test a stale bundle: a build predating the branch under test reports every new
feature as a missing element, which reads as a broken spec rather than a stale build. Nx caches
the build, so the guard costs nothing when nothing changed. If a spec fails as though the code
it exercises does not exist, check that `dist/apps/myorganizer/.next/BUILD_ID` is newer than the
work before believing the spec.

## CI lanes

- **Blocking** — Chromium, on pull requests that `nx affected` says touch `myorganizer-e2e`,
  split across 3 shards in `.github/workflows/ci.yml`. Keeps `retries: 2` and passes on retry.
- **Nightly** — all three browsers as a matrix in `.github/workflows/nightly-e2e.yml`, run with
  `--fail-on-flaky-tests`. Failures open or comment on a single tracking issue.

## Waiting

Do not add `page.waitForLoadState('networkidle')` or `waitForTimeout`. Playwright marks
`networkidle` DISCOURAGED — "rely on web assertions to assess readiness instead" — and one of
the calls was found to hang against a production build ([ADR 0050](../../docs/adr/0050-e2e-runs-as-a-blocking-chromium-lane-and-a-nightly-rot-detector.md)).
The suite has **none of either** as of issue #524; keep it that way.

Wait on an assertion about what the page should show:

- A route that can settle into more than one state: one `expect(a.or(b).first()).toBeVisible()`.
  Do this **before** any state probe, or the probe races the render.
- Something disappearing: `await expect(locator).toHaveCount(0, { timeout })`.

`locator.isVisible()` and `locator.isHidden()` do **not** wait — Playwright marks their `timeout`
option deprecated and ignores it, so `isVisible({ timeout: 10000 })` samples once and returns
immediately. They are fine for branching on a state you have already asserted has settled, and
useless as a wait. The suite still has such probes; each one needs a settled page above it.

Filling a controlled input needs no wait before clicking the control that reads it. Everything
under `/dashboard` renders inside `DashboardGuard`, which returns `null` until its client effect
resolves, so a form being on screen there already proves React is driving it and `onChange` is
bound. Note that `expect(input).toHaveValue(v)` proves nothing after a `fill(v)` — `fill` sets
the DOM value itself, so the assertion passes whether or not React saw the change.

The login form is the exception: it is server-rendered, so it can be on screen before hydration,
and a value typed then never reaches React state. `waitForLoginFormInteractive` in
`src/e2e/helpers/auth.ts` probes that; `networkidle` never observed hydration, and the WebKit
sleeps that papered over it are gone. That helper is login-specific — another server-rendered
controlled form needs its own probe.

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
