# CI/CD and release process

This repo uses GitHub Actions for CI/CD.

## Branch strategy

- `main`
  - CI runs on every push.
  - After CI passes, **staging deploy** runs automatically:
    - Frontend deploys to **Vercel** (used as the staging frontend).
    - Backend deploys to **cPanel** via FTP/FTPS.

- `release/*`
  - CI runs on every push.
  - A production deploy **run** starts automatically when the branch is created (see `dispatch-production-deploy.yml`), and can also be started by hand.
  - **No production deploy proceeds without approval.** The `production` Environment carries a required-reviewer rule, so every run pauses until a maintainer approves it. The approval — not the dispatch — is the ship decision. See [ADR 0028](../adr/0028-production-deploys-are-approval-gated-and-tags-are-receipts.md).
  - Both frontend and backend are deployed to **cPanel shared hosting** via FTP/FTPS.

## Workflows

- `.github/workflows/ci.yml` (name: `CI`)
  - Runs `lint`, `test`, `build` using `nx affected`, plus **Publish to Chromatic** (Storybook upload). Visual review is Chromatic’s **UI Tests** GitHub status (pending until Accept/Deny).
  - Triggers on PRs to `main` / `release/*` and on pushes to `main` / `release/*`.
  - Chromatic needs repository secret `CHROMATIC_PROJECT_TOKEN`. Unreviewed visual diffs leave **UI Tests** pending; the publish job still passes (`--exit-zero-on-changes`) so Accept does not require a re-run. Free-plan snapshot quota (CLI exit 11) warns and passes the publish job. See [ADR 0027](../adr/0027-chromatic-ci-visual-tests.md).

- `.github/workflows/deploy-staging.yml` (name: `Deploy Staging`)
  - Runs only after `CI` succeeds on `main`.
  - Packages backend via `yarn package:backend:api` and uploads `dist/deploy/backend-api/`.
  - Deploys frontend to Vercel using the Vercel CLI.

- `.github/workflows/deploy-production.yml` (name: `Deploy Production (manual)`)
  - `workflow_dispatch` only — started either by a person or by `dispatch-production-deploy.yml`.
  - Guarded so it only runs when the selected branch is `release/*`.
  - `deploy-backend` and `deploy-frontend` declare `environment: production`, so the run **pauses for required-reviewer approval** before either touches production.
  - Packages backend + frontend and uploads:
    - `dist/deploy/backend-api/`
    - `dist/deploy/myorganizer-web/`

- `.github/workflows/dispatch-production-deploy.yml` (name: `Dispatch Production Deploy (latest release)`)
  - Fires on `create` of a `release/vX.Y.Z` branch, and on manual dispatch.
  - Finds the newest `release/v*` branch and dispatches `Deploy Production (manual)` against it. It does not deploy anything itself — the name says dispatch for that reason.
  - Because it fires on branch creation, the approval prompt can appear **before** CI has finished on the release branch. Check CI before approving.

- `.github/workflows/release-pr.yml` (name: `Release PR (auto)`)
  - Fires on push to `release/v*` and opens (or updates) a PR from `release/vX.Y.Z` → `main`.
  - Attempts to enable auto-merge on that PR; warns and continues if repository settings disallow it.

- `.github/workflows/publish-github-release.yml` (name: `Publish GitHub Release`)
  - Fires on push of a `v*.*.*` tag, or manual dispatch with a `tag` input.
  - Creates or updates the GitHub Release using the tagged commit's `RELEASE_NOTES.md` as the body. Idempotent.

## Required GitHub secrets

Configure these in GitHub:

- At the **repository** level, define shared secrets used across all workflows (for example, build or tooling tokens).
- At the **environment** level, define deployment-specific secrets used only for that environment.

The exact secrets required for each environment are documented in the sections below:

- **Repository (CI tooling)**
- **Staging (main)**
- **Production (release/\*)**

### Repository (CI tooling)

These are **repository** secrets (Settings → Secrets and variables → Actions), not environment secrets. They are not staging vs production.

