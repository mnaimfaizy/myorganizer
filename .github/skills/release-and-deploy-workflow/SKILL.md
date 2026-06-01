---
name: release-and-deploy-workflow
description: 'Use when cutting releases, preparing staging or production deployments, updating release automation, or validating GitHub Actions deployment flow for MyOrganizer.'
---

# Release And Deploy Workflow

## Use This Skill When

- The user asks to cut, prepare, or ship a release
- Deciding the next version number (SemVer)
- Generating or committing release notes / CHANGELOG entries
- Creating and pushing a `release/*` branch
- Triggering or verifying the production deploy in GitHub Actions
- Tagging after a successful production deploy
- Editing release automation scripts or deployment workflows
- Verifying environment rules, branch protection, or secrets alignment

## Hard Stops (never proceed past these)

- Production deploy attempted from `main` → **stop**
- Tag creation attempted before production deploy is confirmed successful → **stop**
- Working tree is dirty when cutting a release → **stop**, fix first
- Local `main` is behind `origin/main` → **stop**, pull first
- Target release branch already exists locally or on origin → **stop**, surface conflict

## Branch + Environment Model

| Branch           | CI            | Staging auto-deploy   | Production deploy                  |
| ---------------- | ------------- | --------------------- | ---------------------------------- |
| `main`           | ✅ on push/PR | ✅ automatic after CI | ❌ never                           |
| `release/vX.Y.Z` | ✅ on push/PR | ❌                    | ✅ manual `workflow_dispatch` only |

- GitHub environment `staging` is restricted to `main`.
- GitHub environment `production` is restricted to `release/*`.
- Tag only after the `Deploy Production (manual)` workflow run succeeds.

---

## End-to-End Release Workflow

### Phase 0 — Pre-flight

Before starting, delegate to the **`PreflightCheck`** agent:

```
runSubagent("PreflightCheck", "Validate release readiness for vX.Y.Z")
```

The agent checks: clean working tree, on `main`, up-to-date with `origin/main`, staging CI green, no version conflict.

If `PreflightCheck` reports any FAIL item, resolve it before continuing.

---

### Phase 1 — Decide the next version

If the user has not specified a version, delegate to **`VersionBump`**:

```
runSubagent("VersionBump", "Propose next semver from latest tag..HEAD")
```

The agent inspects conventional commits since the last tag and returns a single line:

```
v1.3.0 (minor — new features added)
```

Confirm the proposed version with the user if there is any doubt (e.g. a `feat!` / BREAKING CHANGE suggests a major bump).

---

### Phase 2 — Draft release notes

Delegate to **`ReleaseNotes`**:

```
runSubagent("ReleaseNotes", "<previous-tag>..HEAD")
```

The agent returns structured Markdown. The **main agent writes it** to `RELEASE_NOTES.md` if needed, or passes it as `--notes-file` to the release script.

---

### Phase 3 — Cut the release branch

Run the release script (it creates the branch, bumps `package.json`, updates `CHANGELOG.md`, commits, and optionally pushes):

```sh
yarn release:cut --version vX.Y.Z --push --notes-file RELEASE_NOTES.md
```

Flags:

- `--push` — push the branch to `origin` immediately
- `--notes-file RELEASE_NOTES.md` — write notes to file AND include it in the release commit
- `--dry-run` — preview all steps without side effects (use to verify before running for real)
- `--no-version-bump` — skip `package.json` update (rare; use only if bumped manually)
- `--no-notes` — skip CHANGELOG/notes generation (rare)

The script will:

1. Assert clean tree on `main`, up-to-date with `origin/main`
2. Create `release/vX.Y.Z`
3. Bump `package.json` version → `X.Y.Z`
4. Generate and write CHANGELOG entry (and `RELEASE_NOTES.md` if `--notes-file` given)
5. Commit: `chore(release): vX.Y.Z`
6. Push branch (if `--push`)

The `release-pr.yml` workflow fires automatically on push to `release/v*` and opens (or updates) a PR from `release/vX.Y.Z` → `main`.

---

### Phase 4 — Verify CI on the release branch

After pushing, wait for CI to pass on `release/vX.Y.Z` before deploying.

Check GitHub Actions → `CI` workflow → select the `release/vX.Y.Z` branch run.

Do **not** proceed to Phase 5 until CI is green.

---

### Phase 5 — Deploy to production (manual)

Trigger the manual workflow in GitHub Actions:

1. GitHub → **Actions** → `Deploy Production (manual)` → **Run workflow**
2. Select branch: `release/vX.Y.Z`
3. Click **Run workflow**

Monitor the run. Both backend (cPanel FTP) and frontend jobs must succeed.

If the deploy fails:

- Fix the issue on `release/vX.Y.Z` (push a fix commit)
- CI re-runs automatically
- Wait for CI green, then re-trigger the deploy workflow

---

