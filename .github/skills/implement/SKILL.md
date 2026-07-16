---
name: implement
description: Implement a piece of work based on a spec, PRD, or set of tickets. Use when the user wants hands-on delivery of an agreed plan in the current session.
disable-model-invocation: true
---

# Implement

Adapted from [mattpocock/skills — implement](https://github.com/mattpocock/skills/tree/main/skills/engineering/implement) for MyOrganizer workflows.

Implement the work described by the user in the spec, PRD, slice issue, or ticket set.

## Before you start

1. Confirm the spec source (issue body, PRD, slice ticket, or user-provided path).
2. Read nearby `AGENTS.md` files for touched apps/libraries.
3. Check `.claude/checklist.md` before editing — route file types through mandatory delegation (Jest tests, E2E specs, Storybook, React components).

## Implementation

Use **`/tdd`** (`.github/skills/tdd/SKILL.md`) where possible, at pre-agreed test seams.

When TDD is not appropriate, still work in small vertical slices and keep changes scoped to the spec.

Pick domain workflow skills when they apply:

- Frontend pages → `frontend-page-library-workflow`
- Backend APIs → `backend-api-contract-change`
- Vault-backed data → `vault-feature-workflow`
- Auth/session → `auth-session-workflow`
- Prisma/schema → `prisma-migration-workflow`
- YouTube integration → `youtube-integration-workflow`

Respect MyOrganizer structure: thin Next.js route wrappers in `apps/myorganizer`, page logic in `libs/web/pages/**`, shared code in `libs/**`.

## Validation loop

Run checks regularly while implementing:

- Typecheck/lint affected projects: `yarn nx lint <project>` (and project tests as you go).
- Run single test files or focused Nx test targets while iterating.
- Run the full relevant test suite once at the end: `yarn nx test <project>` (or the broader set the change touches).

After backend contract changes, run `yarn openapi:sync` and confirm with `yarn openapi:check`.

## Review before finishing

Use **`/code-review`** (`.github/skills/code-review/SKILL.md`) to review the diff against the originating spec or tickets and repo standards.

If the user did not supply a fixed point, compare against `main` (or the branch merge-base they specify).

## Commit and PR

Do **not** commit unless the user explicitly asks.

When the user requests a commit, use **`/commit`** (`.github/skills/commit-change-workflow/SKILL.md`).

When the user requests a PR, use **`/create-pr`** (`.github/skills/create-pull-request-workflow/SKILL.md`).