- `CHROMATIC_PROJECT_TOKEN` — Chromatic project token for publishing Storybook from `ci.yml`. Required before the Chromatic job can pass. HITL: create the project and add this secret **before** merging that job to `main`. Require Chromatic’s **UI Tests** status check in branch protection (pending until Accept/Deny). See [docs/storybook/README.md](../storybook/README.md) and [ADR 0027](../adr/0027-chromatic-ci-visual-tests.md).

## GitHub Environments

This repo uses two GitHub **Environments**:

- `staging`
- `production`

The deploy workflows are already configured to use them:

- Staging workflow uses `environment: staging`.
- Production workflow uses `environment: production`.

Why this matters:

- Staging and production keep **different secrets**.
- `production` carries **environment protection rules** — a branch policy and a required reviewer — which is what gates the deploy.

### How to create the environments

In GitHub:

1. Repo → **Settings** → **Environments**
2. Create environment: `staging`
3. Create environment: `production`

### Environment rules: restrict deployment branches

To avoid accidental deployments, configure **deployment branch rules** per environment.

In GitHub:

1. Repo → **Settings** → **Environments** → select `staging`
2. Find **Deployment branches**
3. Restrict deployments to `main`

Then:

1. Repo → **Settings** → **Environments** → select `production`
2. Find **Deployment branches**
3. Restrict deployments to branches matching `release/*`

This matches how the workflows are intended to be used:

- `Deploy Staging` runs for `main`
- `Deploy Production (manual)` should only be run from `release/*`

Required (already configured):

- `production` has a **required reviewer**. This is the ship gate — see the next section. Do not remove it.

### Manual approval (required reviewers)

**This is configured, and it is the only thing that makes production deploys manual.** Anything may
_start_ a production run — a person, or `dispatch-production-deploy.yml` on branch creation — but no
run reaches production without a human approving it here.

Behavior:

- When `Deploy Production (manual)` reaches `deploy-backend` or `deploy-frontend` (both declare `environment: production`), GitHub pauses and requires approval.
- Only after approval is granted does the job proceed to deploy.

Verify it is still in place:

```sh
gh api repos/mnaimfaizy/myorganizer/environments/production --jq '.protection_rules'
```

Expect a `required_reviewers` rule alongside the `branch_policy` rule. This lives in repo settings,
**not** in this repository — no pull request will show you if it is removed, and every workflow file
will still read exactly as it does today. Removing it, or removing `environment: production` from a
deploy job, silently turns branch creation into an unattended production deploy.

To re-create it if it is ever lost:

1. Repo → **Settings** → **Environments** → select `production`
2. Under **Deployment protection rules**, enable **Required reviewers**
3. Add one or more reviewers

### Where to put secrets

Prefer adding secrets at the **Environment** level:

- Repo → **Settings** → **Environments** → `staging` → **Environment secrets**
- Repo → **Settings** → **Environments** → `production` → **Environment secrets**

This avoids accidentally reusing production credentials in staging.

### Staging (main)

Backend (cPanel FTP/FTPS):

