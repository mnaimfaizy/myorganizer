# E2E runs as a blocking Chromium lane and a nightly rot detector

## Status

accepted

## Context

`.github/workflows/ci.yml` had no e2e job. Because nothing ran the Playwright suite, a fixture
collection error introduced in `c2702d9` aborted the entire run for days with no signal, and 13
underlying test failures sat behind it undetected for months ([#506](https://github.com/mnaimfaizy/myorganizer/issues/506)).
The suite was repaired, but nothing yet stops it rotting again — which is what this decision is for.

Two facts shape the answer.

**The suite is hermetic.** Auth, `/admin/users`, and vault sync are stubbed with `routeApi`; it needs
only the Next.js app. No backend, no Docker, no seeded database. Running it in CI is cheap in
infrastructure terms.

**It is expensive in wall-clock.** Playwright recommends `workers: 1` in CI "to prioritize stability
and reproducibility", and `nxE2EPreset` already sets that. Serially, the suite costs roughly 5–6
minutes per browser locally and more on `ubuntu-latest`. All three browsers as a blocking PR check
would be a ~30-minute gate with a real flake surface — the configuration most likely to be made
non-blocking within a quarter, which lands us back where #506 started.

The repository is public, so Actions minutes are free. Wall-clock is the only budget.

## Decision

**Two lanes with different jobs, different strictness, and different costs.**

- **Blocking lane** — Chromium only, on `pull_request`, gated on `nx affected` containing
  `myorganizer-e2e` (matching the existing `build-frontend` pattern). Split across **3 shards** plus a
  `merge-reports` job, keeping the CI critical path near its current ~7 minutes. Keeps `retries: 2`
  and **passes on retry**.
- **Nightly lane** — all three browsers as a **matrix over browsers** (not shards), on cron
  `17 3 * * *` plus `workflow_dispatch`, against `main`. Runs with **`--fail-on-flaky-tests`**. On
  failure it reuses the issue pattern already proven in `monthly-agent-model-audit.yml`: find the open
  issue by fixed title, comment if present, create if not.

**The app is served from a production build.** `webServer.command` becomes
`nx run myorganizer:serve:production`, **including locally**, with `E2E_DEV_SERVER=1` as a documented
opt-out for fast iteration.

**Browsers are installed per lane** — `playwright install --with-deps chromium` in the blocking lane,
all three only in the nightly. Browser binaries are **not** cached, per Playwright's guidance that
restoring the cache costs about as much as downloading.

**The blocking lane does not run on `push` to `main`.** The same commits ran it on the pull request
moments earlier, and the nightly covers `main`.

## Considered options

**All three browsers blocking on every PR.** Rejected: ~30 minutes, and the flake surface is
concentrated in exactly the browser we can least afford to block on. WebKit needed a raised timeout on
the heaviest vault test during #506; that belongs in a lane where nobody is waiting.

**Nightly only, nothing blocking.** Rejected: it fixes rot but not regression. The `c2702d9` collection
error would have been caught pre-merge for near-zero marginal cost on an already-affected-gated
pipeline.

**Dev server, as previously configured.** Rejected on fidelity. A dev-server suite is structurally
blind to anything that only manifests in a production build — minification, `NODE_ENV` branches,
tree-shaking, bundling-dependent hydration. The page snapshots captured during #506 literally contain
a `button "Open Next.js Dev Tools"`; the suite was asserting against an artifact nobody ships. Calling
that green is a subtler version of the false confidence #506 is about.

**`CI ? production : development`.** Rejected, and this is the non-obvious one. It looks like the best
of both, but it reintroduces the gap being closed here: local green would not mean CI green. That
divergence is not theoretical — `page.waitForLoadState('networkidle')` on `/signup` hangs against a
production build and settles against dev. Under a CI-only switch, the person most likely to hit a
production-only hang is the person who just wrote the test, and they would need to already know a flag
exists to reproduce it.

**`--fail-on-flaky-tests` on the blocking lane.** Rejected. The blocking lane's question is "did this
PR break something?", and a test that fails once then passes is usually not evidence that it did.
Failing PRs on that teaches one behaviour — hit re-run — and ends with someone disabling the gate. A
`networkidle` hang still blocks a PR regardless, because it times out on all three attempts; retries
only absorb genuinely intermittent failures, which is their purpose.

## Consequences

The suite carries **48 `networkidle` calls and 51 `waitForTimeout` sleeps**. Playwright marks
`networkidle` DISCOURAGED — "Don't use this method for testing, rely on web assertions to assess
readiness instead" — and only one of the 48 was observed to hang against a production build. The rest
are latent, and slower CI hardware is where they surface. This decision deliberately does **not**
block on rewriting 47 working call sites; `--fail-on-flaky-tests` in the nightly is what keeps that
debt visible rather than silently absorbed. Expect follow-up fixes in the first weeks after the job
goes live. The debt is tracked separately.

A naive local `yarn nx e2e` is now slower, because it builds the app. `E2E_DEV_SERVER=1` is the escape
hatch and must be documented in `apps/myorganizer-e2e/AGENTS.md`, or it becomes folklore.

Backend-only pull requests skip the blocking lane entirely. This is correct — the suite stubs the
backend and cannot be broken by it — but it means the e2e gate is not evidence about backend changes.
