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
- `targetSdk 35` means Android 15 already enforces edge-to-edge for this app; every screen root must come from `react-native-safe-area-context`, not a manual status-bar inset.
- Style mobile components with `StyleSheet.create` over the token theme, and never with a browser API. A component's styles live in a `StyleSheet.create` block, not in an inline object standing in for one; merging that reference with a small inline override for a per-render value — `style={[styles.header, { marginBottom: theme.spacing.md }]}` — is the established pattern here and stays fine. See [ADR 0008](docs/adr/0008-mobile-styling-stylesheet-theme.md).

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
- Nx project tags check: `yarn nx:tags:check` (asserts every `project.json` carries exactly one `type:*`, `scope:*`, and `tier:*` tag from `tools/config/nx-project-tags.json`; `type` and `scope` drive `@nx/enforce-module-boundaries` in `eslint.config.js`, `tier` is the Review Tier classifier's primary signal).
- Review Tier classifier: `yarn review:tier:check --base <sha> --head <sha> [--author <login>]` (a Wired Gate run by `.github/workflows/review-tier.yml` on every Pull Request; computes `review:auto|agent|human` from the diff, the Nx graph, the `tier:*` tags, and `tools/config/review-tier-paths.json`, and explains every signal — see [ADR 0070](docs/adr/0070-a-review-tier-is-a-fact-about-the-diff-and-a-gate-tier-is-a-decision-about-the-work.md); `yarn review:tier:replay` re-tiers the last 200 merged Pull Requests for threshold tuning).
- Code review concurrency check: `yarn review:concurrency:check` (asserts that every trigger the `Code Review` workflow's `context` job refuses is also steered out of the review's concurrency group; `--print` shows both expressions and the literals that tie them). Concurrency is evaluated when a run is created, before any job `if:` is read, so a run whose jobs all skip still joins the group and, with `cancel-in-progress`, cancels the review in flight. That cost three pull requests their review — twice through `labeled` events from `ai:create-pr`, once through an `issue_comment` event from a bot comment, which is invisible when listing runs for the branch because `issue_comment` runs are attributed to the default branch. It follows that authorization for `/code-review` is decided in the group expression and the job `if:`, not in the step: a check inside the run happens after the run has already cancelled the review, so an unauthorized commenter could stop a review by typing the command. `yarn review:concurrency:test` covers the checker.
- Review pipeline page check: `yarn review:pages:check` (asserts `docs/review/finding-lifecycle.html` against the finding contract in `tools/scripts/review/schema.mjs`, the CI job names, and the gate tier labels).
- Review checklist check: `yarn review:checklist:check` (asserts [`docs/review/REVIEW_CHECKLIST.md`](docs/review/REVIEW_CHECKLIST.md) against `tools/config/review-obligations.json` — same ids, same order, same answer fields, same cited fields; `--print` shows both sides). The checklist is the human form of the catalogue an agent receives pre-selected, so the two drift silently without it.
- Obligation answer check: `yarn review:obligations:check <worklist.json> <answers.json>` (compares the reviewer's own answer sheet against two things and nothing else — the tree at the reviewed head, and the entry's own defect rule). Every answer field that makes a claim about source carries a file, a line, and the literal text at that line; the checker reads that line with `git show <head>:<file>` and fails on a mismatch, a line past the end of the file, a file that is not there, or a cited field quoting nothing. It fails equally on an answer that meets its obligation's `defectWhen` while the reviewer's report carries no finding for it, because the catalogue entry already decided that answer is a finding — and whether the finding was raised is read out of the report passed with `--report`, never taken from the sheet's own `raisedFindingIds`, because a finding's id is a hash the validator computes after the sheet is written. Exit 2 (an unreadable sheet, a head this clone does not have) gates too, deliberately. Neither is a finding and neither is about the diff: both are facts about the reviewer, which is what makes them gateable at all ([ADR 0078](docs/adr/0078-a-citation-that-does-not-match-its-source-is-a-fact-about-the-pipeline.md), on the ground ADR 0073 holds). Thoroughness still fails nothing — an unanswered obligation is reported and blocks nobody. `yarn review:test` covers the comparison and replays the two 2026-09-10 answer sheets that bought it.
- Rule catalogue check: `yarn review:rules:check` (asserts `tools/config/review-rules.json` — the bounded vocabulary a finding's `ruleId` draws on — against everything it is drawn from: the finding contract's axes and severities, `tools/config/review-obligations.json` in both directions, the documents each `standard-*` entry cites, and the ids [the code-review skill](.agents/skills/code-review/SKILL.md) actually pastes into the reviewer's prompt; `--print` lists the catalogue). The rule id is hashed into a finding's identity and the validator rejects an id the catalogue does not carry, so drift is expensive in both directions: an id the prompt never offers cannot be chosen, and an id the prompt offers that the catalogue lacks produces a report the validator rejects whole — and a rejected report is no report. Five families, each bounded by something that already existed: the twelve Fowler smells the Standards brief pastes, one entry per review obligation, the two reach-through checks, one entry per documented repo standard, and the three defect kinds the Spec brief asks for. `standard-other` is the one fallback and the spec axis has none; `yarn review:test` covers the catalogue loader.
- Reviewer tool allowlist check: `yarn review:allowlist:check` (asserts that every command [the code-review skill](.agents/skills/code-review/SKILL.md) and [the Review Checklist](docs/review/REVIEW_CHECKLIST.md) instruct the reviewer to run is permitted by the `--allowedTools` list in `.github/actions/code-reviewer/action.yml`; `--print` shows every entry and every site it classified). Both sides are files, so nothing here depends on a transcript, which expires after seven days. Matching is token-wise: `Bash(sed -n:*)` permits a command whose first two tokens are exactly `sed` and `-n` and permits nothing about `sed '1,20p' file`, which is how an entry ends up matching nothing anybody was told to run. A script written as a shape — "the `*:check` gates" — is expanded to every script it names and refused when none of them is permitted, because reporting only the literal spellings that happen to be written down nearby understates the hole. The program vocabulary is written out rather than derived from the allowlist, so narrowing the allowlist cannot make an instruction invisible instead of refused; the check fails instead when the action grants a program the vocabulary does not know. A refused command is not free — golden replay run 45 spent 26 permission denials of an 81-turn budget and wrote no report at all, so the guard case it was measuring scored nothing ([research](docs/research/2026-09-10-the-answer-sheet-is-inert.md)). A command the documents name but nobody is asked to run — `review:publish`, `review:spec`, the selector the composite action already ran — carries a written reason in the checker's `NOT_THE_REVIEWERS_TO_RUN` list, and a reason that stops matching anything fails the check. `yarn review:allowlist:test` covers the matcher.
- Code review golden set: `yarn review:golden:check` (asserts `tools/config/review-golden-set.json` — incident commit ranges and the findings a reviewer should have raised — is well-formed, that both ends of every range are reachable from `main`, and that `.github/workflows/review-golden-replay.yml` triggers on every input ADR 0071 names); `yarn review:golden:score --case <id> --normalized <file>` scores one replay; the replay itself runs in CI as the `Golden Replay` check on Pull Requests that touch the skill, the review scripts, the review workflows, or the set, one reviewer run per case. Every case carries a `tier` ([ADR 0072](docs/adr/0072-a-golden-case-earns-its-replay-frequency.md)): `frontier` cases — the ones the reviewer misses — run on any of those paths, while `guard` cases — the ones it catches reliably — run only when the Standards brief or the finding contract changes. Promotion to `guard` takes three consecutive catches cited in `tierEvidence`; demotion takes one miss. A case that turns out to be **unwinnable rather than hard** moves to `retired` with a written reason and keeps its id reserved — most often because the incident was fixed by adding a gate whose defect the reviewer is correctly instructed not to report, so scoring it as a miss penalises correct behaviour — see [ADR 0074](docs/adr/0074-a-gate-suppresses-a-finding-only-if-something-runs-it.md) for the suppression condition. Retire; do not delete, or the reason is lost and the case comes back. `[skip replay]` in the head commit's **subject line** skips the replay for that push and nothing else, which the path filter cannot do — GitHub matches a `pull_request` path filter against the whole PR diff, so a docs-only push to a branch that touched the skill still satisfies it. The **body is not read**: a commit explaining a measurement routinely writes the marker inside a sentence about it, and one that did skipped its own replay in 19 seconds while reporting success. Run a tier deliberately with the `Golden Replay` workflow's `workflow_dispatch` input. Results and the tier table are kept current in [`docs/review/golden-replay-results.md`](docs/review/golden-replay-results.md); the reasoning behind a number is a frozen Research Brief.
- Code review escaped-defect rate: `yarn review:escaped:measure [--days 60]` (the reviewer's trust measurement — of the Pull Requests the reviewer passed, what fraction a later fix names as root cause; [ADR 0077](docs/adr/0077-an-escaped-defect-is-one-the-reviewer-saw-and-passed.md)). It pairs every merged fix Pull Request in the window with the change its issue, its body, or its commits name as root cause, resolves that to a merged Pull Request, and reads the verdict back out of the publisher's own sticky comment. Golden recall is not this number: it scores curated historical defects and is a regression signal, explicitly not a trust measure. Three separations decide whether the result means anything, and each is a way the measurement could flatter the reviewer — a Pull Request the reviewer **never saw** is reported apart from one it **saw and passed**, and only the second is an escape; a `request-changes` the maintainer merged anyway is the reviewer working, not missing; and a fix naming no root cause is **counted as unattributed**, never dropped, so the denominator is auditable. An empty denominator reports `not measurable`, never 0%. Not a gate — it measures merged history, has nothing to fail on for the commit in front of it, and reads `gh` — so it carries a written opt-out in `tools/config/gate-coverage-optout.json`. The rate is kept current in [`docs/review/escaped-defect-rate.md`](docs/review/escaped-defect-rate.md); the reasoning behind a number is a frozen Research Brief. `yarn review:test` covers the attribution parser.
- Code review effective-false-positive rate: `yarn review:noise:measure [--days 30]` (what the reviewer **costs**, where the escaped-defect rate is what it misses — per rule, the share of findings raised and still there on the next push; [ADR 0079](docs/adr/0079-an-effective-false-positive-is-a-finding-nobody-acted-on.md)). **Inaction is the signal and correctness is not the question**: a finding nobody acted on counts against its rule whether or not it was right, because it cost the same attention either way and "was it correct?" cannot be answered without a human labelling every comment. The term and the 10%-per-rule budget are Google's, borrowed whole with their source written next to the number — it is the only published noise threshold that arrives with a mechanism attached — and a rule is judged against it only above ten observations, below which one ignored finding is already over ten percent. The evidence is the review's own stored `code-review-normalized` artifacts, which live 30 days, so `--save-gather` is the only durable record of a window; the unit is an observation, not a finding, which is why the review runs on **every push** — debouncing it removes the measurement. Two runs at one head are one push, because pairing them compares a report with itself and reads every finding in it as ignored. An optional `Review-ack: <finding id>` line in a commit message takes one finding out of the numerator, names the id the report prints (never a rule id), is written once and holds while that finding survives, and is never required. Nothing is disabled on this number: the automatic disable needs a month of data and is a deliberate follow-up. Not a gate — it reads other branches' pushes over the network and asserts nothing about the commit in front of it — so it carries a written opt-out in `tools/config/gate-coverage-optout.json`. The rate is kept current in [`docs/review/effective-false-positive-rate.md`](docs/review/effective-false-positive-rate.md); the reasoning behind a number is a frozen Research Brief. `yarn review:test` covers the classes, the marker, and the budget.
- Code review report contract: `yarn review:validate <report.json> --out <normalized.json>` rejects or normalizes a `/code-review` report and computes its verdict; `yarn review:render <normalized.json>` renders the two-section Markdown; `yarn review:test` runs the contract tests (ADR 0071).
- CI code review: `.github/workflows/code-review.yml` runs the `/code-review` skill as two checks (ADR 0070 item 6; ADR 0071; [ADR 0073](docs/adr/0073-a-required-check-is-a-fact-about-the-pipeline-not-a-judgment-about-the-diff.md)): `Agent Review Ran` fails when the reviewer crashed, was cut off by the rate limit, wrote a report the contract rejected, or wrote an obligation answer sheet that does not hold up — a quotation that does not match the tree at head, an answer meeting its own defect condition while the report carries no finding for it, or a sheet nobody can parse ([ADR 0078](docs/adr/0078-a-citation-that-does-not-match-its-source-is-a-fact-about-the-pipeline.md)) — every one of them a fact about the pipeline, and the only one of the two checks eligible to be required — while `Agent Verdict` fails on a `request-changes` verdict, which is a judgment about the diff and is advisory. Do not propose making `Agent Verdict` required on recall grounds; ADR 0073 rejects that on principle, not on the number — automatically on every non-draft Pull Request when the repository variable `CODE_REVIEW_MODE` is `auto` (default), and on demand in any mode by adding the `agent-review` label (removed again after the run), commenting `/code-review` on the Pull Request (write access), or dispatching the workflow with a PR number; `CODE_REVIEW_ENABLED=false` turns it off. Each run posts a new summary comment and marks the previous one outdated; a thread whose finding went away is resolved, or replied to and left for a human when the mutation is refused. Posting happens in a separate `Publish Review` job, the only one whose token can write: GitHub scopes permissions per job, not per step, so `contents: write` — which `resolveReviewThread` is reported to require despite writing nothing ([research](docs/research/2026-09-07-resolve-review-thread-token.md), issue #685) — must not sit on the job the reviewer runs in. The reviewer's own job holds four read scopes and no write. Everything the pipeline posts, labels, or resolves is attributed to `github-actions[bot]`, because `GITHUB_TOKEN` is that GitHub App's installation access token; do not add a personal access token, which would attribute machine actions to a maintainer and corrupt the review audit trail. Plumbing scripts: `yarn review:spec` resolves the spec source with the job token, `yarn review:validate --tier <label>` pins the classifier's tier, `yarn review:publish` edits the sticky summary comment, posts inline comments for blocking findings, and relabels to `review:human` on a blocking verdict. The reviewer writes JSON only and never holds a token. Requires the `CLAUDE_CODE_OAUTH_TOKEN` secret (a subscription token from `claude setup-token`; `ANTHROPIC_API_KEY` is accepted as a fallback); with neither the job explains and skips.
- Release pipeline page check: `yarn deploy:pages:check` (asserts `docs/deployment/release-pipeline.html` against `.github/workflows/*.yml`, `package.json`, and `tools/scripts/release.mjs`; `--print` shows what each extractor resolved).
- Libs markdown allowlist: `yarn libs:markdown:check` (Husky + CI; do not skip).
- Guarded enum fan-out check: `yarn enum:fanout:check` (parses the TypeScript corpus and asserts that every scope covering a Guarded Enum reaches that enum's Pinned `satisfies Record<…>` table instead of hand-enumerating the members; `--print` shows the members, the pin, and the exempt declaration sites — see [ADR 0053](docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
- Tailwind themed-utility check: `yarn tailwind:classes:check` (compiles the real app stylesheet and fails any
  colour, spacing, or radius class that resolves to no CSS; `--print` lists what was scanned. Tailwind drops
  unresolvable class names silently, which is how the groceries pages shipped unstyled — see
  [ADR 0065](docs/adr/0065-tokens-json-is-the-single-source-of-web-colour.md)).
- Documented-command check: `yarn docs:commands:check` (asserts that a path named inside a fenced shell block in any tracked Markdown file exists; placeholders and git-ignored build outputs are skipped — see [ADR 0052](docs/adr/0052-a-built-explainer-page-is-its-own-source.md)).
- Mobile platform check: `yarn mobile-platform:check` (parses `apps/mobile` and `libs/mobile` source and fails a bare `react-native/…` subpath import — deprecated at 0.80 with removal planned, and never caught here because `@react-native/eslint-config` is not installed — or a browser global (`localStorage`, `sessionStorage`, `window`, `document`, `crypto.subtle`), which typechecks today because the base TypeScript config puts `dom` in `lib`; `--print` lists what was scanned. The subpath match excludes the separate `@react-native/*` scope and covers all four call forms — `from '...'`, `require('...')`, `require.resolve('...')`, and dynamic `import('...')`. Exemptions carry a written reason in `tools/config/mobile-platform-exemptions.json`; a stale entry fails the check.
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
- ADRs in `docs/adr/` are numbered sequentially from `0001`. Scan for the highest existing number before adding one, then name the file `NNNN-lowercase-hyphen-slug.md`. A number is a claim until it merges and a fact afterwards ([ADR 0042](docs/adr/0042-adr-numbers-are-claims-until-merged.md)): if another pull request merges your number first, renumber yours; never renumber a merged ADR — supersede it. Gaps are legal. `yarn adr:numbering:check` asserts unique numbers and filename shape; Husky and CI run it. **Status follows the same line as the number**: an ADR is `proposed` while its pull request is open and `accepted` once it merges, so flip it in the pull request that lands it. Four ADRs sat `proposed` on `main` for want of this sentence — the status is a claim about the decision exactly as the number is a claim about the slot.
- Code fanning out over a domain enum reaches one `as const satisfies Record<EnumType, …>` table; it does not re-enumerate the members in an object literal, an if-chain, or a list of `if` statements. Those shapes compile while handling some members and not others, which is how a keep-server reconcile destroyed grocery ciphertext and how hardened export silently dropped the Tasks blob. `yarn enum:fanout:check` enforces it for guarded enums ([ADR 0053](docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
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
- `claude/…`, `copilot/…` — generated by agent tooling. Leave them alone; don't rename to match.

A reserved-prefix branch carries no issue number in its name, so it carries the issue in its **first
commit** instead — a `Closes #<issue>` line, which `/code-review` reads through the commit step of
its spec discovery order ([ADR 0076](docs/adr/0076-an-agent-branch-carries-its-issue-in-its-first-commit.md)).
`yarn dispatch-agents` writes that commit itself when it creates a `feat/<prd-slug>` integration
branch. On a `claude/…` or `copilot/…` branch nothing writes it for you: **end your first commit's
body with `Closes #<issue>`** (or `Refs #<issue>` when the work should not close the issue). A pull
request body is **not** a spec source, so a branch that carries no reference anywhere reviews one
axis instead of two — do not leave one uncarried.

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
| Components in `libs/web-ui/` / `libs/web/pages/`          | `.agents/skills/component-builder/SKILL.md`                                                                     |
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
