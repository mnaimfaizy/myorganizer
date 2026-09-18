# gotoStable retries only interrupted-by-another-navigation

## Status

proposed

## Context

`gotoStable` in `apps/myorganizer-e2e/src/e2e/helpers/navigation.ts` wraps `page.goto` for specs
that hard-navigate after login or between dashboard routes. It retries up to three times when
Playwright aborts with a message that includes both `Navigation to` and
`is interrupted by another navigation`, waits for `domcontentloaded` on the interrupting
navigation, then retries. Any other error rethrows immediately.

The helper was extracted from seven duplicate copies ([#292](https://github.com/mnaimfaizy/myorganizer/issues/292)).
The post-interrupt wait is `waitForLoadState('domcontentloaded')` only — no `networkidle`, no
sleep ([#524](https://github.com/mnaimfaizy/myorganizer/issues/524)). That wait targets a known
race: the app or Playwright starts a concurrent client-side navigation while `gotoStable` is still
in flight, and Playwright surfaces it as an interrupted navigation rather than a hang.

[ADR 0050](0050-e2e-runs-as-a-blocking-chromium-lane-and-a-nightly-rot-detector.md) split E2E into
two lanes with different retry strictness. The blocking Chromium lane keeps Playwright
`retries: 2` and passes on retry. The nightly lane runs all three browsers with
`--fail-on-flaky-tests`, so a test that fails once and passes on a later attempt is reported as
flaky rather than silently green. That flag is what keeps latent timing and engine debt visible;
this decision does not change ADR 0050.

On 2026-09-08 the nightly WebKit run hit a different failure class. In
`vault-claim-evidence.spec.ts` FLOW 2 — rightful owner, silent claim — WebKit alone threw
`page.goto: WebKit encountered an internal error` on `gotoStable(page, '/dashboard/addresses')`
after `login()`. Firefox and Chromium passed the same step. Playwright's test-level retry recovered
the run on attempt #1. The matrix finished 42 passed, 1 flaky, 1 skipped.
[#688](https://github.com/mnaimfaizy/myorganizer/issues/688) tracked the nightly; the next run
was clean and the issue was closed as a one-off. [#703](https://github.com/mnaimfaizy/myorganizer/issues/703)
was filed to decide whether `gotoStable` should broaden its retry allowlist to cover engine-internal
WebKit errors.

The tension is real. Retrying `WebKit encountered an internal error` would absorb the same kind of
infrastructure noise that #524 paid for on a different navigation fault — a transient engine hiccup
that clears on the next attempt. But that message is also how a genuine WebKit crash or product
defect presents. If `gotoStable` retries and succeeds, Playwright never records a failed attempt:
nightly `--fail-on-flaky-tests` would not see a flake, and the rot detector in ADR 0050 would lose
signal. Test-level retries already recovered the #688 incident without changing the helper contract.

## Decision

**Leave the `gotoStable` retry allowlist as-is.** Do not add `WebKit encountered an internal error`
or other engine-internal navigation errors.

The helper continues to retry only the interrupted-by-another-navigation class — messages that
include both `Navigation to` and `is interrupted by another navigation` — then
`waitForLoadState('domcontentloaded')` before the next attempt. Every other `page.goto` error,
including WebKit engine-internal failures, propagates immediately.

Interrupted-by-another-navigation is a known Playwright/app race during concurrent client-side
navigation. Engine-internal errors are not that class and must not be folded into the same helper.

## Considered Options

- **Add `WebKit encountered an internal error` to the allowlist** — rejected. It would treat
  engine-internal failures like navigation races. A helper retry that succeeds on a later attempt
  hides the failure from nightly `--fail-on-flaky-tests` because Playwright never sees a failed
  attempt at the test level. The same error string can mean infrastructure noise or a real defect;
  the nightly lane is the place that distinction must stay visible.
- **Retry all `page.goto` errors up to three times** — rejected. It would retry timeouts, DNS
  failures, and assertion-worthy app bugs, masking regressions across all browsers and defeating
  the purpose of a narrow helper.
- **Remove `gotoStable` retries entirely and rely on Playwright test retries only** — rejected.
  Interrupted-by-another-navigation is frequent enough across dashboard hard-navigations that specs
  without in-call recovery fail intermittently on the race itself; #292 extracted the helper because
  seven copies were already doing this. Test-level retries recover whole tests but do not replace
  a targeted wait-and-retry at the navigation site.

## Consequences

- Contributors changing `apps/myorganizer-e2e/src/e2e/helpers/navigation.ts` must not widen retries
  to engine-internal errors without a new ADR. The allowlist is intentional, not an oversight left
  from #688.
- WebKit engine-internal flakes may still appear in nightly runs. They will surface as test-level
  flakes under `--fail-on-flaky-tests` when Playwright retries recover, or as hard failures when
  they do not — which is the visibility ADR 0050 expects.
- The blocking Chromium lane is unchanged: Playwright `retries: 2` with pass-on-retry still
  absorbs intermittent failures on pull requests. That lane does not run `--fail-on-flaky-tests`.
- Specs that call `login()` then `gotoStable()` to another dashboard route remain subject to
  interrupted-navigation retries only; they should not assume `gotoStable` papered over WebKit
  engine crashes.
- No change to #524's wait policy: after an interrupted navigation, still wait for
  `domcontentloaded` only — not `networkidle`, not a sleep.
