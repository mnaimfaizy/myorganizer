# Production deploys are gated by environment approval, and tags are receipts

The `production` GitHub Environment carries a `required_reviewers` protection rule plus a branch policy limiting it to `release/*`, and both `deploy-backend` and `deploy-frontend` in `.github/workflows/deploy-production.yml` declare `environment: production`. A production run may therefore be **started** by anything — including `dispatch-production-deploy.yml`, which fires on `create` of a `release/vX.Y.Z` branch, finds the newest release branch, and dispatches the deploy against it — but the run halts at the environment gate until a named human approves it. Dispatching a run and approving a deploy are deliberately different acts: automation owns the first, a maintainer owns the second.

The tag follows the deploy rather than causing it. `yarn release:tag` runs only after production is confirmed live, and `release:cut` deliberately has no way to tag (the `--tag` flag was removed for this reason). A `vX.Y.Z` tag therefore means "this version is live in production," which makes `git tag` an accurate deployment history. The common inverse convention — push a tag to trigger the build — suits a desktop installer where the tag is the only distribution event, but here it would leave tags behind for versions that never shipped.

The trap this ADR exists to prevent: `on: create:` sitting on a path that reaches production reads like a hole. It is not. The gate is one layer down, in environment protection that lives in repo settings rather than in any workflow file, so the workflows alone cannot tell you the deploy is safe. Removing the `create:` trigger to "make production manual" removes convenience, not risk. Removing `environment: production` from a deploy job — or the required-reviewer rule from the environment — removes the gate outright while every workflow file still reads exactly as it did before.

## Status

accepted

## Considered Options

- **Manual dispatch only (drop the `create:` trigger)** — rejected. The approval gate already makes production manual. Dropping the trigger only forces the maintainer to locate the newest release branch in the Run-workflow dropdown by hand, and `deploy-production.yml` rejects any ref that is not `refs/heads/release/*`, so the dropdown is easy to get wrong.
- **Tag-as-trigger** — rejected. Pushing `vX.Y.Z` to start the deploy would invert the meaning of every tag in the repo and produce tags for builds that failed to ship.
- **Pre-release versions (`alpha`/`beta`/`rc`)** — rejected. Staging deploys on every green push to `main` and already serves as the pre-release channel; `release.mjs` enforces plain `vX.Y.Z` and rejects prerelease input.

## Consequences

- Process: [`.agents/skills/release-and-deploy-workflow/SKILL.md`](../../.agents/skills/release-and-deploy-workflow/SKILL.md). Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) § Release & Deploy.
- The required-reviewer rule lives in GitHub repo settings, **not** in this repo. It is not code-reviewable and can be removed without a PR. Verify it with `gh api repos/mnaimfaizy/myorganizer/environments/production --jq '.protection_rules'`.
- `dispatch-production-deploy.yml` fires on branch creation, so the approval prompt can appear **before** CI has gone green on `release/vX.Y.Z`. Check CI before approving; the pipeline does not check it for you.
- Renaming the dispatcher matters: its old name, `Deploy Production (latest release)`, read as though the workflow itself deployed. It only dispatches.
