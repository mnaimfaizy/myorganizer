# Claude Code Workflows

Use the repo-local command files under `.claude/commands/` for commit, PR, test, and Storybook tasks.

- Commit requests should use `.claude/commands/commit.md`.
- PR requests should use `.claude/commands/create-pr.md`.
- Jest unit or integration test creation/updates should use `.claude/commands/unit-test.md`.
- For implementing agreed work from a spec, PRD, or tickets in the current session, use `.claude/commands/implement.md` (`.github/skills/implement/SKILL.md`).
- For reviewing branch or WIP changes against repo standards and the originating spec, use `.claude/commands/code-review.md` (`.github/skills/code-review/SKILL.md`).
- For building features or fixing bugs test-first (red-green-refactor), use `.claude/commands/tdd.md` (`.github/skills/tdd/SKILL.md`). Plan the behavior list with the user before writing any code, work in vertical tracer-bullet slices (one test → one implementation → repeat), and consult `.github/skills/codebase-design/SKILL.md` for deep-module vocabulary during the refactor step.
- Storybook creation or updates should use `.claude/commands/storybook.md`.
- Playwright E2E creation/updates should follow `.github/skills/playwright-e2e-workflow/SKILL.md`.
- Issue/PR triage requests should use `.claude/commands/triage.md` (`.github/skills/triage/SKILL.md`).
- Commit-message drafting still belongs to the existing `Commit` sub-agent; commit execution belongs to the shared `ai:commit` runner.
- Jest test implementation uses a three-stage pipeline: `TestScaffold` (writes tests) → `TestReviewer` (static gate: checklist, tsc, eslint) → `TestRunner` (execution with hang detection). Always provide a behavior matrix from the actual implementation, including unsupported scenarios to avoid. Consult `docs/testing/README.md` for per-project tooling, integration scope, mock patterns, and validation checks. Max 3 retries before escalating to the main agent.
- Storybook implementation is delegated to the `StorybookCurator` sub-agent (`.claude/agents/storybook-curator.md`); require requirement-readiness analysis before edits and route clarification questions to the human-in-the-loop.
- React component creation or editing (UI Primitives in `libs/web-ui/` or Feature Components in `libs/web/pages/<route>/`) must use the ComponentBuilder → ComponentReviewer workflow — see **UI Component Workflows** below.
- After any `yarn add`, `yarn remove`, or package upgrade, run `/dep-sync` to keep `TECH_STACK.md` current — see **Dependency Sync** below.
- After any sub-agent change in any harness (`.github`, `.claude`, `.cursor`, `.gemini`), run `yarn agents:sync` and then `yarn agents:sync:check`.
- Use `.github/skills/sub-agent-sync-workflow/SKILL.md` as the required workflow for sub-agent synchronization.

## ⚠️ Mandatory Delegation Rules (NO EXCEPTIONS)

**ALWAYS delegate tasks for these file types.** Do NOT skip delegation even if the change seems small or obvious.

| File Pattern                    | Skill                                                   | Agent Flow                                                                             | Rule                                     |
| ------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| `*.spec.ts` (Playwright E2E)    | `.github/skills/playwright-e2e-workflow/SKILL.md`       | E2EPlanner → TestScaffold → TestReviewer (structural only; never execute autonomously) | ✅ **Always delegate**                   |
| `*.test.ts` (Jest tests)        | `.github/skills/unit-test-delegation-workflow/SKILL.md` | TestScaffold → TestReviewer → TestRunner                                               | ✅ **Always delegate**                   |
| `*.stories.tsx` (Storybook)     | `.github/skills/storybook-delegation-workflow/SKILL.md` | StorybookCurator                                                                       | ✅ **Always delegate**                   |
| Components in `libs/web-ui/`    | Component workflow (below)                              | ComponentBuilder → ComponentReviewer                                                   | ✅ **Always delegate**                   |
| Components in `libs/web/pages/` | Component workflow (below)                              | ComponentBuilder → ComponentReviewer                                                   | ✅ **Always delegate**                   |
| New planned feature (PRD)       | `.github/skills/to-prd/SKILL.md`                        | to-prd                                                                                 | ✅ **Always use for planned features**   |
| Slice breakdown from PRD        | `.github/skills/to-issues/SKILL.md`                     | to-issues                                                                              | ✅ **Always use after PRD is published** |

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

Use the decision tree in **`.claude/checklist.md`** to verify you're not skipping delegation.

## UI Component Workflows

When creating or editing any React component in `libs/web-ui/` (UI Primitives) or `libs/web/pages/<route>/` (Feature Components), follow this chain exactly:

### Step 1 — Build a Structured Spec

Before delegating, construct the following spec from the user's request and the surrounding codebase context:

