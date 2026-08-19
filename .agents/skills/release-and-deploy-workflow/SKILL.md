---
name: release-and-deploy-workflow
description: 'Use when cutting releases, preparing staging or production deployments, updating release automation, or validating GitHub Actions deployment flow for MyOrganizer.'
---

# Release And Deploy Workflow

## Use This Skill When

- The user asks to cut, prepare, or ship a release
- Deciding the next version number (SemVer), or whether to release at all
- Generating or committing release notes / CHANGELOG entries
- Creating and pushing a `release/*` branch
- Approving or verifying the production deploy in GitHub Actions
- Tagging after a successful production deploy
- Editing release automation scripts or deployment workflows
- Verifying environment rules, branch protection, or secrets alignment

## Hard Stops (never proceed past these)

- Phase 2 started before the user confirmed the plan from Phase 1 → **stop**
- Working tree is dirty when cutting a release → **stop**, fix first
- Local `main` is behind `origin/main` → **stop**, pull first
- Target release branch already exists locally or on origin → **stop**, surface conflict
- Production deployment approved before CI is green on the release branch → **stop**
- Tag creation attempted before the production deploy is confirmed successful → **stop**
- A change that removes `environment: production` from a deploy job, or weakens the
  `required_reviewers` rule on that environment → **stop**, that rule is the ship gate

## Branch + Environment Model

| Branch           | CI            | Staging auto-deploy   | Production deploy                        |
| ---------------- | ------------- | --------------------- | ---------------------------------------- |
| `main`           | ✅ on push/PR | ✅ automatic after CI | ❌ never                                 |
| `release/vX.Y.Z` | ✅ on push/PR | ❌                    | ✅ only after required-reviewer approval |

- GitHub environment `staging` is restricted to `main`.
- GitHub environment `production` is restricted to `release/*` **and** carries a `required_reviewers`
  protection rule. That approval — not the dispatch — is the ship decision.
- Tag only after the production deploy succeeds. The tag is a **receipt**, not a trigger: `vX.Y.Z`
  existing means that version is live in production.

---

## Phase 1 — Release Plan (propose, then stop)

This is the front door. When the user asks to release, produce **one** plan and **wait**. Do not cut,
commit, push, deploy, or tag from this phase.

Run all three advisors:

| Advisor          | Question it answers            |
| ---------------- | ------------------------------ |
| `PreflightCheck` | Is the repo ready to cut?      |
| `VersionBump`    | What version — or none at all? |
| `ReleaseNotes`   | What shipped since the tag?    |

```
runSubagent("PreflightCheck", "Validate release readiness")
runSubagent("VersionBump", "Propose next semver from latest tag..HEAD")
runSubagent("ReleaseNotes", "<previous-tag>..HEAD")
```

Combine their output into a single block:

1. **Readiness** — the `PreflightCheck` verdict. Any FAIL item stops the plan here.
2. **Proposed version** — the `VersionBump` line, `v` prefixed.
3. **Why** — the strongest commit signal that drove the bump.
4. **Alternatives** — the next bump down (or up), and when it would be right instead.
5. **Draft release notes** — user-facing bullets grouped Added / Fixed / Changed. Not a raw `git log`.
   These are the notes Phase 2 ships via `--notes-from`, so draft them properly here rather than
   planning to fix them after the cut.

Then **stop and wait** for the user to confirm the version and edit the notes. "Confirm if in doubt"
is not enough — everything after this phase writes to `origin`.

If `VersionBump` returns `NO_RELEASE`, say so plainly and give the reason. It is advice, not a veto:
if the user still wants to cut, proceed with the version they name.

---

## Phase 2 — Cut the release branch

Only after the user confirms. Save the agreed Phase 1 notes to a scratch file **outside the repo**
(`cut` requires a clean tree, so an edited `RELEASE_NOTES.md` in the working directory will block
it), then pass that file to `--notes-from`:

```sh
yarn release:cut --version vX.Y.Z --push --notes-from <scratch>/release-notes.md
```

