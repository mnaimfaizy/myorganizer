# MyOrganizer Agent Guide

## Scope

This is an Nx monorepo for a full-stack organizer app: Next.js frontend, Express/Prisma backend, shared TypeScript libraries, and Playwright e2e tests. Nested AGENTS.md files add local rules for apps and libraries.

## Setup

- Use Node and Corepack-managed Yarn.
- Install with `corepack yarn install --immutable`.
- Start local services with `docker-compose up -d`.
- Start apps with `yarn start:backend` and `yarn start:myorganizer`.

## Commands

- Build: `yarn build:backend`, `yarn build:myorganizer`.
- Test one Jest project: `yarn nx test <project-name>`.
- E2E: `yarn nx e2e myorganizer-e2e`.
- Lint: `yarn nx lint <project-name>` or `yarn lint`.
- Format: `yarn format:write`.
- AI commit workflow: `corepack yarn ai:commit --message-file <path>` (or pipe the message on stdin).
- AI PR workflow: `corepack yarn ai:create-pr [--reviewer <login>]`.
- API sync after backend contract changes: `yarn openapi:sync`; check drift with `yarn openapi:check`.
- Release (cut branch): `yarn release:cut --version vX.Y.Z --push --notes-file RELEASE_NOTES.md`.
- Release (tag after production deploy): `yarn release:tag --version vX.Y.Z --push`.
- Release dry-run (preview only): `yarn release:cut --version vX.Y.Z --dry-run`.
- Prisma (backend): prefer Nx targets `yarn nx run backend:migrate` and `yarn nx run backend:generate-types`.
- Prisma (manual): run from `apps/backend/src` and pass schema path, e.g. `npx prisma migrate dev --schema prisma/schema --name <migration_name>` and `npx prisma generate --schema prisma/schema`.
- Sub-agent sync check: `yarn agents:sync:check`.
- Sub-agent sync apply: `yarn agents:sync`.

## Architecture

- Keep `apps/myorganizer/src/app/**` as thin Next.js route wrappers.
- Put page logic in `libs/web/pages/<route>` and shared code in `libs/**`.
- Use path aliases from `tsconfig.base.json`.
- Vault-backed features are end-to-end encrypted; the server stores ciphertext only.
- Treat `libs/app-api-client` and API specs as generated/synced outputs.

## Design Tokens

- The design reference lives in `libs/design-tokens/DESIGN.md`; use it together with `libs/design-tokens/src/tokens.json` when changing colors, typography, spacing, radii, or shadows.
- `libs/design-tokens/src/tokens.json` is the single source of truth for design values; do not hard-code hex colors, font stacks, or magic spacing values in components when a token should exist.
- Regenerate token outputs with `yarn nx run design-tokens:build-tokens` after editing tokens.
- Never edit files under `libs/design-tokens/src/generated/` directly; they are regenerated from `tokens.json`.
- Prefer importing token constants from `@myorganizer/design-tokens` over introducing inline styling literals in application code.

## Do

