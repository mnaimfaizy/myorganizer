---
name: release-and-deploy-workflow
description: 'Use when cutting releases, preparing staging or production deployments, updating release automation, or validating GitHub Actions deployment flow for MyOrganizer.'
---

# Release And Deploy Workflow

## Use This Skill When

- Cutting a release branch or version
- Preparing or validating staging or production deploys
- Editing release automation, changelog flow, or deployment workflows
- Verifying environment rules, branch rules, or deployment prerequisites

## Core Rules

- `main` is for CI plus automatic staging deployment.
- `release/*` is for production deployment.
- Production deployment is manual and should run only from a `release/*` branch.
- Tag only after a successful production deployment.

## Workflow

1. Confirm the target environment and expected source branch before changing anything.
2. Make sure CI and, when relevant, staging are green.
3. Use the repo scripts instead of ad hoc release steps when possible:
   - `yarn release:cut --version vX.Y.Z --push`
   - `yarn release:tag --version vX.Y.Z --push`
4. Keep GitHub environment rules, workflow branch guards, and documented secrets aligned.
5. If you touch deployment workflows, check both the workflow logic and the related docs.
6. Update release notes or changelog guidance if the operational flow changed.

## Checkpoints

- If production deploy is being attempted from `main`, stop.
- If the plan tags before production success is confirmed, stop.
- If workflow changes drift from documented branch or environment rules, fix docs or workflow together.

## Validation

- Validate the smallest affected surface first:
  - inspect the changed workflow
  - run the relevant release script help or dry-run-like invocation when available
  - verify documentation still matches workflow behavior

## Key References

- `docs/deployment/CI_CD_AND_RELEASE_PROCESS.md`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
- `.github/workflows/release-pr.yml`
- `package.json`
- `tools/scripts/release.mjs`
