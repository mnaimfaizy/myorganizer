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
- AI commit workflow: `corepack yarn ai:commit --message-file <path>`.
- AI PR workflow: draft with the `PrAuthor` sub-agent, then `corepack yarn ai:create-pr --title <text> --body-file <path> [--reviewer <login>]`.
- API sync after backend contract changes: `yarn openapi:sync`; check drift with `yarn openapi:check`.
- Release (cut branch): `yarn release:cut --version vX.Y.Z --push --notes-file RELEASE_NOTES.md`.
- Release (tag after production deploy): `yarn release:tag --version vX.Y.Z --push`.
- Release dry-run (preview only): `yarn release:cut --version vX.Y.Z --dry-run`.
- Prisma (backend): prefer Nx targets `yarn nx run backend:migrate` and `yarn nx run backend:generate-types`.
- Prisma (manual): run from `apps/backend/src` and pass schema path, e.g. `npx prisma migrate dev --schema prisma/schema --name <migration_name>` and `npx prisma generate --schema prisma/schema`.
- Sub-agent sync check: `yarn agents:sync:check`.
- Sub-agent sync apply: `yarn agents:sync`.
- Sub-agent model/catalog audit: `yarn agents:models:audit`.
- Sandcastle loop usage summary: `yarn agents:usage:report`.
- Root README check: `yarn readme:check`.

## Architecture

