# Dependency and Supply Chain Security Plan

Last updated: 2026-04-13

## Purpose

This document records the dependency, package-manager, and CI hardening posture for the MyOrganizer repository. It exists to support dependency review, incident response, and future security maintenance.

## Current Repository Policy

- Modern Yarn 4 is the authoritative package manager for this repository.
- `yarn.lock` is the only lockfile accepted in CI and pull requests.
- Direct dependencies and devDependencies are pinned to exact reviewed versions.
- Root `.yarnrc.yml` pins exact-version defaults, hardened mode, the npm registry, and a 14-day dependency age gate with `npmMinimalAgeGate`.
- Root `.npmrc` and `pnpm-workspace.yaml` exist as hardened secondary-manager defaults for developers who intentionally bypass Yarn.
- Axios guardrails remain in `package.json` through Yarn `resolutions`, npm `overrides`, and pnpm `overrides`, keeping the compromised releases `axios@1.14.1` and `axios@0.30.4` from being selected.
- CI uses `yarn install --immutable --mode=skip-build` for metadata-only review before regular build and test jobs.
- CI verifies that `yarn.lock` remains unchanged after every `yarn install --immutable` run.
- Pull requests are blocked if they introduce or modify `package-lock.json` or `pnpm-lock.yaml`.
- Dependabot keeps its npm ecosystem cooldown aligned to the same 14-day release-aging policy.
- Dependency manifests, lockfiles, package-manager policy files, workflows, and security documents are protected with `CODEOWNERS` review.

## Axios 2026 Lessons That Apply Here

The npm compromise involving `axios` in March and April 2026 reinforces a broader rule for this repository: package popularity does not reduce supply-chain risk. Controls must assume that a trusted package or workflow dependency can become hostile for a short window.

Required takeaways:

- Lockfile discipline matters because it prevents silent resolver drift.
- Dependency updates need review, not blind automation.
- Install-time scripts must be treated as executable code, not metadata.
- CI secrets and deploy credentials must be minimized and rotated when compromise is suspected.
- Workflow actions themselves are part of the supply chain and must be pinned.

## Required Measures

### 1. Immediate repository controls

1. Keep `yarn.lock` committed at all times.
2. Keep direct dependencies and devDependencies pinned to exact reviewed versions.
3. Keep `.yarnrc.yml`, `.npmrc`, and `pnpm-workspace.yaml` aligned with exact-version defaults, registry pinning, 14-day release aging, and secondary-manager guardrails.
4. Review every lockfile diff for newly introduced packages and install-time script entries.
5. Preserve the Axios Yarn and secondary-manager override guardrails unless there is a documented reason to replace them.

### 2. CI and workflow hardening

1. Keep all referenced GitHub Actions pinned to full commit SHAs.
2. Keep explicit least-privilege workflow permissions.
3. Keep the pull-request dependency review gate enabled for moderate-or-higher findings.
4. Keep the secure install review stage that runs `yarn install --immutable --mode=skip-build` before normal build jobs.
5. Keep frozen lockfile verification after every `yarn install --immutable` run in CI and deployment workflows.
6. Keep the pull-request lockfile policy check that rejects `package-lock.json` and `pnpm-lock.yaml` changes.
7. Prefer OIDC-based authentication instead of long-lived cloud or registry secrets when future automation requires external access.

### 3. Package manager policy

1. Use `corepack yarn install --immutable` in CI, automation, and documented setup steps.
2. Avoid `yarn upgrade`, `yarn upgrade --latest`, and ad-hoc lockfile rewrites inside CI.
3. npm and pnpm are secondary local workflows only. Their checked-in configs are guardrails, not a signal to replace Yarn.
4. Do not add or rely on `package-lock.json` or `pnpm-lock.yaml` unless the repository is formally migrated.
5. For metadata-only dependency review, prefer `yarn install --immutable --mode=skip-build` in disposable environments or dedicated security jobs.
6. Do not enable a blanket `ignore-scripts=true` setting for normal installs while the current toolchain still relies on reviewed install-time scripts.
7. GitHub Dependabot still uses the `npm` ecosystem configuration for this JavaScript repository, even though Yarn is the authoritative local and CI package manager.

### 4. Approval checklist for new dependencies

Every new direct dependency should answer all of the following before merge:

1. Why is a new package necessary instead of existing code, browser APIs, or an already approved dependency?
2. What exact version is being introduced?
3. Does it add install-time scripts, native binaries, or external network behavior?
4. Does it significantly expand the transitive dependency graph?
5. Does it have open advisories, suspicious publish patterns, or a weak maintainer posture?
6. Is there a simpler or better maintained alternative?

### 5. Incident response playbook for dependency compromise

1. Detect: identify the compromised package, affected versions, affected repositories, and affected build agents.
2. Contain: block the versions, stop builds that resolve them, and freeze related dependency updates.
3. Eradicate: remove the package, clear caches, and rotate any reachable secrets.
4. Recover: rebuild from a known-good lockfile, rerun audit checks, and compare the new dependency tree to the prior one.
5. Review: document timeline, blast radius, and permanent control changes in `docs/SECURITY`.

## Commands To Use During Reviews

Use these commands during dependency review work:

```sh
yarn npm audit --json
yarn npm audit --severity high
yarn outdated
rg 'axios@' yarn.lock
```

If dependencies are installed locally or in CI, also run:

```sh
rg '"(preinstall|install|postinstall)"' node_modules/**/package.json
```

## Planned Follow-up Work

- Re-check install-time script packages whenever the lockfile changes materially.
- Review Dependabot PR cadence after a few update cycles and tune grouping or limits if it creates too much churn.
- Prefer OIDC-based authentication if future workflows need cloud or package-registry access.
- Keep Yarn and pnpm configs aligned whenever dependency-management settings change.
