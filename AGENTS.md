# MyOrganizer Agent Guide

## Scope

This is an Nx monorepo for a full-stack organizer app: Next.js frontend, Express/Prisma backend, shared TypeScript libraries, and Playwright e2e tests. Nested AGENTS.md files add local rules for apps and libraries.

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

## Next.js (this pin)

Current `next` version lives in `TECH_STACK.md`. The bundled docs above match the installed package. Do not claim that Next.js auto-updates the marked block — at this pin the pointer is manual.

- This app has no `proxy.ts` or Next.js `middleware.ts`. Do not add one unless the ticket **explicitly** asks for Next.js request interception. See [ADR 0019](docs/adr/0019-nextjs-proxy-is-not-a-session-layer.md).
- If interception is required, the only live convention is `proxy.ts` (Node.js runtime only). Do not create `middleware.ts`, including the deprecated Edge hatch.
- Prefer `next.config` `redirects` / `rewrites` for static routing. Proxy is a last resort.
- Always `await` `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams`.
- Do not suggest `next lint`. Lint with Nx/ESLint (`yarn nx lint <project>` or `yarn lint`).
- Express middleware in `apps/backend/src/middleware/` is unrelated. Do not rename it to proxy.

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
- AI commit: `corepack yarn ai:commit --message-file <path>`.
- AI PR: draft with the `PrAuthor` sub-agent, then `corepack yarn ai:create-pr --title <text> --body-file <path> --merge-base <sha> [--label <name>] [--reviewer <login>]`. `--merge-base` is the draft's `MERGE-BASE:` SHA; the runner recomputes it and rejects drafts that cannot produce it. Add `--force-with-lease` when the branch was rebased and the remote is no longer a fast-forward; the runner pins the lease itself and still refuses if the remote holds work your branch does not.
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
- Skill atlas check: `yarn skills:map:check` (asserts `docs/agents/skill-atlas.html` against `.agents/skills`, `.github/agents`, and `AGENTS.md`).
- Agent orchestration map check: `yarn agents:map:check` (asserts `docs/agents/orchestration-map.html` and `docs/agents/agent-journey.html` against `tools/config/agent-model-policy.json`).
- Vault diagram pages check: `yarn vault:pages:check` (asserts `docs/vault/*.html` against the vault source constants).
- Auth diagram pages check: `yarn auth:pages:check` (asserts `docs/authentication/session-lifecycle.html` against the auth source constants).
- Release pipeline page check: `yarn deploy:pages:check` (asserts `docs/deployment/release-pipeline.html` against `.github/workflows/*.yml`, `package.json`, and `tools/scripts/release.mjs`; `--print` shows what each extractor resolved).
- Libs markdown allowlist: `yarn libs:markdown:check` (Husky + CI; do not skip).
- Assertion gates aggregate: `yarn gates:run` (runs the file-reading checkers above plus OpenAPI artifacts, ADR numbering, and the wired-gate check in one Node process; Husky calls this single line instead of one `corepack yarn` line per checker — see ADR 0043).
- Wired-gate check: `yarn gates:coverage:check` (the Meta-Gate — asserts every `tools/scripts/check-*.mjs` is invoked by a hook or workflow, resolving one level of indirection through the aggregate's manifest). A checker that is deliberately not a gate needs an entry with a written reason in `tools/config/gate-coverage-optout.json` — there is no silent exemption.
- House Explainer Page hygiene: `yarn design:hygiene <path>` (or `--all`, `--staged`). `yarn design:hygiene --print-font-block` emits the canonical `@font-face` block to splice into a new page ([ADR 0046](docs/adr/0046-house-explainer-pages-have-a-designer-and-a-gate.md)).

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
- `DESIGN.md` is brand rationale, not a second palette. Update it when a semantic role or brand rule changes, not when a hex or spacing step moves. See ADR 0023.
- Regenerate token outputs with `yarn nx run design-tokens:build-tokens` after editing tokens.
- Never edit files under `libs/design-tokens/src/generated/` directly; they are regenerated from `tokens.json`.
- Prefer importing token constants from `@myorganizer/design-tokens` over introducing inline styling literals in application code.

## Do

- Follow existing TypeScript, Tailwind, Jest, and Nx patterns.
- Use React Hook Form + Zod for new forms.
- Use the generated API client when it covers the endpoint.
- Add or update focused tests for changed behavior.
- Keep docs concise and link to existing docs when possible.
- Notes have homes, and there is no catch-all directory ([ADR 0041](docs/adr/0041-internal-notes-have-homes.md)). Planning and history belong in GitHub issues. Durable decisions belong in `docs/adr/`. User- and dev-facing feature behaviour belongs in `docs/features/`. Cited investigation belongs in `docs/research/`, date-prefixed (`YYYY-MM-DD-slug.md`) and frozen at that date — if it must stay current it is not research. Short-lived working files belong in `tmp/` (gitignored) and are never committed. `yarn docs:notes:check` enforces the directory names and the date prefix; Husky and CI run it.
- Standards live in the documents indexed by [`CODING_STANDARDS.md`](CODING_STANDARDS.md). Add a rule to its source document and link, rather than restating it in the index.
- `CONTEXT.md` is the domain glossary — read it before changing domain language, and do not redefine a term it already carries; sharpen or extend instead. A new term touching encrypted data must say whether it means plaintext (client-only) or ciphertext (server-storable).
- ADRs in `docs/adr/` are numbered sequentially from `0001`. Scan for the highest existing number before adding one, then name the file `NNNN-lowercase-hyphen-slug.md`. A number is a claim until it merges and a fact afterwards ([ADR 0042](docs/adr/0042-adr-numbers-are-claims-until-merged.md)): if another pull request merges your number first, renumber yours; never renumber a merged ADR — supersede it. Gaps are legal. `yarn adr:numbering:check` asserts unique numbers and filename shape; Husky and CI run it.
- Classify `gate:*` first ([ADR 0012](docs/adr/0012-tiered-quality-gates.md)). When unsure → promote.
- Before issuing 3 or more consecutive read/search operations to locate something in the codebase, stop and delegate to `CodeExplorer` (`.github/agents/explore.agent.md`). Provide an Explore Request with a `Goal` sentence; optionally include `Known Locations`, `Search Hints`, `Out of Scope`, and `Expected Output`. CodeExplorer returns a structured Explore Summary with `[found]`/`[inferred]` tagged findings and ranked file paths.
- Keep `.github/agents` as the canonical Sub-agent body source. Keep `CodeExplorer` in `.cursor/agents/explore.md` on `model: composer-2.5`.
- For PR requests, draft the title and body with the `PrAuthor` sub-agent, then execute `corepack yarn ai:create-pr --title <text> --body-file <path> --merge-base <sha>`. Do not fall back to a title-only PR if `PrAuthor` fails, and do not compute the merge base yourself to satisfy the gate.

## Workflows

Named workflows live in `.agents/skills/`. Load the Skill; do not copy its steps here. The lines below are **choosers** (which Skill to load), not procedures.

- When committing: `.agents/skills/commit-change-workflow/SKILL.md`
- When opening a PR: `.agents/skills/create-pull-request-workflow/SKILL.md`
- Ad-hoc GitHub issue (bug, task, or follow-up that is **not** a PRD): `.agents/skills/github-issue-creation-workflow/SKILL.md`
- Planned feature, spec, or grill outcome published as a **PRD Issue**: `.agents/skills/to-prd/SKILL.md` — do not use IssueCreator
- Break a PRD Issue into slices: `.agents/skills/to-issues/SKILL.md`
- Existing issue or external PR (state machine, not create): `.agents/skills/triage/SKILL.md`
- Jest tests: `.agents/skills/unit-test-delegation-workflow/SKILL.md`
- Playwright E2E: `.agents/skills/playwright-e2e-workflow/SKILL.md`
- Storybook: `.agents/skills/storybook-delegation-workflow/SKILL.md`
- UI components: `.agents/skills/component-builder/SKILL.md`
- API contracts: `.agents/skills/backend-api-contract-change/SKILL.md`
- Implement agreed work: `.agents/skills/implement/SKILL.md`
- Code review: `.agents/skills/code-review/SKILL.md`
- QA plan for finished work before its PR merges (PRD Issue, or a single issue): `.agents/skills/qa-plan/SKILL.md`
- TDD: `.agents/skills/tdd/SKILL.md`
- Release: `.agents/skills/release-and-deploy-workflow/SKILL.md`
- Design / grilling session: `.agents/skills/grill-with-docs/SKILL.md` — filing that plan as tracked work is `to-prd`, not IssueCreator
- Brief a diagram or explainer page: `.agents/skills/design-brief/SKILL.md` — the brief goes to `Designer`, never to a general-purpose agent
- Upstream instruction audit: `.agents/skills/upstream-brief/SKILL.md`
- Domain model writes: `.agents/skills/domain-modeling/SKILL.md`
- Architecture review: `.agents/skills/improve-codebase-architecture/SKILL.md`
- Sub-agent add/remove/edit: `.agents/skills/sub-agent-sync-workflow/SKILL.md`

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

Kind and area **Surface Labels** live in `tools/config/github-labels.json` ([ADR 0025](docs/adr/0025-pr-surface-labels.md)). Branch type uses **kind only**, first match in the table above. Area labels (`backend`, `web-app`, …) do not change the prefix. Pull Requests receive Surface Labels only — never Issue Orchestration Labels.

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

| File Pattern                                      | Skill                                                   |
| ------------------------------------------------- | ------------------------------------------------------- |
| `*.spec.ts` (Playwright E2E)                      | `.agents/skills/playwright-e2e-workflow/SKILL.md`       |
| `*.test.ts` (Jest)                                | `.agents/skills/unit-test-delegation-workflow/SKILL.md` |
| `*.stories.tsx`                                   | `.agents/skills/storybook-delegation-workflow/SKILL.md` |
| Components in `libs/web-ui/` / `libs/web/pages/`  | `.agents/skills/component-builder/SKILL.md`             |
| API Contract (controllers, DTOs, Prisma for HTTP) | `.agents/skills/backend-api-contract-change/SKILL.md`   |
| House Explainer Page (`docs/**/*.html`)           | `.agents/skills/design-brief/SKILL.md` → `Designer`     |

### Key Anti-Patterns

❌ Skip specialists on behavioral (`standard`/`full`) test or component work.
❌ Run the full test pipeline for a pure mechanical fixture retarget.
❌ Main agent writes controllers or Prisma schema on `standard`/`full` instead of PrismaWriter / ApiWriter.

### Before You Edit Any File

Use [`.claude/checklist.md`](.claude/checklist.md) Step 0 → file-type matrix.

## Do Not

- Do not introduce `package-lock.json` or `pnpm-lock.yaml` changes.
- Do not put app-local shared helpers under `apps/myorganizer/src/lib/**`.
- Do not store vault plaintext on the server or add plaintext task APIs.
- Do not hand-edit generated API client code.
- Do not commit secrets or production credentials, and do not paste them into chat, logs, or issue
  bodies. This covers vault plaintext, JWT and session cookies, SMTP credentials, and environment
  file values. Redact instead — `Authorization: <REDACTED>` and similar. If redacted output is not
  enough to diagnose a problem, say so and ask rather than pasting the real value.
- Do not run `git commit` directly or `git add .`; use `corepack yarn ai:commit --message-file <path>`.
- Do not cancel, background, or abandon a running `yarn ai:commit` while Husky checks are still executing.
- Do not run `gh pr create` directly; draft with the `PrAuthor` sub-agent, then `corepack yarn ai:create-pr --title <text> --body-file <path> --merge-base <sha>`.
- Do not open pull requests from `main` or another base branch directly.
- Do not leave harness-only agent additions/removals unsynchronized. If one agent is added/removed in canonical, propagate to all harnesses via `yarn agents:sync`.
