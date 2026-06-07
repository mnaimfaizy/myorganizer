# Claude Code Workflows

Use the repo-local command files under `.claude/commands/` for commit, PR, test, and Storybook tasks.

- Commit requests should use `.claude/commands/commit.md`.
- PR requests should use `.claude/commands/create-pr.md`.
- Jest unit or integration test creation/updates should use `.claude/commands/unit-test.md`.
- Storybook creation or updates should use `.claude/commands/storybook.md`.
- Playwright E2E creation/updates should follow `.github/skills/playwright-e2e-workflow/SKILL.md`.
- Commit-message drafting still belongs to the existing `Commit` sub-agent; commit execution belongs to the shared `ai:commit` runner.
- Jest test implementation is delegated to the `TestScaffold` sub-agent (`.github/agents/test-scaffold.agent.md` and `.claude/agents/test-scaffold.md`). Always provide a behavior matrix from the actual implementation, including unsupported scenarios to avoid. Consult `docs/testing/README.md` for per-project tooling, integration scope, mock patterns, and validation checks.
- Storybook implementation is delegated to the `StorybookCurator` sub-agent (`.claude/agents/storybook-curator.md`); require requirement-readiness analysis before edits and route clarification questions to the human-in-the-loop.
- React component creation or editing (UI Primitives in `libs/web-ui/` or Feature Components in `libs/web/pages/<route>/`) must use the ComponentBuilder → ComponentReviewer workflow — see **UI Component Workflows** below.
- After any `yarn add`, `yarn remove`, or package upgrade, run `/dep-sync` to keep `TECH_STACK.md` current — see **Dependency Sync** below.

## ⚠️ Mandatory Delegation Rules (NO EXCEPTIONS)

**ALWAYS delegate tasks for these file types.** Do NOT skip delegation even if the change seems small or obvious.

| File Pattern                    | Skill                                                   | Agent Flow                           | Rule                   |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------ | ---------------------- |
| `*.spec.ts` (Playwright E2E)    | `.github/skills/playwright-e2e-workflow/SKILL.md`       | E2EPlanner → TestScaffold            | ✅ **Always delegate** |
| `*.test.ts` (Jest tests)        | `.github/skills/unit-test-delegation-workflow/SKILL.md` | TestScaffold                         | ✅ **Always delegate** |
| `*.stories.tsx` (Storybook)     | `.github/skills/storybook-delegation-workflow/SKILL.md` | StorybookCurator                     | ✅ **Always delegate** |
| Components in `libs/web-ui/`    | Component workflow (below)                              | ComponentBuilder → ComponentReviewer | ✅ **Always delegate** |
| Components in `libs/web/pages/` | Component workflow (below)                              | ComponentBuilder → ComponentReviewer | ✅ **Always delegate** |

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

## Codebase Exploration

Before issuing 3 or more consecutive Glob/Grep/Read calls to locate something in the codebase, stop and delegate to the `CodeExplorer` sub-agent (`.claude/agents/explore.md`) instead. Provide an Explore Request with a `Goal` sentence; optionally include `Known Locations`, `Search Hints`, `Out of Scope`, and `Expected Output`. CodeExplorer runs on Haiku and returns a structured Explore Summary with `[found]`/`[inferred]` tagged findings and ranked file paths — saving frontier-model tokens for reasoning, not searching.

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