- Keep `apps/myorganizer/src/app/**` as thin Next.js route wrappers.
- Put page logic in `libs/web/pages/<route>` and shared code in `libs/**`.
- After adding or removing an app, a top-level lib, or a `/dashboard/*` route, update `README.md` and run `yarn readme:check`. The README is the only place claiming a repository layout and a route list, and it drifted for months because no rule made it anyone's job. Keep it a front door: versions live in `TECH_STACK.md`, scripts in `package.json`, env vars in `.env.example` — link to them rather than restating them.
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
- Use the `Commit` sub-agent only to draft Conventional Commit messages from the staged diff; execute commits with `corepack yarn ai:commit --message-file <path>` so Husky is allowed to finish. Never `git add .` or run `git commit` directly.
- For commit requests, wait for `yarn ai:commit` to return before continuing. If it fails, read the `ai:commit: failed` trailer, fix the hinted slice, and retry.
- For PR requests, draft the title and body with the `PrAuthor` sub-agent from the branch diff and linked GitHub issues, then execute `corepack yarn ai:create-pr --title <text> --body-file <path>`. Push upstream if needed, assign the authenticated GitHub user, and leave reviewers empty unless the user explicitly names them. Do not fall back to a title-only PR if `PrAuthor` fails.
- For issue creation requests, follow `.github/skills/github-issue-creation-workflow/SKILL.md` and delegate to `IssueCreator` so duplicate checks, required details, and label validation are handled consistently.
- For issue/PR triage requests, follow `.github/skills/triage/SKILL.md`. Use `.github/skills/triage/AGENT-BRIEF.md` when moving to `ready-for-agent`, and `.github/skills/triage/OUT-OF-SCOPE.md` when rejecting enhancements as `wontfix`.
- For Jest unit or integration test creation/update requests, follow `.github/skills/unit-test-delegation-workflow/SKILL.md` and delegate implementation to `TestScaffold` first. The brief must include a behavior matrix from the actual implementation plus explicit in-scope and out-of-scope scenarios. Main agent must review behavior correctness, side effects, failures, boundaries, security-sensitive paths, mock hygiene, duplicate output, and validation before finalizing. Use `docs/testing/projects/<project>.md` as the project-aware tooling reference; `docs/testing/README.md` is the index plus cross-project rules. Max 2 reject-cycles (ADR 0017). Hitting the cap, a repeated FAIL, or a Reviewer PASS then Runner/`tsc`/`eslint` FAIL is a Pipeline Incident — comment `## Pipeline Incident` on the Slice Issue. `/code-review` runs once per Slice after deterministic checks are green, not after every specialist hop.
- For implementing agreed work from a spec, PRD, or tickets in the current session, use `.github/skills/implement/SKILL.md`. Classify `gate:*` first (ADR 0012); ad-hoc work needs no ticket. Use TDD at pre-agreed seams, respect tiered delegation rules, and commit or open PRs only when the user explicitly asks.
- For reviewing branch or WIP changes against repo standards and the originating spec, use `.github/skills/code-review/SKILL.md`.
- For building features or fixing bugs test-first (red-green-refactor), use `.github/skills/tdd/SKILL.md`. Plan the behavior list with the user before writing any code, work in vertical tracer-bullet slices (one test → one implementation → repeat), and consult `.github/skills/codebase-design/SKILL.md` for deep-module vocabulary during the refactor step.
- For Playwright E2E creation/update requests, follow `.github/skills/playwright-e2e-workflow/SKILL.md`; use `E2EPlanner` for broad flows and delegate implementation to `TestScaffold` only with a precise flow matrix.
- For release requests, follow the `.github/skills/release-and-deploy-workflow/SKILL.md` skill. Delegate: pre-flight → `PreflightCheck` agent, version proposal → `VersionBump` agent, notes drafting → `ReleaseNotes` agent.
- For design and planning sessions, use `.github/skills/grill-with-docs/SKILL.md` to stress-test plans against the domain model, sharpen terminology, and document decisions. This skill helps create/update `CONTEXT.md` (domain glossary) and `docs/adr/` (architecture decisions).
- For actively building or updating the domain model (adding glossary terms, recording ADRs, resolving fuzzy language, cross-referencing terms with code), use `.github/skills/domain-modeling/SKILL.md`. This is the _active_ discipline that owns `CONTEXT.md` and `docs/adr/` writes — invoked by `improve-codebase-architecture` and `grill-with-docs` when the model needs to change.
- For architectural reviews — finding shallow modules, seam leaks, or testability gaps — use `.github/skills/improve-codebase-architecture/SKILL.md`. It loads `.github/skills/codebase-design/SKILL.md` (vocabulary + principles) and its companion files (`DEEPENING.md` for dependency classification, `DESIGN-IT-TWICE.md` for alternative interface exploration). It produces a visual HTML report with before/after diagrams for each candidate, then opens a grilling loop on whichever candidate you pick.
- For any sub-agent update (content, add/remove, model change), use `.github/skills/sub-agent-sync-workflow/SKILL.md` and run `yarn agents:sync` so `.claude/agents`, `.cursor/agents`, and `.gemini/agents` stay aligned with `.github/agents`.
- Keep `.github/agents` as the canonical body source; avoid manual copy/paste sync across harnesses when `tools/scripts/sync-subagents.mjs` is available.
- Keep `CodeExplorer` in `.cursor/agents/explore.md` on `model: composer-2.5`.
- For new planned feature work, use `.github/skills/to-prd/SKILL.md` to write and publish a PRD Issue. The user must be present — there is one interactive step (test seam approval). Do not use IssueCreator for PRD Issues; create them directly via `gh issue create`.
- To break a PRD Issue into Slice Issues, use `.github/skills/to-issues/SKILL.md`. The user must supply the PRD Issue number. Every slice body must start with `PRD: #<N>`. Flag `type:hitl` slices prominently — `dispatch-agents` skips them. After publishing, remind the user to run `yarn dispatch-agents --prd <N>`.
- Before issuing 3 or more consecutive read/search operations to locate something in the codebase, stop and delegate to `CodeExplorer` (`.github/agents/explore.agent.md`) instead. Provide an Explore Request with a `Goal` sentence; optionally include `Known Locations`, `Search Hints`, `Out of Scope`, and `Expected Output`. CodeExplorer returns a structured Explore Summary with `[found]`/`[inferred]` tagged findings and ranked file paths.

## Branch naming

Format: `<type>/<issue-number>-<short-slug>`. The issue number comes **first**, right after the
type. Omit the number only when there is no issue.

```
fix/292-graphify-extraction-gaps
feat/304-sandcastle-repo-wide-sweep
docs/287-component-agent-guardrails
chore/280-agent-model-governance
```