```
## Structured Spec

### Component Name
<PascalCase name>

### Target Path
<exact relative path — ComponentBuilder infers scope from this>

### Action
create | edit

### Scope
UI Primitive | Feature Component
(omit to let ComponentBuilder infer from the target path)

### Props Interface
<TypeScript interface or prose description of props>

### State Ownership
<local useState / React Hook Form / custom hook / server>

### Zod Schema
<schema definition, or "none">

### Composition
<list of sub-components if compound, or "single component">

### Guidelines to Enforce
all

### Additional Context
<anything ComponentBuilder needs to know>
```

### Step 2 — Delegate to ComponentBuilder

Pass the Structured Spec to the `ComponentBuilder` sub-agent (`.claude/agents/component-builder.md`). Wait for the **ComponentBuilder Report** before proceeding.

### Step 3 — Delegate to ComponentReviewer (always — no exceptions)

Pass the ComponentBuilder Report to the `ComponentReviewer` sub-agent (`.claude/agents/component-reviewer.md`). Do NOT skip this step, even for small edits.

### Step 4 — Handle the Verdict

- **`PASS`** — accept the component; note any warnings to the user.
- **`PASS_WITH_WARNINGS`** — accept the component; surface the warnings to the user for awareness.
- **`FAIL`** — relay the `Required Revisions` section back to ComponentBuilder and repeat from Step 2 until the verdict is `PASS` or `PASS_WITH_WARNINGS`.

### Step 5 — Storybook and Tests (after review passes)

- New UI Primitives always need a Storybook story → use `.claude/commands/storybook.md`.
- Any component with testable behaviour → use `.claude/commands/unit-test.md`.

### Key Rules

- Do NOT write component code directly in the main agent context. Always delegate to ComponentBuilder.
- ComponentBuilder does not write stories or tests — those go to StorybookCurator and TestScaffold after the review passes.
- Do NOT invent component conventions. ComponentBuilder and ComponentReviewer enforce `docs/ui/GUIDELINES.md` — read it if you need to understand the rules.
- If the Structured Spec is incomplete (missing `Target Path` or `Props Interface`), gather the missing information from the user before delegating.

---

## Dependency Sync

When `package.json` changes (a Claude Code hook will fire automatically after `yarn add/remove/up/upgrade` or `npm install/uninstall/update` Bash commands):

1. Run `/dep-sync` to synchronise `TECH_STACK.md` and the authoritative files.
2. DepSync proposes changes — confirm before it writes anything.
3. If a new package appears unused in source files, DepSync flags it as potentially temporary — decide whether to document it as canonical or hold off.

Full workflow: `.github/skills/dep-sync/SKILL.md`
ADR: `docs/adr/0001-tech-stack-single-source-of-truth.md`

---

## Sub-Agent Sync

When any sub-agent file changes, keep all harnesses synchronized with `.github/agents` as canonical source:

1. Run `yarn agents:sync`.
2. Run `yarn agents:sync:check` and require exit code 0.
3. Confirm `.cursor/agents/explore.md` remains `model: composer`.

References:

- Workflow skill: `.github/skills/sub-agent-sync-workflow/SKILL.md`
- Automation script: `tools/scripts/sync-subagents.mjs`
- Cursor rule: `.cursor/rules/sub-agent-sync-workflow.mdc`
- Gemini command: `.gemini/commands/sync-subagents.md`

---

## Codebase Exploration

Before issuing 3 or more consecutive Glob/Grep/Read calls to locate something in the codebase, stop and delegate to the `CodeExplorer` sub-agent (`.claude/agents/explore.md`) instead. Provide an Explore Request with a `Goal` sentence; optionally include `Known Locations`, `Search Hints`, `Out of Scope`, and `Expected Output`. CodeExplorer runs on Haiku and returns a structured Explore Summary with `[found]`/`[inferred]` tagged findings and ranked file paths — saving frontier-model tokens for reasoning, not searching.

## Planned Feature Workflow

Use this workflow when building a new feature end-to-end, from idea to autonomous agent handoff. The user must be present for Steps 1 and 2; Step 3 is the walk-away handoff point.

### Step 1 — Write the PRD (user present)

```
/to-prd
```

Explores the codebase, sketches test seams (requires your approval), writes the PRD, and publishes it as a GitHub Issue labelled `prd` + `ready-for-agent`.

**Prerequisite:** Run `yarn ai:create-labels` once to create all required labels in the repo.

### Step 2 — Break into Slice Issues (user present)

```
/to-issues <prd-issue-number>
```

Fetches the PRD, drafts vertical slices (AFK / HITL + complexity), quizzes you on the breakdown, then publishes each slice with the full label set. Updates the PRD `## Slices` section.

