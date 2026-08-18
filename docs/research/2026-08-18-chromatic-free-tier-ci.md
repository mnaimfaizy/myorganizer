# Chromatic free-tier CI (2026-08-18)

Research date: **2026-08-18**. Sources are Chromatic first-party docs and this repo’s Storybook. Facts not confirmed in those sources are marked **unknown**. Grill decisions: [ADR 0027](../adr/0027-chromatic-ci-visual-tests.md), issue [#367](https://github.com/mnaimfaizy/myorganizer/issues/367).

## Question

Can MyOrganizer run merge-blocking Chromatic UI Tests in GitHub Actions on Chromatic’s **free** plan, given the current Storybook (UI Primitives + Vault UI Components) and this repo’s CI cadence?

---

## TL;DR

- **Yes, on Free**, if we keep **Chrome only**, **no extra viewports/modes**, **no Chromatic accessibility snapshots**, and use **TurboSnap** (`onlyChanged`) after Chromatic unlocks it.
- Free includes **5,000 billed snapshots / month**. Captured snapshots cost **1**; TurboSnap copies cost **0.2**. Hitting the cap **pauses** testing until the next cycle (no overage on Free).
- This Storybook is **29 files / 127 named stories**, **1 viewport × Chrome × no modes** → **127 snapshots per full capture**. Without TurboSnap that is about **39 full CI runs/month**. This repo already ran **9 `CI` jobs in ~16 hours** on 2026-08-18 — full capture on every run will not stay on Free.
- Chromatic unlocks TurboSnap only after **ten successful CI builds**. The first ten are full captures (~1,270 billed) and fit Free.
- TurboSnap is **not valid** on GitHub’s `pull_request` **merge commit**. CI must check out `pull_request.head.sha` and set `CHROMATIC_SHA` / `CHROMATIC_BRANCH` / `CHROMATIC_SLUG`.
- CLI exit **`11`** (`ACCOUNT_QUOTA_REACHED`) is the quota-pause signal. Missing `CHROMATIC_PROJECT_TOKEN` must fail CI.

---

## 1. Free plan limits

| Claim                                                                                                                                  | Source                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Free: $0, 5,000 billed snapshots/month, “equivalent to 25k turbosnaps”, Chrome only, no credit card                                    | [Chromatic pricing](https://www.chromatic.com/pricing)                                            |
| Captured snapshot = **1** billed; TurboSnap copy = **0.2** billed                                                                      | [Billing](https://www.chromatic.com/docs/billing)                                                 |
| `visual snapshots = Tests × Builds × Browsers × Modes`; accessibility snapshots are extra billed; **interaction tests are not billed** | [Billing — how we count](https://www.chromatic.com/docs/billing)                                  |
| Free: when included snapshots are used, **review and testing pause** until next cycle or upgrade. Paid plans bill overage instead.     | [Billing — additional billed snapshots](https://www.chromatic.com/docs/billing)                   |
| Usage alerts can email a threshold (e.g. 80% of the cap)                                                                               | [Billing — usage alerts](https://www.chromatic.com/docs/billing)                                  |
| Extra browsers (Firefox, Safari, Edge) are on paid plans; Chrome is default                                                            | [Pricing](https://www.chromatic.com/pricing); [Browsers](https://www.chromatic.com/docs/browsers) |

**Unknown:** whether Chromatic’s marketing table includes TurboSnap on Free as a _feature toggle_ vs only as the 25k-equivalent math. Repo policy still sets `onlyChanged: true`; Chromatic may no-op TurboSnap until ten CI builds succeed.

---

## 2. CLI exit codes (CI mapping)

From [CLI — Exit codes](https://www.chromatic.com/docs/cli):

| Exit  | Key                              | CI policy (ADR 0027)               |
| ----- | -------------------------------- | ---------------------------------- |
| `0`   | `OK`                             | Pass                               |
| `1`   | `BUILD_HAS_CHANGES`              | **Fail** (unreviewed visual diffs) |
| `2`   | `BUILD_HAS_ERRORS`               | Fail                               |
| `3`   | `BUILD_FAILED`                   | Fail                               |
| `11`  | `ACCOUNT_QUOTA_REACHED`          | **Pass with warning**              |
| `12`  | `ACCOUNT_PAYMENT_REQUIRED`       | Fail (we are not on paid overage)  |
| `21`+ | Storybook / git / network errors | Fail                               |

Do **not** pass `--exit-zero-on-changes` or `--exit-once-uploaded`. The job must wait for comparison results. Token: env `CHROMATIC_PROJECT_TOKEN` is auto-read ([CLI — Authentication](https://www.chromatic.com/docs/cli)).

---

## 3. This repo’s snapshot math

Counted from `libs/web-ui/.storybook/main.ts` globs (27 `web-ui` story files + 2 `web-vault-ui`). `preview.ts` sets **no** Chromatic viewports, modes, or browsers.

|                                           |            Count |
| ----------------------------------------- | ---------------: |
| Story files                               |               29 |
| Named story exports                       |          **127** |
| Chromatic multipliers                     |        1 × 1 × 1 |
| Snapshots per **full** capture            |          **127** |
| Full captures that fit in 5,000           |  **~39 / month** |
| All-TurboSnap copies billed (`127 × 0.2`) |  **~25 / build** |
| All-copy builds that fit in 5,000         | **~197 / month** |

`play()` stories (10) still produce **one** snapshot after the play function ([Snapshots — interaction tests](https://www.chromatic.com/docs/snapshots)). They do not add a second billed snapshot; Chromatic accessibility tests **would**.

Storybook styles: `preview.ts` imports `preview-styles.css` (hard-coded HSL variables). It does **not** import `libs/design-tokens`. A `tokens.json` change would not change Storybook pixels today. Changing `preview-styles.css` is a preview import → TurboSnap **full rebuild**. `tailwind.config.js` is referenced via `@config` in CSS and is listed as a Chromatic `external`.

Sampled GitHub Actions (repo `mnaimfaizy/myorganizer`, 2026-08-18): **9 `CI` runs** (5 `pull_request`, 4 `push` to `main`) in about 16 hours. That is already ~¼ of the monthly full-capture budget.

---

## 4. TurboSnap constraints

| Claim                                                                                                                                                                                                                          | Source                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enable with `--only-changed` / config `onlyChanged: true`                                                                                                                                                                      | [TurboSnap setup](https://www.chromatic.com/docs/turbosnap/setup)                                                                                  |
| **Not allowed immediately**; unlocked after **ten successful CI builds**                                                                                                                                                       | [TurboSnap setup](https://www.chromatic.com/docs/turbosnap/setup)                                                                                  |
| Vite stats: Storybook 8+ `--stats-json` on `build-storybook`                                                                                                                                                                   | [TurboSnap setup — Vite](https://www.chromatic.com/docs/turbosnap/setup)                                                                           |
| `fetch-depth: 0` required for git history                                                                                                                                                                                      | [GitHub Actions](https://www.chromatic.com/docs/github-actions)                                                                                    |
| **Incompatible with `pull_request` merge commits**; `chromaui/action` works around by using `pull_request.head.sha`. CLI users must set `CHROMATIC_SHA`, `CHROMATIC_BRANCH`, and `CHROMATIC_SLUG` together or they are ignored | [TurboSnap setup — GitHub pull_request](https://www.chromatic.com/docs/turbosnap/setup); [CLI troubleshooting](https://www.chromatic.com/docs/cli) |
| Files imported from `.storybook/preview.*` (and `externals`) force a full recapture                                                                                                                                            | [TurboSnap introduction](https://www.chromatic.com/docs/turbosnap)                                                                                 |

This repo’s CI already uses `pull_request` (feature PRs) and `push` only to `main` / `release/**` (not feature branches). Chromatic on PRs **must** check out the PR head SHA.

---

## 5. First project — official quickstart vs this repo

Chromatic’s first-start path is the [Quickstart](https://www.chromatic.com/docs/quickstart/), not the [Visual Tests addon](https://www.chromatic.com/docs/visual-tests-addon/). Numbered steps below are Chromatic’s; bullets under each step are this repo.

### 1. Sign up and create a new project

> “Generate a unique project token for your app by signing in to [Chromatic](https://www.chromatic.com/start) and creating a project. Sign in with your GitHub, GitLab, Bitbucket, or email.” — [Quickstart](https://www.chromatic.com/docs/quickstart/)

Use **GitHub**. The token appears on the setup screen as `npx chromatic --project-token <token>` (also later on **Manage**). Chromatic does **not** document “install the GitHub App” on this page.

Do **not** install `@chromatic-com/storybook`. That addon is a different first-start (sign in from the Storybook panel, writes `projectId` into `chromatic.config.json`). This repo’s gate is the CLI in `ci.yml`.

### 2. Install

> `yarn add --dev chromatic`, then `"chromatic": "chromatic"` which reads `CHROMATIC_PROJECT_TOKEN`. — [Quickstart](https://www.chromatic.com/docs/quickstart/)

Already done. If the CLI offers to write the token into `package.json`, decline ([CLI — Authentication](https://www.chromatic.com/docs/cli) prefers the env var / CI secret).

`.gitignore` entries from the same page (`chromatic.log`, `chromatic-diagnostics.json`, …) are already in this repo.

### 3. Run your first build to establish baselines

> `yarn chromatic --project-token <your-project-token>` — [Quickstart](https://www.chromatic.com/docs/quickstart/)

That command **is** the official first capture. Either run it once locally, or store the token as GitHub secret `CHROMATIC_PROJECT_TOKEN` and let `ci.yml` be the first build. Both upload to Chromatic cloud.

Token in CI: [GitHub Actions — project token secret](https://www.chromatic.com/docs/github-actions) (`CHROMATIC_PROJECT_TOKEN`, repository secret).

### 4–6. Review, discussions, merge

Accept / Deny in Chromatic as documented. Our CI auto-accepts only on **push** to `main` and `release/**`.

### 7. PR check for “UI Tests” — skip

> “Chromatic adds a ‘UI Tests’ badge… Require the check in GitHub…” — [Quickstart](https://www.chromatic.com/docs/quickstart/)

**Do not require that check.** Quota pause would freeze merges. The `CI` job is the gate ([ADR 0027](../adr/0027-chromatic-ci-visual-tests.md)).

### This repo only (not on the quickstart page)

- Stay on **Free**; Chrome only; no Chromatic a11y snapshots; no extra viewports/modes.
- Usage alert at **4,000** billed snapshots ([Billing](https://www.chromatic.com/docs/billing)).
- Secret must exist **before** the Chromatic job is merged to `main`.

---

## 6. What we are not doing

| Rejected                                              | Why                                                  |
| ----------------------------------------------------- | ---------------------------------------------------- |
| Playwright screenshots instead of Chromatic           | #12 already chose Chromatic; leftover was cloud + CI |
| Separate `chromatic.yml`                              | Staging deploys when workflow `CI` succeeds          |
| Required Chromatic GitHub check                       | Quota pause would freeze merges                      |
| Soft-pass when the token is missing                   | Gate could be silently off                           |
| Extra Chromatic viewports / browsers / a11y snapshots | Blow the free cap                                    |
| Treating `yarn chromatic` as a local test             | Chromatic always uploads                             |

---

## 7. Repo mapping

| Path                                         | Role                                                     |
| -------------------------------------------- | -------------------------------------------------------- |
| `.github/workflows/ci.yml`                   | `chromatic` job after `prepare-dependencies`             |
| `chromatic.config.json`                      | `onlyChanged`, `storybookConfigDir`, `externals`, `zip`  |
| `package.json` `chromatic`                   | `chromatic` (token from env)                             |
| `package.json` `build-storybook`             | `nx build-storybook web-ui --stats-json --skip-nx-cache` |
| `docs/storybook/README.md`                   | HITL + commands                                          |
| `docs/adr/0027-chromatic-ci-visual-tests.md` | Decision                                                 |

Nx’s inferred `web-ui:build-storybook` target caches `{options.output-dir}`. Chromatic always appends `--output-dir` under `os.tmpdir()` (`/tmp/chromatic-…` on GitHub-hosted runners). Nx then fails with `Cache output is outside the workspace` even though Storybook itself built (first CI run, exit 105). `--skip-nx-cache` is required so Chromatic can keep its temp output-dir.
