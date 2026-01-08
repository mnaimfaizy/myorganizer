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
  - **Production deploy is manual** (workflow dispatch). No automatic deploys.
  - Both frontend and backend are deployed to **cPanel shared hosting** via FTP/FTPS.

## Workflows

- `.github/workflows/ci.yml` (name: `CI`)

  - Runs `lint`, `test`, `build` using `nx affected`.
  - Triggers on PRs to `main` / `release/*` and on pushes to `main` / `release/*`.

- `.github/workflows/deploy-staging.yml` (name: `Deploy Staging`)

  - Runs only after `CI` succeeds on `main`.
  - Packages backend via `yarn package:backend:api` and uploads `dist/deploy/backend-api/`.
  - Deploys frontend to Vercel using the Vercel CLI.

- `.github/workflows/deploy-production.yml` (name: `Deploy Production (manual)`)
  - Manual only (`workflow_dispatch`).
  - Guarded so it only runs when the selected branch is `release/*`.
  - Packages backend + frontend and uploads:
    - `dist/deploy/backend-api/`
    - `dist/deploy/myorganizer-web/`

## Required GitHub secrets

Configure these in GitHub:

- At the **repository** level, define shared secrets used across all workflows (for example, build or tooling tokens).
- At the **environment** level, define deployment-specific secrets used only for that environment.

The exact secrets required for each environment are documented in the sections below:

- **Staging (main)**
- **Production (release/\*)**

## GitHub Environments (recommended)

This repo uses two GitHub **Environments**:

- `staging`
- `production`

The deploy workflows are already configured to use them:

- Staging workflow uses `environment: staging`.
- Production workflow uses `environment: production`.

Why this matters:

- You can keep **different secrets** for staging vs production.
- You can add **environment protection rules** (approvals) for production.

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

Optional (recommended):

- Add required reviewers for `production` to enforce a manual approval gate.

### Manual approval (required reviewers)

GitHub Actions “manual approval” is typically implemented via **GitHub Environments** and **Required reviewers**.

To enable this for production:

1. Repo → **Settings** → **Environments** → select `production`
2. Under **Deployment protection rules**, enable **Required reviewers**
3. Add one or more reviewers

Behavior:

- When the `Deploy Production (manual)` workflow runs and reaches the job that uses `environment: production`, GitHub will pause and require an approval.
- Only after approval is granted will the job proceed to deploy.

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
- `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`: run `npx vercel@latest link` in `apps/myorganizer`, then read `.vercel/project.json`

Note: Vercel may display this as a **Team ID** in the UI (even for personal accounts). That value maps to `VERCEL_ORG_ID`.

Notes:

- The staging workflow uses `vercel ... --prod`. In practice, this means: “deploy to the Production environment of the Vercel project used for staging”.
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

3. Run the production deploy (manual by design):

- GitHub → **Actions** → `Deploy Production (manual)` → **Run workflow**
- Select the `release/v1.2.3` branch and run.

4. After production deploy succeeds, create and push the version tag:

- Recommended (script):
  - `yarn release:tag --version v1.2.3 --push`
- Manual (git):
  - `git tag -a v1.2.3 -m "Release v1.2.3"`
  - `git push origin v1.2.3`

5. Create a GitHub Release using the tag `v1.2.3` for traceability (release notes + links).

### Release checklist (copy/paste)

Replace `vX.Y.Z` with your version (example: `v0.1.1`).

1. Ensure `main` is healthy:

- CI is green
- Staging deploy is successful

2. Cut the release branch (recommended):

- `yarn release:cut --version vX.Y.Z --push`

What this does:

- Creates `release/vX.Y.Z` from `main`
- Updates root `package.json` version to `X.Y.Z` and commits it (default)

3. Production deploy:

- If you have auto-dispatch enabled, creating the release branch may automatically trigger the production deploy workflow.
- Otherwise: GitHub → Actions → `Deploy Production (manual)` → Run workflow on `release/vX.Y.Z`

4. Tag the release after a successful production deploy:

- `yarn release:tag --version vX.Y.Z --push`

5. Create the GitHub Release:

- GitHub → Releases → Draft a new release
- Tag: `vX.Y.Z`
- Target: `release/vX.Y.Z`

Notes:

- If you need to skip bumping `package.json` version for any reason, pass `--no-version-bump`.
- The scripts enforce strict `vX.Y.Z` (no prerelease strings).

### Release script notes

The script lives at `tools/scripts/release.mjs` and automates the git steps.

- It enforces `vX.Y.Z` format (no prerelease strings).
- It requires a clean working tree.
- `release:cut` requires you to be on `main` and up-to-date with `origin/main`.
- It does **not** trigger the production deploy workflow automatically (the deploy is intentionally manual).

## cPanel notes (after upload)

Both deploy bundles are designed for cPanel shared hosting:

- Backend bundle includes a deploy-ready `package.json` and `prisma/` folder.
  - After upload, run `npm install` in the backend app root.
  - Prisma client generation runs via `postinstall`.
- Frontend bundle is a Next standalone-based deploy with a Linux-safe `server.js`.
  - After upload, run `npm install` in the frontend app root.

The deploy folders also contain `CPANEL_STARTUP.md` files with the exact startup file names.

## Hosting the frontend on Vercel

If you want to host the frontend yourself (independent of this repo’s CI/CD), see: [./VERCEL_FRONTEND_HOSTING.md](./VERCEL_FRONTEND_HOSTING.md).