Pick the type from what the work _does_, not from the file it touches. When an issue carries
labels, map them — **first match wins, top to bottom**, because issues routinely carry several:

| Issue label                              | Type     |
| ---------------------------------------- | -------- |
| `bug`, `security`                        | `fix/`   |
| `enhancement`                            | `feat/`  |
| `documentation`                          | `docs/`  |
| `tooling`, `maintenance`, `dependencies` | `chore/` |
| `research`                               | `docs/`  |
| `qa`                                     | `chore/` |
| CI/workflow changes only                 | `ci/`    |
| _no label matches_                       | `chore/` |

`qa` and `research` rank last on purpose: they say why work is tracked, not what it changes. An
issue labelled `tooling` + `maintenance` + `qa` is a chore, not documentation.

Slugs are lowercase, hyphen-separated, and short (~40 chars) — enough to recognise the branch in
`git branch`, not a restatement of the title.

Reserved prefixes, which do **not** follow the table:

- `release/v<semver>` — release branches (see `docs/deployment/CI_CD_AND_RELEASE_PROCESS.md`).
- `slice/<issue>-<slug>` — sandcastle PRD slices. The prefix is load-bearing: it means the branch
  fast-forwards into a `feat/<prd-slug>` integration branch and its issue closes on success. Never
  create one by hand.
- `claude/…`, `copilot/…` — generated by agent tooling. Leave them alone; don't rename to match.

## ⚠️ Tiered Quality Gates (ADR 0012)

Do not treat every test/component touch as a full multi-agent pipeline. Classify a **gate tier** first (checklist Step 0 or slice `gate:*` label). When unsure → promote. Applies to interactive and AFK sessions.

| Tier              | Execution                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `gate:mechanical` | Main agent may edit (fixture/type retarget, rename, dead delete, selector-only E2E) + focused checks |
| `gate:standard`   | Matching specialist hop for the artifact                                                             |
| `gate:full`       | Full mandatory pipelines                                                                             |

| File Pattern                                     | Skill                                                   | `standard` / `full` flow                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `*.spec.ts` (Playwright E2E)                     | `.github/skills/playwright-e2e-workflow/SKILL.md`       | E2EPlanner → TestScaffold → TestReviewer (structural). Skip planner only for selector-only + unchanged matrix |
| `*.test.ts` (Jest)                               | `.github/skills/unit-test-delegation-workflow/SKILL.md` | TestScaffold → TestReviewer → TestRunner (max 2 reject-cycles; ADR 0017)                                      |
| `*.stories.tsx`                                  | `.github/skills/storybook-delegation-workflow/SKILL.md` | StorybookCurator                                                                                              |
| Components in `libs/web-ui/` / `libs/web/pages/` | Component workflow                                      | ComponentBuilder → ComponentReviewer (max 2 FAIL cycles; ADR 0017)                                            |

### Key Anti-Patterns

❌ Skip specialists on behavioral (`standard`/`full`) test or component work.  
❌ Run the full test pipeline for a pure mechanical fixture retarget.

### Before You Edit Any File

Use [`.claude/checklist.md`](.claude/checklist.md) Step 0 → file-type matrix.

## Do Not

- Do not introduce `package-lock.json` or `pnpm-lock.yaml` changes.
- Do not put app-local shared helpers under `apps/myorganizer/src/lib/**`.
- Do not store vault plaintext on the server or add plaintext todo APIs.
- Do not hand-edit generated API client code.
- Do not commit secrets or production credentials.
- Do not run `git commit` directly or `git add .`; use `corepack yarn ai:commit --message-file <path>`.
- Do not cancel, background, or abandon a running `yarn ai:commit` while Husky checks are still executing.
- Do not run `gh pr create` directly; draft with the `PrAuthor` sub-agent, then `corepack yarn ai:create-pr --title <text> --body-file <path>`.
- Do not open pull requests from `main` or another base branch directly.
- Do not leave harness-only agent additions/removals unsynchronized. If one agent is added/removed in canonical, propagate to all harnesses via `yarn agents:sync`.
