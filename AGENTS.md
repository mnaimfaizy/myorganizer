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

## React Native

React Native ships no bundled documentation, so the Next.js "read the bundled docs" instrument above does not transfer — verify an export against the installed package rather than from memory.

- Import only from the `react-native` package root, never a `react-native/...` subpath. Deep imports are deprecated at 0.80 with removal planned; `yarn mobile-platform:check` enforces this over `apps/mobile` and `libs/mobile`.
- Native mobile code reaches a shared library through its Portable Entry Point (`@myorganizer/auth/portable`, `@myorganizer/vault-core/portable`), never its main entry point — the main barrels reach browser-only code, and `typeof window` guards do not protect native because React Native sets `global.window = global`. See [ADR 0103](docs/adr/0103-mobile-native-code-is-typechecked-without-dom-and-reaches-shared-libraries-through-a-portable-entry-point.md).
- No non-spec mobile program has Node types, so `process`, `Buffer`, and a global `crypto` do not compile in mobile code. Import a missing name from a package that provides it; only for a global Hermes itself provides, declare it in `libs/mobile/native-globals.d.ts` (created with its first entry). Never restore `types: ["node"]` or add `dom` to make a name resolve. See [ADR 0120](docs/adr/0120-a-mobile-program-gets-node-types-only-if-it-runs-on-node.md).
- `targetSdk 36` means Android enforces edge-to-edge for this app with no opt-out; every screen root must come from `react-native-safe-area-context`, not a manual status-bar inset.
- Reach the mobile theme through `useTheme()` inside a `ThemeProvider`, never as a module-level constant: a theme captured at import time is one colour mode forever. Colours come from the Semantic Roles the theme exposes, and text size from a Type Scale step used whole.
- Style mobile components with `StyleSheet.create` over the token theme, and never with a browser API. A component's styles live in a `StyleSheet.create` block, not in an inline object standing in for one; merging that reference with a small inline override for a per-render value — `style={[styles.header, { marginBottom: theme.spacing.md }]}` — is the established pattern here and stays fine. See [ADR 0008](docs/adr/0008-mobile-styling-stylesheet-theme.md).

## Setup

- Use Node and Corepack-managed Yarn.
- Install with `corepack yarn install --immutable`.
- Start local services with `docker-compose up -d`.
- Start apps with `yarn start:backend` and `yarn start:myorganizer`.

## Cursor Cloud specific instructions

The Cloud Agent VM has **no Docker**, so `docker-compose up -d` does not work there. The
repository-managed environment in `.cursor/` handles this instead of Docker:

- `.cursor/environment.json` defines the `install`/`start` scripts and two dev-server terminals
  (`backend` on `:3000`, `frontend` on `:4200`).
- `.cursor/install.sh` (idempotent bootstrap) installs PostgreSQL and MailHog natively when
  missing, runs `corepack yarn install --immutable`, creates `.env` from `.env.example` with
  generated JWT secrets, and generates the Prisma client.
- `.cursor/start.sh` (per-boot) starts PostgreSQL on port **5453** (matching `.env` and
  `docker-compose.yml`), ensures the role/database exist, starts MailHog (**SMTP 1025 / UI 8025**),
  applies Prisma migrations, and seeds the QA Accounts.

Testing on a Cloud Agent:

- Prefer these native services over `docker-compose`. If a service is down, re-run
  `bash .cursor/start.sh` (safe and idempotent); it does not reinstall dependencies.
- The frontend serves on `:4200` because `apps/myorganizer/project.json` pins it on the Nx `dev`
  target; otherwise Nx injects `.env`'s `PORT=3000` into the task and it collides with the backend.
- Verify email flows via the MailHog UI/API at `http://localhost:8025` (the app sends to
  `localhost:1025`). Login and refresh require a verified email, so register → read the
  verification email from MailHog → verify → login.
- To sign in without that round-trip, use a QA Account: `yarn qa:accounts` prints the values.
- `next dev` rewrites `apps/myorganizer/AGENTS.md` (its `nextjs-agent-rules` block); do not commit
  that incidental change unless it is the point of your work.

## Commands