⚠️ **HITL slices** will be skipped by `dispatch-agents` until you unblock them manually.

### Step 3 — Dispatch autonomous agents (walk away)

```
yarn dispatch-agents --prd <prd-issue-number>
```

The orchestrator (integration is **local-only** — see `docs/adr/0010`):

1. Creates `feat/<feature-slug>` from `origin/main` **locally and never pushes it** (if it doesn't exist)
2. Runs one sandcastle agent per AFK slice **one at a time** in Docker isolation, each slice branched from the _current_ local feature head (so a slice sees earlier slices' work)
3. Routes the model from the `complexity:*` label (Haiku → Sonnet → Opus)
4. Per slice: runs a Docker lint gate, then **fast-forwards the slice into the local feature branch** (no per-slice push, no per-slice PR); applies `status:done`, **closes the slice issue** (reason: completed), and posts a comment on it
5. Sends a desktop notification when the full batch is done

GitHub is touched only to **read** issues and **write** status labels + a completion comment. Nothing is pushed to origin.

### Step 4 — Review and merge (user returns)

QA the local `feat/<slug>` branch — it now contains every integrated slice. When satisfied, push it and open **one** PR from `feat/<slug>` to `main`; CI runs there, then merge it on GitHub. There are no per-slice PRs.

### Key distinctions

- **Planned feature** → always start with `/to-prd` + `/to-issues`
- **Ad-hoc bug or one-off task** → use the `github-issue-creation-workflow` skill directly (no PRD needed)

---

## Design & Planning Workflows

When you need to stress-test a plan against the project's domain model and documented decisions, use the **grill-with-docs** skill:

- **Skill location**: `.github/skills/grill-with-docs/SKILL.md`
- **When to use**: You have a design or feature plan that needs validation against MyOrganizer's terminology, architecture, and existing decisions.
- **What it does**:
  - Interviews relentlessly to sharpen fuzzy requirements and terminology
  - Challenges plans against the domain glossary in `CONTEXT.md`
  - Cross-references claims with actual codebase implementation
  - Creates or updates `CONTEXT.md` to document domain language
  - Proposes Architecture Decision Records (ADRs) for hard-to-reverse decisions
- **Key documents to maintain**:
  - `CONTEXT.md` — Domain language glossary (one-sentence definitions, preferred terms, what to avoid)
  - `docs/adr/` — Architecture Decision Records for major design choices
- **Reference formats**: See `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` in the skill directory

When you need to **actively build or update** the domain model (adding new terms to `CONTEXT.md`, recording a new ADR, resolving conflicting terminology, cross-referencing a stated assumption with code), use the **domain-modeling** skill:

- **Claude command**: `/domain-modeling` (`.claude/commands/domain-modeling.md`)
- **Skill location**: `.github/skills/domain-modeling/SKILL.md`
- **When to use**: You are _changing_ the domain model, not just reading it. Invoked inline by `improve-codebase-architecture` and `grill-with-docs` when new terms crystallise.
- **What it does**:
  - Challenges glossary conflicts immediately
  - Sharpens vague/overloaded terms into precise canonical definitions
  - Stress-tests domain boundaries with concrete edge-case scenarios
  - Cross-references stated assumptions against the actual codebase
  - Updates `CONTEXT.md` inline (format: `CONTEXT-FORMAT.md`) — never batched
  - Offers ADRs sparingly using the three-condition gate (format: `ADR-FORMAT.md`)

When you need to find shallow modules, seam leaks, or testability gaps before planning a refactor, use the **improve-codebase-architecture** skill:

- **Claude command**: `/improve-architecture` (`.claude/commands/improve-architecture.md`)
- **Skill location**: `.github/skills/improve-codebase-architecture/SKILL.md`
- **Depends on**: `.github/skills/codebase-design/SKILL.md` — the skill loads this automatically for vocabulary and principles. Companion files: `DEEPENING.md` (dependency categories and seam discipline) and `DESIGN-IT-TWICE.md` (parallel interface exploration).
- **When to use**: You want a structured architectural review — before committing to any specific refactor.
- **What it does**:
  - Reads `codebase-design/SKILL.md` for the shared vocabulary, `DEEPENING.md` to classify each candidate's dependencies
  - Delegates a codebase walk to `CodeExplorer` using the deletion test and depth/seam heuristics
  - Generates a self-contained HTML report in the OS temp dir with before/after diagrams per candidate
  - Opens a grilling loop with `grill-with-docs`; when new domain terms or ADRs crystallise, delegates to `domain-modeling`
  - If alternative interfaces are needed, uses `DESIGN-IT-TWICE.md`
- **Vocabulary to enforce**: module, interface, depth, seam, adapter, leverage, locality — never component, service, boundary.