- Follow existing TypeScript, Tailwind, Jest, and Nx patterns.
- Use React Hook Form + Zod for new forms.
- Use the generated API client when it covers the endpoint.
- Add or update focused tests for changed behavior.
- Keep docs concise and link to existing docs when possible.
- Use the `Commit` sub-agent only to draft Conventional Commit messages; execute commits through the shared AI workflow so Husky is allowed to finish.
- For commit requests, wait for `git commit` to return before continuing. If Husky fails, fix the reported issue and rerun the narrow validation before retrying the commit.
- For PR requests, gather commit history from the current branch, push upstream if needed, create or reuse the PR, assign the authenticated GitHub user, and leave reviewers empty unless the user explicitly names them.
- For issue creation requests, follow `.github/skills/github-issue-creation-workflow/SKILL.md` and delegate to `IssueCreator` so duplicate checks, required details, and label validation are handled consistently.
- For issue/PR triage requests, follow `.github/skills/triage/SKILL.md`. Use `.github/skills/triage/AGENT-BRIEF.md` when moving to `ready-for-agent`, and `.github/skills/triage/OUT-OF-SCOPE.md` when rejecting enhancements as `wontfix`.
- For Jest unit or integration test creation/update requests, follow `.github/skills/unit-test-delegation-workflow/SKILL.md` and delegate implementation to `TestScaffold` first. The brief must include a behavior matrix from the actual implementation plus explicit in-scope and out-of-scope scenarios. Main agent must review behavior correctness, side effects, failures, boundaries, security-sensitive paths, mock hygiene, duplicate output, and validation before finalizing. Use `docs/testing/README.md` as the project-aware tooling reference.
- For implementing agreed work from a spec, PRD, or tickets in the current session, use `.github/skills/implement/SKILL.md`. Use TDD at pre-agreed seams, respect mandatory delegation rules, and commit or open PRs only when the user explicitly asks.
- For reviewing branch or WIP changes against repo standards and the originating spec, use `.github/skills/code-review/SKILL.md`.
- For building features or fixing bugs test-first (red-green-refactor), use `.github/skills/tdd/SKILL.md`. Plan the behavior list with the user before writing any code, work in vertical tracer-bullet slices (one test → one implementation → repeat), and consult `.github/skills/codebase-design/SKILL.md` for deep-module vocabulary during the refactor step.
- For Playwright E2E creation/update requests, follow `.github/skills/playwright-e2e-workflow/SKILL.md`; use `E2EPlanner` for broad flows and delegate implementation to `TestScaffold` only with a precise flow matrix.
- For release requests, follow the `.github/skills/release-and-deploy-workflow/SKILL.md` skill. Delegate: pre-flight → `PreflightCheck` agent, version proposal → `VersionBump` agent, notes drafting → `ReleaseNotes` agent.
- For design and planning sessions, use `.github/skills/grill-with-docs/SKILL.md` to stress-test plans against the domain model, sharpen terminology, and document decisions. This skill helps create/update `CONTEXT.md` (domain glossary) and `docs/adr/` (architecture decisions).
- For actively building or updating the domain model (adding glossary terms, recording ADRs, resolving fuzzy language, cross-referencing terms with code), use `.github/skills/domain-modeling/SKILL.md`. This is the _active_ discipline that owns `CONTEXT.md` and `docs/adr/` writes — invoked by `improve-codebase-architecture` and `grill-with-docs` when the model needs to change.
- For architectural reviews — finding shallow modules, seam leaks, or testability gaps — use `.github/skills/improve-codebase-architecture/SKILL.md`. It loads `.github/skills/codebase-design/SKILL.md` (vocabulary + principles) and its companion files (`DEEPENING.md` for dependency classification, `DESIGN-IT-TWICE.md` for alternative interface exploration). It produces a visual HTML report with before/after diagrams for each candidate, then opens a grilling loop on whichever candidate you pick.
- For any sub-agent update (content, add/remove, model change), use `.github/skills/sub-agent-sync-workflow/SKILL.md` and run `yarn agents:sync` so `.claude/agents`, `.cursor/agents`, and `.gemini/agents` stay aligned with `.github/agents`.
- Keep `.github/agents` as the canonical body source; avoid manual copy/paste sync across harnesses when `tools/scripts/sync-subagents.mjs` is available.
- Keep `CodeExplorer` in `.cursor/agents/explore.md` on `model: composer`.
- For new planned feature work, use `.github/skills/to-prd/SKILL.md` to write and publish a PRD Issue. The user must be present — there is one interactive step (test seam approval). Do not use IssueCreator for PRD Issues; create them directly via `gh issue create`.
- To break a PRD Issue into Slice Issues, use `.github/skills/to-issues/SKILL.md`. The user must supply the PRD Issue number. Every slice body must start with `PRD: #<N>`. Flag `type:hitl` slices prominently — `dispatch-agents` skips them. After publishing, remind the user to run `yarn dispatch-agents --prd <N>`.
- Before issuing 3 or more consecutive read/search operations to locate something in the codebase, stop and delegate to `CodeExplorer` (`.github/agents/explore.agent.md`) instead. Provide an Explore Request with a `Goal` sentence; optionally include `Known Locations`, `Search Hints`, `Out of Scope`, and `Expected Output`. CodeExplorer returns a structured Explore Summary with `[found]`/`[inferred]` tagged findings and ranked file paths.

## ⚠️ Mandatory Delegation Rules (NO EXCEPTIONS)

**ALWAYS delegate tasks for these file types.** Do NOT skip delegation even if the change seems small or obvious.

| File Pattern                    | Skill                                                   | Agent Flow                           | Rule                   |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------ | ---------------------- |
| `*.spec.ts` (Playwright E2E)    | `.github/skills/playwright-e2e-workflow/SKILL.md`       | E2EPlanner → TestScaffold            | ✅ **Always delegate** |
| `*.test.ts` (Jest tests)        | `.github/skills/unit-test-delegation-workflow/SKILL.md` | TestScaffold                         | ✅ **Always delegate** |
| `*.stories.tsx` (Storybook)     | `.github/skills/storybook-delegation-workflow/SKILL.md` | StorybookCurator                     | ✅ **Always delegate** |
| Components in `libs/web-ui/`    | Component workflow                                      | ComponentBuilder → ComponentReviewer | ✅ **Always delegate** |
| Components in `libs/web/pages/` | Component workflow                                      | ComponentBuilder → ComponentReviewer | ✅ **Always delegate** |

### Key Anti-Pattern to Avoid

❌ **DO NOT do this:**

```
"I see a bug in an E2E test. Let me read the similar test, find the pattern, and fix it directly."
```

✅ **DO THIS INSTEAD:**

```
"I see a bug in an E2E test. This is an E2E test UPDATE.
1. Read .github/skills/playwright-e2e-workflow/SKILL.md
2. Use E2EPlanner to outline the fix
3. Delegate to TestScaffold with a precise brief
4. Apply changes from TestScaffold output"
```

### Before You Edit Any File

Use the decision tree in [`.claude/checklist.md`](.claude/checklist.md) to verify you're not skipping delegation.

## Do Not

- Do not introduce `package-lock.json` or `pnpm-lock.yaml` changes.
- Do not put app-local shared helpers under `apps/myorganizer/src/lib/**`.
- Do not store vault plaintext on the server or add plaintext todo APIs.
- Do not hand-edit generated API client code.
- Do not commit secrets or production credentials.
- Do not cancel, background, or abandon a running `git commit` while Husky checks are still executing.
- Do not open pull requests from `main` or another base branch directly.
- Do not leave harness-only agent additions/removals unsynchronized. If one agent is added/removed in canonical, propagate to all harnesses via `yarn agents:sync`.