That writes the prose to `RELEASE_NOTES.md` inside the release commit. Do **not** cut first and fix
the notes afterwards — a later commit moves the branch head past the SHA that CI verifies and the
reviewer approves in Phases 3–4, and the Phase 5 tag would then name a commit that never deployed.

Flags:

- `--push` — push the branch to `origin` immediately
- `--notes-from <path>` — use hand-written prose verbatim as the release notes
- `--notes-file <path>` — where notes are written (default `RELEASE_NOTES.md`)
- `--dry-run` — preview all steps without side effects
- `--no-version-bump` — skip `package.json` update (rare; use only if bumped manually)
- `--no-notes` — skip CHANGELOG/notes generation (rare; cannot be combined with `--notes-from`)

The script will:

1. Assert clean tree on `main`, up-to-date with `origin/main`
2. Create `release/vX.Y.Z`
3. Bump `package.json` version → `X.Y.Z`
4. Write `RELEASE_NOTES.md` — authored prose with `--notes-from`, otherwise generated
5. Generate and write the CHANGELOG entry — **always** generated from the commit range, never the
   authored prose, so `CHANGELOG.md` stays a uniform commit log across every release
6. Commit: `chore(release): vX.Y.Z`
7. Push branch (if `--push`)

`RELEASE_NOTES.md` is a rolling file: the next release overwrites it. Authored prose survives on the
GitHub Release page, which `publish-github-release.yml` builds from the file at the tagged commit.

The script cannot tag. Tagging is Phase 5, and only after production is confirmed live.

Pushing the branch sets off two workflows: `release-pr.yml` opens a PR back to `main`, and
`Dispatch Production Deploy (latest release)` queues a production run that will wait for approval.

---

## Phase 3 — Verify CI on the release branch

Wait for CI to pass on `release/vX.Y.Z`.

Check GitHub Actions → `CI` workflow → select the `release/vX.Y.Z` branch run.

Do **not** approve a production deployment until this is green.

---

## Phase 4 — Approve the production deploy

Production ships only when a required reviewer approves it. Both `deploy-backend` and
`deploy-frontend` declare `environment: production`, so the run pauses before either job touches
production and waits for a human.

A run reaches that prompt one of two ways:

- **Automatically** — `Dispatch Production Deploy (latest release)` fires on creation of a
  `release/vX.Y.Z` branch, finds the newest release branch, and dispatches the production deploy
  against it. The Phase 2 push usually starts this for you.
- **Manually** — Actions → `Deploy Production (manual)` → Run workflow, branch dropdown set to
  `release/vX.Y.Z`. The workflow rejects any ref that is not `refs/heads/release/*`.

Before approving, confirm:

1. **CI is green** on `release/vX.Y.Z`. The dispatcher fires on branch creation, so the approval
   prompt can appear before CI has finished — the gate is yours, not the pipeline's.
2. The run's ref is the release branch you intend to ship.

Then approve in the GitHub UI. Both jobs must succeed.

If the deploy fails:

- Fix the issue on `release/vX.Y.Z` (push a fix commit)
- CI re-runs automatically
- Wait for CI green, then re-run and re-approve the deploy

---

## Phase 5 — Tag after successful production deploy

Only after the production deploy is confirmed successful:

```sh
yarn release:tag --version vX.Y.Z --push
```

The script will:

1. Assert clean tree on `release/vX.Y.Z`
2. Verify `package.json` version matches
3. Create annotated tag `vX.Y.Z`
4. Push the tag to `origin`

Pushing the tag triggers `publish-github-release.yml`, which checks out the tagged commit and creates
or updates the GitHub Release using `RELEASE_NOTES.md` as its body.

---

## Phase 6 — Merge the release PR back to main

`release-pr.yml` creates a PR from `release/vX.Y.Z` → `main` automatically.

1. Review the auto-created PR (title: `chore(release): vX.Y.Z`)
2. Ensure CI passes on the PR
3. Merge (squash or merge commit — follow repo conventions)