- Build: `yarn build:backend`, `yarn build:myorganizer`.
- Test one Jest project: `yarn nx test <project-name>`.
- E2E: `yarn nx e2e myorganizer-e2e`.
- Lint: `yarn nx lint <project-name>` or `yarn lint`.
- Format: `yarn format:write` rewrites uncommitted files. `yarn format:check --all` reads the whole tree and fails when Prettier would change a file. Without `--all`, Nx checks only the files changed since `main`.
- A `git commit` runs `.husky/pre-commit` only when Husky is installed. `postinstall` sets `core.hooksPath`. Without `node_modules` the hook does not run, the commit still succeeds, and that success is not evidence any checker ran. CI runs `yarn format:check --all` on the Lint job.
- AI commit: `corepack yarn ai:commit --message-file <path>`.
- AI PR: draft with the `PrAuthor` sub-agent, then `corepack yarn ai:create-pr --title <text> --body-file <path> --merge-base <sha> [--label <name>] [--reviewer <login>]`. Verifies the merge base and refuses a force-push over work your branch does not hold. See [the create-pull-request-workflow Skill](.agents/skills/create-pull-request-workflow/SKILL.md).
- API sync after backend contract changes: `yarn openapi:sync`; check drift with `yarn openapi:check`.
- Prisma (backend): prefer Nx targets `yarn nx run backend:migrate` and `yarn nx run backend:generate-types`.
- Prisma (manual): run from `apps/backend/src` and pass schema path, e.g. `npx prisma migrate dev --schema prisma/schema --name <migration_name>` and `npx prisma generate --schema prisma/schema`.
- Assertion gates aggregate: `yarn gates:run` (runs the file-reading checkers plus OpenAPI artifacts, ADR numbering, and the wired-gate check in one Node process). See [ADR 0043](docs/adr/0043-gates-assert-facts.md).
- Every other command — each `*:check` gate, `*:measure` report, and `*:test` suite, plus release, sub-agent sync, and QA Accounts — is documented once in [the command reference](docs/agents/command-reference.md). Open it when a task names a gate or needs a command not listed here, and add a new command there, not here.

## Architecture

