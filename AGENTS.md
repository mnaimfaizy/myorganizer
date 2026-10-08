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
- Native mobile code reaches a shared library through its Portable Entry Point (`@myorganizer/auth/portable`, `@myorganizer/vault-core/portable`), never its main entry point — the main barrels reach browser-only code, and `typeof window` guards do not protect native because React Native sets `global.window = global`. `mobile:typecheck` runs a native program with no `dom` and a web program (`tsconfig.web.json`) that resolves `.web` Platform Variants; see [ADR 0103](docs/adr/0103-mobile-native-code-is-typechecked-without-dom-and-reaches-shared-libraries-through-a-portable-entry-point.md).
- No non-spec mobile program has Node types, so `process`, `Buffer`, and a global `crypto` do not compile in mobile code. Import a missing name from a package that provides it; only for a global Hermes itself provides, declare it in `libs/mobile/native-globals.d.ts` (created with its first entry). Never restore `types: ["node"]` or add `dom` to make a name resolve — `apps/mobile/src/runtime-globals.assert.ts` fails `mobile:typecheck` if Node types return. See [ADR 0120](docs/adr/0120-a-mobile-program-gets-node-types-only-if-it-runs-on-node.md).
- `targetSdk 36` means Android enforces edge-to-edge for this app with no opt-out; every screen root must come from `react-native-safe-area-context`, not a manual status-bar inset.
- Reach the mobile theme through `useTheme()` inside a `ThemeProvider`, never as a module-level constant: a theme captured at import time is one colour mode forever, which is how the app was light-only. Colours come from the Semantic Roles the theme exposes, and text size from a Type Scale step used whole.
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
- Design token drift check: `yarn design-tokens:check` (rebuilds `libs/design-tokens/src/generated` from `tokens.json` and asserts the tree did not move). See [ADR 0098](docs/adr/0098-a-covering-gate-is-part-of-the-site-not-the-answer.md).
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
- Skill atlas check: `yarn skills:map:check` (asserts `docs/agents/skill-atlas.html` against `.agents/skills`, `.github/agents`, and `AGENTS.md`). See [ADR 0046](docs/adr/0046-house-explainer-pages-have-a-designer-and-a-gate.md).
- Agent orchestration map check: `yarn agents:map:check` (asserts `docs/agents/orchestration-map.html` and `docs/agents/agent-journey.html` against `tools/config/agent-model-policy.json`). See [ADR 0046](docs/adr/0046-house-explainer-pages-have-a-designer-and-a-gate.md).
- Vault diagram pages check: `yarn vault:pages:check` (asserts `docs/vault/*.html` against the vault source constants). See [ADR 0052](docs/adr/0052-a-built-explainer-page-is-its-own-source.md).
- Auth diagram pages check: `yarn auth:pages:check` (asserts `docs/authentication/session-lifecycle.html` against the auth source constants). See [ADR 0052](docs/adr/0052-a-built-explainer-page-is-its-own-source.md).
- Nx project tags check: `yarn nx:tags:check` (asserts every `project.json` carries exactly one `type:*`/`scope:*`/`tier:*` tag from `tools/config/nx-project-tags.json`). See [ADR 0070](docs/adr/0070-a-review-tier-is-a-fact-about-the-diff-and-a-gate-tier-is-a-decision-about-the-work.md).
- Nx declared-target ratchet check: `yarn nx:targets:check` (asserts every `project.json` target on a deprecated `@nx/*` executor matches the shrink-only baseline `tools/config/nx-declared-targets-baseline.json`; `yarn nx:targets:test` covers it). See [ADR 0082](docs/adr/0082-nx-targets-are-inferred-and-a-declared-target-is-migration-debt.md) and [ADR 0083](docs/adr/0083-a-declared-target-is-debt-only-on-an-executor-nx-deprecated.md).
- Review Tier classifier: `yarn review:tier:check --base <sha> --head <sha> [--author <login>]` (computes `review:auto|agent|human` from the diff, the Nx graph, and `tools/config/review-tier-paths.json`; `yarn review:tier:replay` re-tiers the last 200 merged Pull Requests for threshold tuning). See [ADR 0070](docs/adr/0070-a-review-tier-is-a-fact-about-the-diff-and-a-gate-tier-is-a-decision-about-the-work.md).
- Code review concurrency check: `yarn review:concurrency:check` (asserts every trigger the `Code Review` workflow's `context` job refuses is also steered out of the review's concurrency group; `--print` shows both expressions, `yarn review:concurrency:test` covers it). See [ADR 0115](docs/adr/0115-a-concurrency-group-agrees-with-the-job-it-cannot-see.md).
- Review pipeline page check: `yarn review:pages:check` (asserts `docs/review/finding-lifecycle.html` against the finding contract in `tools/scripts/review/schema.mjs`, the CI job names, and the gate tier labels). See [ADR 0046](docs/adr/0046-house-explainer-pages-have-a-designer-and-a-gate.md).
- Review checklist check: `yarn review:checklist:check` (asserts [`docs/review/REVIEW_CHECKLIST.md`](docs/review/REVIEW_CHECKLIST.md) agrees with `tools/config/review-obligations.json` on ids, order, and fields; `--print` shows both sides).
- Obligation answer check: `yarn review:obligations:check <worklist.json> <answers.json>` (asserts every cited answer field matches the tree at the reviewed head and that a required defect was actually raised as a finding; `yarn review:test` covers it). See [ADR 0078](docs/adr/0078-a-citation-that-does-not-match-its-source-is-a-fact-about-the-pipeline.md) (ADR 0073 gates on the ground it establishes).
- Rule catalogue check: `yarn review:rules:check` (asserts `tools/config/review-rules.json` agrees with the finding contract, the obligations catalogue, and the ids each axis's brief file beside [the code-review skill](.agents/skills/code-review/SKILL.md) offers its sub-agent, and that the two briefs carry the same shared block; `--print` lists the catalogue, `yarn review:test` covers the loader). See [ADR 0071](docs/adr/0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md).
- Reviewer tool allowlist check: `yarn review:allowlist:check` (asserts every command the code-review skill or [the Review Checklist](docs/review/REVIEW_CHECKLIST.md) instructs is permitted by `.github/actions/code-reviewer/action.yml`'s `--allowedTools` and not intercepted by an `ask`/`deny` rule in tracked `.claude/settings.json`, and that every path-scoped file grant there is anchored and on a tool Claude Code consults; `--print` shows every entry and rule, `yarn review:allowlist:test` covers the matcher). See [ADR 0099](docs/adr/0099-a-project-ask-rule-is-a-refusal-in-a-headless-run.md), [ADR 0118](docs/adr/0118-a-file-grant-is-anchored-where-the-session-started.md), and [the run-45 research brief](docs/research/2026-09-10-the-answer-sheet-is-inert.md).
- Code review golden set: `yarn review:golden:check` (asserts `tools/config/review-golden-set.json` is well-formed and reachable from `main`, and matches the replay's trigger, tier, and pre-score obligation-gate rules; `yarn review:golden:score --case <id> --normalized <file>` scores one replay). See [ADR 0109](docs/adr/0109-a-golden-replay-runs-on-a-schedule-and-on-request.md), [ADR 0102](docs/adr/0102-a-golden-replay-reviews-the-case-tree-with-the-pull-requests-harness.md), [ADR 0072](docs/adr/0072-a-golden-case-earns-its-replay-frequency.md), [ADR 0116](docs/adr/0116-a-golden-case-stands-on-its-catch-rate-over-its-last-ten-scored-runs.md), [ADR 0074](docs/adr/0074-a-gate-suppresses-a-finding-only-if-something-runs-it.md), and [ADR 0101](docs/adr/0101-a-replay-whose-answer-sheet-fails-its-check-measured-nothing.md); results are kept current in [`docs/review/golden-replay-results.md`](docs/review/golden-replay-results.md).
- Code review escaped-defect rate: `yarn review:escaped:measure [--days 60]` (of the Pull Requests the reviewer passed, what fraction a later fix names as root cause; `yarn review:test` covers the attribution parser). Not a gate; opt-out in `tools/config/gate-coverage-optout.json`. See [ADR 0077](docs/adr/0077-an-escaped-defect-is-one-the-reviewer-saw-and-passed.md); kept current in [`docs/review/escaped-defect-rate.md`](docs/review/escaped-defect-rate.md).
- Fix attribution check: `yarn fix:attribution:check --base <sha> --head <sha> --branch <ref> [--title <text>]` (asserts a fix's commits carry `Introduced in #<pull request>` or a named `unknown` reason; `yarn fix:attribution:test` covers it). See [ADR 0100](docs/adr/0100-a-fix-names-what-introduced-it-in-its-commits.md).
- Code review effective-false-positive rate: `yarn review:noise:measure [--days 30]` (per rule, the share of findings raised and still unaddressed on the next push; `--save-gather` persists the 30-day evidence window; `yarn review:test` covers the classes, marker, and budget). Not a gate; opt-out in `tools/config/gate-coverage-optout.json`. See [ADR 0079](docs/adr/0079-an-effective-false-positive-is-a-finding-nobody-acted-on.md); kept current in [`docs/review/effective-false-positive-rate.md`](docs/review/effective-false-positive-rate.md).
- Code review report contract: `yarn review:validate <report.json> --out <normalized.json> [--previous <normalized.json>] [--facts <run-facts.json>] [--worklist <obligations.json>]` rejects or normalizes a `/code-review` report, computes its verdict, and carries each finding's id forward from the previous report; `yarn review:render <normalized.json>` renders the two-section Markdown; `yarn review:test` runs the contract tests. See [ADR 0071](docs/adr/0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md).
- Code review run facts: `node tools/scripts/review/read-transcript-facts.mjs <execution-file> --out <run-facts.json> [--index CODING_STANDARDS.md]` reads a reviewer transcript for the standards documents the Standards sub-agent opened, the commands the sub-agents ran, the session's duration, model and Claude Code CLI version, and whether each dispatch was the skill's template; `yarn review:validate --facts <run-facts.json>` overwrites the report's own claims with them and judges the run: no sub-agent reading an axis's brief, or a reported finding no sub-agent returned, is recorded as a failure that fails `Agent Review Ran` and voids a golden replay, while an unopened `CODING_STANDARDS.md`, a dispatch off the template, or a transcript or reply that cannot be read tightens the Review Tier one step. The reader itself gates nothing; a transcript it cannot read is recorded as unknown, never as an empty list. `yarn review:test` covers both against fixtures cut from real transcripts. See [ADR 0123](docs/adr/0123-a-review-reports-facts-about-its-own-run-are-read-from-the-transcript.md).
- CI code review: `.github/workflows/code-review.yml` runs the `/code-review` skill as two checks — `Agent Review Ran` (pipeline facts, eligible to be required) and `Agent Verdict` (a judgment on the diff, permanently advisory). Triggers automatically per the `CODE_REVIEW_MODE` repository variable (`CODE_REVIEW_ENABLED=false` disables it), or on demand via the `agent-review` label, a `/code-review` comment, or `workflow_dispatch`; needs `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`. See [ADR 0070](docs/adr/0070-a-review-tier-is-a-fact-about-the-diff-and-a-gate-tier-is-a-decision-about-the-work.md) item 6, [ADR 0071](docs/adr/0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md), [ADR 0073](docs/adr/0073-a-required-check-is-a-fact-about-the-pipeline-not-a-judgment-about-the-diff.md), [ADR 0078](docs/adr/0078-a-citation-that-does-not-match-its-source-is-a-fact-about-the-pipeline.md), and [the token-scoping research brief](docs/research/2026-09-07-resolve-review-thread-token.md).
- Release pipeline page check: `yarn deploy:pages:check` (asserts `docs/deployment/release-pipeline.html` against `.github/workflows/*.yml`, `package.json`, and `tools/scripts/release.mjs`; `--print` shows what each extractor resolved). See [ADR 0046](docs/adr/0046-house-explainer-pages-have-a-designer-and-a-gate.md).
- Libs markdown allowlist: `yarn libs:markdown:check` (Husky + CI; do not skip).
- Guarded enum fan-out check: `yarn enum:fanout:check` (asserts every scope covering a Guarded Enum reaches its Pinned `satisfies Record<…>` table instead of hand-enumerating members; `--print` shows the members, pin, and exempt sites). See [ADR 0053](docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md).
- Tailwind themed-utility check: `yarn tailwind:classes:check` (compiles the real app stylesheet and fails any colour, spacing, or radius class that resolves to no CSS; `--print` lists what was scanned). See [ADR 0065](docs/adr/0065-tokens-json-is-the-single-source-of-web-colour.md).
- Documented-command check: `yarn docs:commands:check` (asserts a path named inside a fenced shell block in any tracked Markdown file exists; placeholders and git-ignored build outputs are skipped). See [ADR 0052](docs/adr/0052-a-built-explainer-page-is-its-own-source.md).
- Documented file-ref check: `yarn docs:file-refs:check` (asserts a backticked repo-relative path, or a named `libs/`/`apps/` module, resolves on disk; `docs/research/` is skipped as frozen history; remaining exemptions carry a written reason in `tools/config/doc-file-refs-exemptions.json`). See [ADR 0093](docs/adr/0093-a-markdown-file-ref-is-asserted-against-the-tree.md).
- Escape Copy reader build: `yarn escape-copy-reader:build` (bundles `apps/escape-copy-reader` into one self-contained HTML file plus `SHA256SUMS.txt` under `dist/escape-copy-reader/`; `.github/workflows/publish-github-release.yml` runs it and attaches both to every GitHub Release). See [ADR 0064](docs/adr/0064-an-escape-copy-is-opened-by-a-tool-that-needs-nothing-of-ours.md).
- Escape Copy reader gate: `yarn escape-copy-reader:check` (builds the reader and opens a freshly produced envelope under both secrets, comparing every Vault Blob Type's plaintext, and fails a stale schema version, any network/storage reach, a design-token mismatch, or a checksum that doesn't match the published file; judgments live in `tools/scripts/lib/escape-copy-reader-gate.mjs`, `yarn escape-copy-reader:test` covers them). See [ADR 0064](docs/adr/0064-an-escape-copy-is-opened-by-a-tool-that-needs-nothing-of-ours.md).
- QA Accounts: `yarn qa:accounts:seed` creates the local database's QA Accounts as verified users with unlockable vaults, or puts their password and vault meta back (`--restore` also empties the vault; `--account <id>` picks one); `yarn qa:accounts` prints their sign-in values, Recovery Key included. It refuses any database that is not local, and `yarn qa:accounts:test` covers that. See [ADR 0122](docs/adr/0122-a-qa-accounts-credentials-are-public-fixtures-in-tracked-source.md).
- Mobile platform check: `yarn mobile-platform:check` (parses `apps/mobile` and `libs/mobile` and fails a bare `react-native/…` subpath import, a browser global, or an import of a shared library's main entry point where a `@myorganizer/<lib>/portable` alias exists; `--print` lists what was scanned; exemptions carry a written reason in `tools/config/mobile-platform-exemptions.json`). See [ADR 0103](docs/adr/0103-mobile-native-code-is-typechecked-without-dom-and-reaches-shared-libraries-through-a-portable-entry-point.md).
- Committed Upstream Brief reports: `yarn upstream:briefs:check` (re-validates every structured `*.json` report committed under the brief directory, checking each local citation against the commit the report itself records; `yarn upstream:briefs:test` covers the contract, renderer, CLIs, ledger, and checker). See [ADR 0084](docs/adr/0084-an-upstream-brief-is-anchored-to-what-is-installed-and-accepted-on-checked-evidence.md) and [ADR 0018](docs/adr/0018-upstream-brief-portable-instruction-audit.md); shape and memory in [REPORT.md](.agents/skills/upstream-brief/REPORT.md), [LEDGER.md](.agents/skills/upstream-brief/LEDGER.md), and [SKILL.md](.agents/skills/upstream-brief/SKILL.md).
- Prisma migration history check: `yarn prisma:migrations:check` (asserts migration directory naming, no duplicate timestamps, a non-empty `migration.sql`, no stray `.sql` file, and lock-file/schema provider agreement; `yarn prisma:migrations:test` covers it). See [ADR 0094](docs/adr/0094-a-prisma-migration-is-gated-on-the-tree-and-against-a-database.md) (the same-timestamp hazard is [ADR 0042](docs/adr/0042-adr-numbers-are-claims-until-merged.md)'s, one layer down).
- Assertion gates aggregate: `yarn gates:run` (runs the file-reading checkers above plus OpenAPI artifacts, ADR numbering, and the wired-gate check in one Node process). See [ADR 0043](docs/adr/0043-gates-assert-facts.md).
- Wired-gate check: `yarn gates:coverage:check` (the Meta-Gate — asserts every `tools/scripts/check-*.mjs` is invoked by a hook or workflow; an intentional non-gate needs a written-reason entry in `tools/config/gate-coverage-optout.json`). See [ADR 0043](docs/adr/0043-gates-assert-facts.md).
- Checker contract-coverage check: `yarn checker-contracts:check` (asserts every `check-*.mjs` carries a contract suite proving it fails on the drift its header claims to catch, or is named in the shrink-only baseline `tools/config/checker-contract-baseline.json` — no written-reason opt-out; `yarn checker-contracts:test` covers it). See [ADR 0085](docs/adr/0085-an-artifact-states-no-claim-it-does-not-assert.md).
- House Explainer Page hygiene: `yarn design:hygiene <path>` (or `--all`, `--staged`; `--print-font-block` emits the canonical `@font-face` block for a new page). See [ADR 0046](docs/adr/0046-house-explainer-pages-have-a-designer-and-a-gate.md).
- House Explainer Page citations: `yarn design:hygiene` also resolves each page's `file:line` citations against an expected-content anchor and fails an unreadable or out-of-range one as `citation-anchor-unreadable`; an anchor entry that keys no citation fails as `citation-anchor-orphan`, and a continuation line written without its colon (`main.mts:153, 205`) as `citation-continuation-unparsed`; not-yet-anchored pages sit in the shrink-only baseline `tools/config/citation-anchor-baseline.json`; `yarn design:hygiene:test` covers it. See [ADR 0085](docs/adr/0085-an-artifact-states-no-claim-it-does-not-assert.md).

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
- An approved design is committed under `docs/design/<design>/` before anything is built to it ([ADR 0110](docs/adr/0110-an-approved-design-is-committed-to-the-repo.md)): the design tool's export, byte for byte, with a README naming its source link, version, and every artboard. The committed copy is the design of record. A PRD, issue, or Pull Request that builds to a design links **both** the committed folder (a slice names the artboards it covers by path) **and** the tool link; the link alone reaches nobody who cannot sign in to it, which is every agent in the sandbox. A later change is re-exported and committed on its own.
- Standards live in the documents indexed by [`CODING_STANDARDS.md`](CODING_STANDARDS.md). Add a rule to its source document and link, rather than restating it in the index.
- `CONTEXT.md` is the domain glossary — read it before changing domain language, and do not redefine a term it already carries; sharpen or extend instead. A new term touching encrypted data must say whether it means plaintext (client-only) or ciphertext (server-storable).
- ADRs in `docs/adr/` are numbered sequentially from `0001`. Scan for the highest existing number before adding one, then name the file `NNNN-lowercase-hyphen-slug.md`. A number is a claim until it merges and a fact afterwards ([ADR 0042](docs/adr/0042-adr-numbers-are-claims-until-merged.md)): if another pull request merges your number first, renumber yours; never renumber a merged ADR — supersede it. Gaps are legal. `yarn adr:numbering:check` asserts unique numbers and filename shape; Husky and CI run it. **Status follows the same line as the number**: an ADR is authored `accepted` and never `proposed`, exactly as it is authored with the number it claims rather than with a placeholder ([ADR 0097](docs/adr/0097-an-adr-is-authored-accepted.md)). `yarn adr:status:check` asserts that no ADR's status slot reads `proposed`, in either the `## Status` section form or the frontmatter form; Husky and CI run it. The previous rule — `proposed` while the pull request is open, flipped on merge — was itself written after four ADRs sat `proposed` on `main`, and five more did the same thing under it. A status flipped in a follow-up step is a status nobody flips, so ADR 0097 removes the step rather than restating the rule.
- An artifact states no claim it does not assert ([ADR 0085](docs/adr/0085-an-artifact-states-no-claim-it-does-not-assert.md)). A `check-*.mjs` header **declares which direction(s) it asserts, and why any omitted direction is omitted** — and a contract suite proves the checker actually fails on the drift that header claims to catch. Neither half stands alone: the header is the specification, the test is what makes it true. Writing the direction down does not make it so, and a header nothing asserts rots like any other unasserted claim — `check-readme.mjs` declared "drift runs both ways" over code that ran one, in exactly the fixed form the convention asks for. The same rule on the page side: a House Explainer Page asserts the facts it states, or states less (see the `design-brief` Skill).
- Code fanning out over a domain enum reaches one `as const satisfies Record<EnumType, …>` table; it does not re-enumerate the members in an object literal, an if-chain, or a list of `if` statements. Those shapes compile while handling some members and not others, which is how a keep-server reconcile destroyed grocery ciphertext and how hardened export silently dropped the Tasks blob. `yarn enum:fanout:check` enforces it for guarded enums ([ADR 0053](docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
- Classify `gate:*` first ([ADR 0012](docs/adr/0012-tiered-quality-gates.md)). When unsure → promote.
- Before issuing 3 or more consecutive read/search operations to locate something in the codebase, stop and delegate to `CodeExplorer` (`.github/agents/explore.agent.md`). Provide an Explore Request with a `Goal` sentence; optionally include `Known Locations`, `Search Hints`, `Supplied Evidence` (output of a command you ran for it — it has no shell), `Depth` (`quick` or `thorough`), `Out of Scope`, and `Expected Output`. CodeExplorer returns a structured Explore Summary with `[found]`/`[inferred]` tagged findings and ranked file paths.
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
