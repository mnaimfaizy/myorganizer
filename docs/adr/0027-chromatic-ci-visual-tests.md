# Chromatic UI Tests run inside CI, with TurboSnap, on the free plan

Visual regression for UI Primitives and Vault UI Components was set up locally in #12 and never connected to Chromatic cloud. We run Chromatic **UI Tests as a job in `.github/workflows/ci.yml`** (after `prepare-dependencies`) so “CI passed” includes the visual gate and staging deploy, which already waits on `CI`, cannot ship unreviewed pixels. The job calls `yarn chromatic` with repo secret `CHROMATIC_PROJECT_TOKEN`. There is no Chromatic GitHub App and no extra required check.

PRs stay merge-blocked until visual diffs are accepted in Chromatic. Pushes to `main` and `release/**` auto-accept so each line’s baseline moves after merge. TurboSnap (`onlyChanged`) is on in config: affected stories are captured (1 billed snapshot); unchanged stories are copied (0.2). Chromatic unlocks TurboSnap only after **ten successful CI builds**; until then every story is captured (expected on a new project). We stay on Chromatic’s free plan (5,000 billed snapshots/month, Chrome only): no extra browsers, viewports, modes, or Chromatic accessibility snapshots. If that monthly cap is hit, the CLI exits `11`; the job **warns and exits green** so a quota pause cannot freeze merges for the rest of the month. Missing token, CLI failure, or Chromatic outage still fail CI. The Chromatic project, GitHub secret, and a usage alert (~4,000 billed) are HITL and must exist **before** this job is merged to `main`.

`yarn chromatic` is the CI command, not a local visual-test loop. Chromatic never diffs pixels on a laptop.

## Status

accepted

## Considered Options

- **Publish-only / baseline on `main` without PR gating** — rejected. Stories without a merge-blocking visual comparison still do not catch pixel changes.
- **Playwright (or similar) screenshots in Actions instead of Chromatic** — rejected. #12 already pointed this repo at Chromatic; the leftover was cloud + CI, not a second visual stack.
- **Separate `chromatic.yml`** — rejected. Staging deploys when `CI` succeeds. A sibling workflow would ship to staging unless `deploy-staging.yml` were rewired, and a required Chromatic check would freeze PRs when the free-plan quota pauses.
- **Full capture every run (no TurboSnap)** — rejected for the free plan. This Storybook is 127 stories × 1 viewport × Chrome. At current CI cadence, 5,000 billed snapshots would be exhausted in well under a month.
- **Skip the Chromatic job unless a path glob says “UI changed”** — rejected as the default. TurboSnap already skips recapture for unaffected stories; a homemade skip is how token/CSS/lockfile-adjacent pixel changes get missed. (Storybook today does not import `design-tokens`; `preview-styles.css` is imported from preview and already forces a full TurboSnap rebuild when it changes.)
- **Chromatic GitHub App as a required “UI Tests” check** — rejected. Quota pause would block merges independently of our job’s green exit.
- **Soft-pass when the project token is missing** — rejected. The gate could be off for months without anyone noticing. Unset token fails CI; add the secret before the job lands.

## Consequences

- Setup and commands: [docs/storybook/README.md](../storybook/README.md).
- Quota, snapshot math, GitHub sign-in: [docs/research/2026-08-18-chromatic-free-tier-ci.md](../research/2026-08-18-chromatic-free-tier-ci.md).
- Authoring determinism: [docs/ui/STORYBOOK-PATTERNS.md](../ui/STORYBOOK-PATTERNS.md) §10.
- Issue: [#367](https://github.com/mnaimfaizy/myorganizer/issues/367).
- Do not use `--exit-once-uploaded` or `--exit-zero-on-changes`. TurboSnap needs `fetch-depth: 0`. On `pull_request`, check out `pull_request.head.sha` and set `CHROMATIC_SHA` / `CHROMATIC_BRANCH` / `CHROMATIC_SLUG` — TurboSnap is not valid against GitHub’s ephemeral merge commit. Point Chromatic at `libs/web-ui/.storybook` (the glob already includes `web-vault-ui`). `yarn build-storybook` must pass `--skip-nx-cache`: Chromatic builds into `os.tmpdir()`, and Nx will not cache outputs outside the workspace.