- `FTP_HOST`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR` (remote directory for backend app root)

Frontend (Vercel):

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

How to get these values:

- `VERCEL_TOKEN`: Vercel Account Settings → Tokens
- `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`: run `corepack yarn dlx vercel@latest link` from the repo root, then read `.vercel/project.json`

Note: Vercel may display this as a **Team ID** in the UI (even for personal accounts). That value maps to `VERCEL_ORG_ID`.

Notes:

- The staging workflow uses `vercel ... --prod`. In practice, this means: “deploy to the Production environment of the Vercel project used for staging”.
- The staging workflow syncs the Vercel project's Install Command, Build Command, Output Directory, and Node.js version before deploying. The token used for `VERCEL_TOKEN` must therefore be allowed to update project settings.
- If you prefer Vercel Preview deployments for staging instead, change `--prod` to a preview deploy and update the docs accordingly.

### Production (release/\*)

Production cPanel FTP/FTPS:

- `FTP_PROD_HOST`
- `FTP_PROD_BACKEND_USERNAME`
- `FTP_PROD_BACKEND_PASSWORD`
- `FTP_PROD_BACKEND_DIR` (remote directory for backend app root)
- `FTP_PROD_FRONTEND_USERNAME`
- `FTP_PROD_FRONTEND_PASSWORD`
- `FTP_PROD_FRONTEND_DIR` (remote directory for frontend app root)

### Host Apply (Staging & Production)

After the backend bundle is uploaded, CI SSHs in to install, migrate, regenerate
the Prisma client, and restart — see [ADR 0056](../adr/0056-ci-owns-host-apply-without-describing-the-jail.md).
This is a public repository, so this table lists secret **names** only. Values
(host, port, user, home paths, the selector app identity) live only in the
`staging` and `production` GitHub Environments — never in git, workflow YAML,
or this document.

Same names in both environments:

| Secret                 | What it is for                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `SSH_HOST`             | Host to connect to for that environment's Host Apply.                                               |
| `SSH_PORT`             | SSH port for that connection.                                                                       |
| `SSH_USER`             | SSH account to connect as.                                                                          |
| `SSH_PRIVATE_KEY`      | Deploy key for that account (never the account password).                                           |
| `SSH_KNOWN_HOSTS`      | The host's public keys, in `known_hosts` format, that the runner must match.                        |
| `APP_ROOT`             | This environment's backend application directory on the host.                                       |
| `COUNTERPART_APP_ROOT` | The **other** environment's `APP_ROOT`, so this one can refuse to equal it.                         |
| `NODEVENV_ACTIVATE`    | Path to that environment's Node virtualenv `activate` script.                                       |
| `SELECTOR_APP_KEY`     | The one app identity Host Apply may load `DATABASE_URL` for from the host's Node.js selector store. |
| `API_ORIGIN`           | Base URL Host Apply's HTTP verification probes call after restart.                                  |

`DATABASE_URL` is never a GitHub secret in either environment. Host Apply loads
it on the host, for `SELECTOR_APP_KEY` only, and never prints it.

Setting these up on a real host — deploy key, host-key pin, Environment
values, and the first live apply on each environment — is
[Host Apply: operator setup and first live apply](HOST_APPLY_OPERATOR_SETUP.md).
Run `yarn host-apply:preflight <environment>` before trusting CI: it checks
every one of those against the real host, read-only, using the same guards
the CI job runs.

Two of those names extend the eight the PRD originally listed, because eight
left two holes. `COUNTERPART_APP_ROOT` is what makes the `APP_ROOT` guard mean
anything: a job scoped to `environment: staging` cannot read `production`'s
secrets to compare the two roots, so each environment carries the other's pin
and refuses to run when they match — without it the guard could only catch an
`APP_ROOT` that was unset, and a shared hosting account would let a `main` push
migrate Production. `SSH_KNOWN_HOSTS` replaces `StrictHostKeyChecking=accept-new`:
the runner is ephemeral and remembers nothing, so trust-on-first-use would have
meant trusting whatever answered, on every run. Both are host paths and public
keys, not credentials, but they stay Environment secrets because this repository
is public and they would describe the jail. A missing value fails the job closed.

Job wiring (issue #567): `host-apply` is a separate job in both
`deploy-staging.yml` and `deploy-production.yml` that `needs` the backend
upload job (`deploy-backend`) and declares that environment's `environment:`
name, so Production's Host Apply waits on the same required-reviewer approval
as the rest of that Environment. Each workflow also accepts a
`workflow_dispatch` input, `apply_only` (default `false` in both), that re-runs
`host-apply` alone without re-uploading the backend bundle.

**Staging Host Apply is operator-triggered, not automatic.** A green `main`
still uploads a Staging bundle on its own, but nothing applies it until someone
dispatches `Deploy Staging`. SSH shell access on the hosting account is a manual
toggle that reverts, so an apply chained to the upload would go red on every
push where the shell happened to be off — and a red apply nobody reads is how
unapplied migrations shipped in the first place. This amends PRD #565 user
story 3; it means an uploaded Staging bundle is not a migrated Staging backend
until you say so, and it is why the Cut checklist's "Staging Host Apply green"
below is load-bearing rather than a formality.

Staging splits its concurrency by whether a job writes to `APP_ROOT`.
`deploy-backend` and `host-apply` share `deploy-staging-apply` with
`cancel-in-progress: false`: a newer push to `main` queues behind them rather
than cancelling an in-flight `prisma migrate deploy` — and rather than FTPing a
fresh bundle into a tree `npm ci` is still working in, which a group covering
only `host-apply` would have allowed. `prepare-dependencies` and
`deploy-frontend` keep `deploy-staging` with `cancel-in-progress: true`, since
neither touches `APP_ROOT`. Production's whole workflow already queues instead
of cancelling, so it needs no such split.

The SSH step captures its output to a file instead of streaming it, and
`tools/scripts/scrub-host-apply-log.mjs` decides whether that output may reach
the Actions log: a log carrying a connection string or a bare `DATABASE_URL=`
is withheld, and only the offending line numbers are printed. This repository
is public, so a streamed log would publish a leak before anything could grade
it.

A failed Host Apply fails the job with no automated rollback and no
restart-anyway; `deploy-frontend` does not depend on `host-apply`, so the two
may run side by side once the backend upload succeeds.

## How to cut a release

### Versioning

We follow semantic versioning (SemVer): `vMAJOR.MINOR.PATCH`.

- **MAJOR**: breaking changes (incompatible API/behavior)
- **MINOR**: new features / enhancements (backwards compatible)
- **PATCH**: bug fixes (backwards compatible)

Examples:

- `v1.1.0` → minor feature release
- `v2.0.0` → breaking-change release
- `v1.1.1` → bugfix-only release

When every commit since the last tag is `docs:`, `ci:`, or `chore:`, there is nothing to ship and the
`VersionBump` agent reports `NO_RELEASE`. That is advice, not a veto — cut anyway if you have a
reason, such as republishing a failed deploy.

Classify on the commit **type**, never on the word "deps". `fix(deps):` is how shipped security
advisories are remediated in this repo and counts as a PATCH; `chore(deps):` and `ci: bump …` never
reach the deployed app.

The agent-facing version of this process lives in
[`.agents/skills/release-and-deploy-workflow/SKILL.md`](../../.agents/skills/release-and-deploy-workflow/SKILL.md).

### Release branch naming

Use a versioned release branch so production deploys are unambiguous:

- `release/v1.2.3`

### Release steps

1. Ensure `main` is green (CI + staging deploy succeeded).
2. Create and push a release branch from `main`.

- Recommended (script):
  - `yarn release:cut --version v1.2.3 --push`
- Manual (git):
  - `git checkout main`
  - `git pull --ff-only`
  - `git checkout -b release/v1.2.3`
  - `git push -u origin release/v1.2.3`

3. Approve the production deploy (the ship decision):

- A run is usually already queued and waiting — pushing the branch in step 2 dispatches one.
- If you need to start one by hand: GitHub → **Actions** → `Deploy Production (manual)` → **Run workflow**, select the `release/v1.2.3` branch, run.
- Confirm CI is green on `release/v1.2.3`, then approve the run. The approval authorises Host Apply; nothing reaches production until you approve.
- Approval does not ship the version — Host Apply (the job that follows) must succeed. The tag receipt comes after Host Apply is green.

4. After production deploy succeeds, create and push the version tag:

- Recommended (script):
  - `yarn release:tag --version v1.2.3 --push`
- Manual (git):
  - `git tag -a v1.2.3 -m "Release v1.2.3"`
  - `git push origin v1.2.3`

  The tag is a **receipt**: `vX.Y.Z` existing means that version is live in production, which is why
  it is applied here and not earlier. `release:cut` has no way to create one.

5. That tag push triggers the `Publish GitHub Release` workflow, which creates the GitHub Release.

- The workflow checks out the tagged commit and uses its `RELEASE_NOTES.md` as the release body.
- Re-running the workflow updates the existing release, so publishing is idempotent.
- To publish an existing tag manually, run the workflow with the `tag` input.

### Release checklist (copy/paste)

Replace `vX.Y.Z` with your version (example: `v0.1.1`).

1. Ensure `main` is healthy:

- CI is green
- Staging deploy is successful
- **Staging Host Apply is green** (backend bundle is uploaded, migrations applied, Prisma client regenerated, and service restarted)

2. Cut the release branch (recommended):

- `yarn release:cut --version vX.Y.Z --push`

What this does:

- Creates `release/vX.Y.Z` from `main`
- Updates root `package.json` version to `X.Y.Z` and commits it (default)
- Updates `CHANGELOG.md` with generated release notes and commits it (default)

3. Production deploy:

- Creating the release branch dispatches a production run automatically; it waits for your approval.
- To start one by hand instead: GitHub → Actions → `Deploy Production (manual)` → Run workflow on `release/vX.Y.Z`
- Check CI is green on `release/vX.Y.Z`, then approve. The approval is the ship decision.

4. Tag the release after Production Host Apply has succeeded:

- Confirm the `Deploy Production (manual)` workflow has completed, including the `host-apply` job.
- Confirm migration status and service health probes (`/docs`, cron paths).
- `yarn release:tag --version vX.Y.Z --push`

This updates `CHANGELOG.md` with generated notes based on commits since the previous tag.
Use `--no-notes` to disable.

The tag is a receipt: `vX.Y.Z` existing means that version is live in production with Host Apply verified.

Optional: write a rolling notes file

- `--notes-file` (no value) writes to `RELEASE_NOTES.md`
- `--notes-file <path>` writes to the provided path

Note: We intentionally avoid generating per-version `release-notes-v*.md` files since `CHANGELOG.md` is the source of truth.

### Release PR automation

`release-pr.yml` runs on every push to `release/v*` and automatically:

- Creates (or updates) a PR from `release/vX.Y.Z` → `main`
- Attempts to enable GitHub auto-merge so it merges after required checks pass

Auto-merge is the only optional part: it needs repository settings to allow auto-merge, and branch
protection rules that do not require manual approvals. If either is missing the workflow logs a
warning and the PR simply waits to be merged by hand.

Notes:

- If you need to skip bumping `package.json` version for any reason, pass `--no-version-bump`.
- The scripts enforce strict `vX.Y.Z` (no prerelease strings).

### Release script notes

The script lives at `tools/scripts/release.mjs` and automates the git steps.

- It enforces `vX.Y.Z` format (no prerelease strings).
- It requires a clean working tree.
- `release:cut` requires you to be on `main` and up-to-date with `origin/main`.
- It does **not** dispatch or approve any deploy. Pushing the release branch is what dispatches a production run (via `dispatch-production-deploy.yml`), and that run still waits for approval.
- `release:cut` **cannot** create a tag. Tagging is a separate command, run only after Production Host Apply succeeds — the tag is a receipt, not a trigger. See [ADR 0028](../adr/0028-production-deploys-are-approval-gated-and-tags-are-receipts.md) and [ADR 0056](../adr/0056-ci-owns-host-apply-without-describing-the-jail.md).

## cPanel notes (after upload)

Both deploy bundles are designed for cPanel shared hosting:

- Backend bundle includes a deploy-ready `package.json`, npm guardrail config, `prisma.config.cjs`, and `prisma/` folder.
  - It also includes a deploy-only `package-lock.json` generated during packaging.
  - After upload, run `npm ci --omit=dev` in the backend app root.
  - Prisma client generation runs via `postinstall`.
- Frontend bundle is a Next standalone-based deploy with a Linux-safe `server.js`.
  - After upload, run `npm install` in the frontend app root.

The deploy folders also contain `CPANEL_STARTUP.md` files with the exact startup file names.

## Hosting the frontend on Vercel

If you want to host the frontend yourself (independent of this repo’s CI/CD), see: [./VERCEL_FRONTEND_HOSTING.md](./VERCEL_FRONTEND_HOSTING.md).