- Keep `apps/myorganizer/src/app/**` as thin Next.js route wrappers.
- Put page logic in `libs/web/pages/<route>` and shared code in `libs/**`.
- After adding or removing an app, a top-level lib, or a `/dashboard/*` route, update `README.md` and run `yarn readme:check`. Keep the README a front door: versions live in `TECH_STACK.md`, scripts in `package.json`, env vars in `.env.example` — link to them rather than restating them.
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
- Notes have homes, and there is no catch-all directory ([ADR 0041](docs/adr/0041-internal-notes-have-homes.md)): planning and history in GitHub issues, durable decisions in `docs/adr/`, user- and dev-facing feature behaviour in `docs/features/`, cited investigation in `docs/research/` (date-prefixed `YYYY-MM-DD-slug.md` and frozen at that date), and short-lived working files in `tmp/` (gitignored, never committed). `yarn docs:notes:check` enforces the directory names and the date prefix.
- An approved design is committed under `docs/design/<design>/` before anything is built to it ([ADR 0110](docs/adr/0110-an-approved-design-is-committed-to-the-repo.md)): the design tool's export, byte for byte, with a README naming its source link, version, and every artboard. A PRD, issue, or Pull Request that builds to a design links **both** the committed folder (a slice names the artboards it covers by path) **and** the tool link. A later change is re-exported and committed on its own.
- Standards live in the documents indexed by [`CODING_STANDARDS.md`](CODING_STANDARDS.md). Add a rule to its source document and link, rather than restating it in the index.
- `CONTEXT.md` is the domain glossary — read it before changing domain language, and do not redefine a term it already carries; sharpen or extend instead. A new term touching encrypted data must say whether it means plaintext (client-only) or ciphertext (server-storable).
- ADRs in `docs/adr/` are numbered sequentially from `0001`. Scan for the highest existing number before adding one, then name the file `NNNN-lowercase-hyphen-slug.md`. If another pull request merges your number first, renumber yours; never renumber a merged ADR — supersede it ([ADR 0042](docs/adr/0042-adr-numbers-are-claims-until-merged.md)). Gaps are legal. Author an ADR `accepted`, never `proposed` ([ADR 0097](docs/adr/0097-an-adr-is-authored-accepted.md)). `yarn adr:numbering:check` and `yarn adr:status:check` enforce both.
- An artifact states no claim it does not assert ([ADR 0085](docs/adr/0085-an-artifact-states-no-claim-it-does-not-assert.md)). A `check-*.mjs` header declares which direction(s) it asserts, and why any omitted direction is omitted, and a contract suite proves the checker fails on the drift that header claims to catch. A House Explainer Page asserts the facts it states, or states less (see the `design-brief` Skill).
- Code fanning out over a domain enum reaches one `as const satisfies Record<EnumType, …>` table; it does not re-enumerate the members in an object literal, an if-chain, or a list of `if` statements. `yarn enum:fanout:check` enforces it for guarded enums ([ADR 0053](docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
- Classify `gate:*` first ([ADR 0012](docs/adr/0012-tiered-quality-gates.md)). When unsure → promote.
- Before issuing 3 or more consecutive read/search operations to locate something in the codebase, stop and delegate to `CodeExplorer` (`.github/agents/explore.agent.md`). Provide an Explore Request with a `Goal` sentence; optionally include `Known Locations`, `Search Hints`, `Supplied Evidence` (output of a command you ran for it — it has no shell), `Depth` (`quick` or `thorough`), `Out of Scope`, and `Expected Output`. CodeExplorer returns a structured Explore Summary with `[found]`/`[inferred]` tagged findings and ranked file paths.
- Keep `.github/agents` as the canonical Sub-agent body source. Keep `CodeExplorer` in `.cursor/agents/explore.md` on `model: composer-2.5`.
- For PR requests, use the AI PR command above. Do not fall back to a title-only PR if `PrAuthor` fails, and do not compute the merge base yourself to satisfy the gate.

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
- QA plan for finished work before its PR merges (PRD Issue, or a single issue) — compose or execute: `.agents/skills/qa-plan/SKILL.md`
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
| CI/workflow changes only                 | `ci/`    |
| _no label matches_                       | `chore/` |

`research` ranks last on purpose: it says why work is tracked, not what it changes. An issue
labelled `tooling` + `maintenance` + `research` is a chore, not documentation.

`qa` and `grilling` are Issue Orchestration Labels, not Surface Labels ([ADR 0049](docs/adr/0049-qa-and-grilling-are-orchestration-labels.md)), so they never pick a branch type and never appear on a Pull Request. `qa` marks a **QA Plan Issue** and nothing else; `grilling` marks an issue whose design must be stress-tested before work starts.

Slugs are lowercase, hyphen-separated, and short (~40 chars) — enough to recognise the branch in
`git branch`, not a restatement of the title.

Kind and area **Surface Labels** live in `tools/config/github-labels.json` ([ADR 0025](docs/adr/0025-pr-surface-labels.md)). Branch type uses **kind only**, first match in the table above. Area labels (`backend`, `web-app`, …) do not change the prefix. Pull Requests receive Surface Labels only — never Issue Orchestration Labels.

Reserved prefixes, which do **not** follow the table:

- `release/v<semver>` — release branches (see `docs/deployment/CI_CD_AND_RELEASE_PROCESS.md`).
- `slice/<issue>-<slug>` — sandcastle PRD slices. The prefix is load-bearing: it means the branch
  fast-forwards into a `feat/<prd-slug>` integration branch and its issue closes on success. Never
  create one by hand.
- `claude/…`, `copilot/…`, `cursor/…` — generated by agent tooling (Cursor Cloud Agents create `cursor/…` branches). Leave them alone; don't rename to match.

A reserved-prefix branch carries no issue number in its name, so it carries the issue in its **first
commit** instead — a `Closes #<issue>` line, which `/code-review` reads through the commit step of
its spec discovery order ([ADR 0076](docs/adr/0076-an-agent-branch-carries-its-issue-in-its-first-commit.md)).
`yarn dispatch-agents` writes that commit itself when it creates a `feat/<prd-slug>` integration
branch. On a `claude/…`, `copilot/…`, or `cursor/…` branch nothing writes it for you: **end your first commit's
body with `Closes #<issue>`** (or `Refs #<issue>` when the work should not close the issue). A pull
request body is **not** a spec source, so a branch that carries no reference anywhere reviews one
axis instead of two — do not leave one uncarried.

A **fix** also names what introduced its defect, in a commit body on the branch:
`Introduced in #<pull request>`, or `Introduced in unknown: <why>` when the archaeology finds
nothing. CI enforces it with `yarn fix:attribution:check`
([ADR 0100](docs/adr/0100-a-fix-names-what-introduced-it-in-its-commits.md)).

## ⚠️ Tiered Quality Gates (ADR 0012)

Do not treat every test/component touch as a full multi-agent pipeline. Classify a **gate tier** first (checklist Step 0 or slice `gate:*` label). When unsure → promote. Applies to interactive and AFK sessions.

| Tier              | Execution                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `gate:mechanical` | Main agent may edit (fixture/type retarget, rename, dead delete, selector-only E2E) + focused checks |
| `gate:standard`   | Matching specialist hop for the artifact                                                             |
| `gate:full`       | Full mandatory pipelines                                                                             |

| File Pattern                                              | Skill                                                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `*.spec.ts` (Playwright E2E)                              | `.agents/skills/playwright-e2e-workflow/SKILL.md`                                                               |
| `*.test.ts` (Jest)                                        | `.agents/skills/unit-test-delegation-workflow/SKILL.md`                                                         |
| `*.stories.tsx`                                           | `.agents/skills/storybook-delegation-workflow/SKILL.md`                                                         |
| Components in `libs/web/ui/` / `libs/web/pages/`          | `.agents/skills/component-builder/SKILL.md`                                                                     |
| API Contract (controllers, DTOs, Prisma for HTTP)         | `.agents/skills/backend-api-contract-change/SKILL.md`                                                           |
| House Explainer Page (`docs/**/*.html`)                   | `.agents/skills/design-brief/SKILL.md` → `Designer`                                                             |
| Mobile app / library (`apps/mobile/**`, `libs/mobile/**`) | No specialist hop — direct edit; gate is lint + typecheck + format (ADR 0005) plus `yarn mobile-platform:check` |

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