This keeps `main` current with the CHANGELOG entry and version bump from the release.

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

If you change `.github/workflows/deploy-staging.yml`, `deploy-production.yml`,
`dispatch-production-deploy.yml`, or `ci.yml`:

1. Verify the branch guards match the documented model above (and in `CI_CD_AND_RELEASE_PROCESS.md`)
2. Verify secrets referenced exist in the correct GitHub Environment (`staging` or `production`)
3. Update `docs/deployment/CI_CD_AND_RELEASE_PROCESS.md` if operational behavior changes
4. Keep `release-pr.yml` and `dispatch-production-deploy.yml` aligned with the release branch naming
   pattern (`release/v*`)

**Never let a job reach production without `environment: production`.** The `required_reviewers`
rule on that environment is the only thing standing between an automated dispatch and a live deploy,
and it lives in GitHub repo settings — no workflow file will show you it is missing. Auto-dispatching
a production _run_ is fine and intended; auto-_approving_ one is not. See
[ADR 0028](../../../docs/adr/0028-production-deploys-are-approval-gated-and-tags-are-receipts.md)
before "fixing" the `create:` trigger on `dispatch-production-deploy.yml` — it is deliberate.

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

| Bump         | When                                                | Example             |
| ------------ | --------------------------------------------------- | ------------------- |
| `NO_RELEASE` | Every commit in range is `docs:` / `ci:` / `chore:` | —                   |
| PATCH        | Bug fixes, perf, refactor, style, test, build       | `v1.1.0` → `v1.1.1` |
| MINOR        | New backwards-compatible features                   | `v1.1.1` → `v1.2.0` |
| MAJOR        | Breaking changes                                    | `v1.2.0` → `v2.0.0` |

Conventional commit signals:

- `docs:` / `ci:` / `chore:` only → NO_RELEASE (advisory — the maintainer may still cut)
- `fix:` → PATCH — **including `fix(deps):`**, which is how shipped security advisories are remediated here
- `feat:` → MINOR
- `feat!:` or `BREAKING CHANGE:` footer → MAJOR

Classify on the commit **type**, never on the word "deps". `chore(deps):` and `ci: bump …` never
reach the deployed app; `fix(deps):` does.

MyOrganizer does not use pre-release versions. `release.mjs` rejects anything that is not `vX.Y.Z` —
staging is the pre-release channel.

---

## Sub-agent delegation map

| Task                            | Agent            | Model                  |
| ------------------------------- | ---------------- | ---------------------- |
| Pre-flight readiness check      | `PreflightCheck` | GPT-5.6 Luna (copilot) |
| Propose next semver version     | `VersionBump`    | GPT-5.6 Luna (copilot) |
| Draft release notes / CHANGELOG | `ReleaseNotes`   | GPT-5.6 Luna (copilot) |

---

## Key References

- [ADR 0028](../../../docs/adr/0028-production-deploys-are-approval-gated-and-tags-are-receipts.md) — why production is approval-gated and tags are receipts
- `docs/deployment/CI_CD_AND_RELEASE_PROCESS.md` — full CI/CD documentation
- `.github/workflows/ci.yml` — CI workflow
- `.github/workflows/deploy-staging.yml` — staging deploy
- `.github/workflows/deploy-production.yml` — production deploy (approval-gated)
- `.github/workflows/dispatch-production-deploy.yml` — finds the newest release branch and dispatches the production deploy
- `.github/workflows/release-pr.yml` — auto release PR creator
- `.github/workflows/publish-github-release.yml` — GitHub Release publisher (on tag push)
- `tools/scripts/release.mjs` — release script (`cut` + `tag` commands)
- `package.json` — `release:cut`, `release:tag` script aliases
- `.github/agents/release-notes.agent.md` — ReleaseNotes agent
- `.github/agents/version-bump.agent.md` — VersionBump agent
- `.github/agents/preflight-check.agent.md` — PreflightCheck agent