### Phase 6 — Tag after successful production deploy

Only after the production deploy is confirmed successful, run:

```sh
yarn release:tag --version vX.Y.Z --push
```

The script will:

1. Assert clean tree on `release/vX.Y.Z`
2. Verify `package.json` version matches
3. Create annotated tag `vX.Y.Z`
4. Push the tag to `origin`

---

### Phase 7 — Merge the release PR back to main

The `release-pr.yml` workflow creates a PR from `release/vX.Y.Z` → `main` automatically.

1. Review the auto-created PR (title: `chore(release): vX.Y.Z`)
2. Ensure CI passes on the PR
3. Merge (squash or merge commit — follow repo conventions)

This keeps `main` up-to-date with the CHANGELOG entry and version bump from the release.

---

## Staging-only deploy (no release)

Staging is automatic — it deploys on every green push to `main`. No manual steps needed.

If staging is broken:

- Fix on a feature branch, open a PR to `main`, merge after CI passes
- Staging re-deploys automatically

---

## Dry-run before any release

Always recommend (or run) a dry-run first when in doubt:

```sh
yarn release:cut --version vX.Y.Z --dry-run
yarn release:tag --version vX.Y.Z --dry-run
```

Dry-run logs every action without touching git or the filesystem.

---

## Editing deployment workflows

If you change `.github/workflows/deploy-staging.yml`, `deploy-production.yml`, or `ci.yml`:

1. Verify the branch guards match the documented model above (and in `CI_CD_AND_RELEASE_PROCESS.md`)
2. Verify secrets referenced exist in the correct GitHub Environment (`staging` or `production`)
3. Update `docs/deployment/CI_CD_AND_RELEASE_PROCESS.md` if operational behavior changes
4. Keep `release-pr.yml` aligned with the release branch naming pattern (`release/v*`)

---

## Secrets reference

| Secret                       | Environment  | Purpose                    |
| ---------------------------- | ------------ | -------------------------- |
| `FTP_HOST`                   | `staging`    | Backend cPanel host        |
| `FTP_USERNAME`               | `staging`    | Backend cPanel user        |
| `FTP_PASSWORD`               | `staging`    | Backend cPanel password    |
| `FTP_SERVER_DIR`             | `staging`    | Remote backend dir         |
| `VERCEL_TOKEN`               | `staging`    | Vercel deploy token        |
| `VERCEL_ORG_ID`              | `staging`    | Vercel org/team id         |
| `VERCEL_PROJECT_ID`          | `staging`    | Vercel project id          |
| `FTP_PROD_HOST`              | `production` | Prod cPanel host           |
| `FTP_PROD_BACKEND_USERNAME`  | `production` | Prod backend FTP user      |
| `FTP_PROD_BACKEND_PASSWORD`  | `production` | Prod backend FTP password  |
| `FTP_PROD_BACKEND_DIR`       | `production` | Prod backend remote dir    |
| `FTP_PROD_FRONTEND_USERNAME` | `production` | Prod frontend FTP user     |
| `FTP_PROD_FRONTEND_PASSWORD` | `production` | Prod frontend FTP password |
| `FTP_PROD_FRONTEND_DIR`      | `production` | Prod frontend remote dir   |

---

## SemVer quick reference

| Bump  | When                              | Example             |
| ----- | --------------------------------- | ------------------- |
| PATCH | Bug fixes only                    | `v1.1.0` → `v1.1.1` |
| MINOR | New backwards-compatible features | `v1.1.1` → `v1.2.0` |
| MAJOR | Breaking changes                  | `v1.2.0` → `v2.0.0` |

Conventional commit signals:

- `fix:` → PATCH
- `feat:` → MINOR
- `feat!:` or `BREAKING CHANGE:` footer → MAJOR

---

## Sub-agent delegation map

| Task                            | Agent            | Model      |
| ------------------------------- | ---------------- | ---------- |
| Pre-flight readiness check      | `PreflightCheck` | GPT-5 mini |
| Propose next semver version     | `VersionBump`    | GPT-5 mini |
| Draft release notes / CHANGELOG | `ReleaseNotes`   | GPT-5 mini |

---

## Key References

- `docs/deployment/CI_CD_AND_RELEASE_PROCESS.md` — full CI/CD documentation
- `.github/workflows/ci.yml` — CI workflow
- `.github/workflows/deploy-staging.yml` — staging deploy
- `.github/workflows/deploy-production.yml` — production deploy (manual)
- `.github/workflows/release-pr.yml` — auto release PR creator
- `tools/scripts/release.mjs` — release script (`cut` + `tag` commands)
- `package.json` — `release:cut`, `release:tag` script aliases
- `.github/agents/release-notes.agent.md` — ReleaseNotes agent
- `.github/agents/version-bump.agent.md` — VersionBump agent
- `.github/agents/preflight-check.agent.md` — PreflightCheck agent
