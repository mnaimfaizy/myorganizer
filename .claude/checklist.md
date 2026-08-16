# Task Classification & Delegation Checklist

**CRITICAL:** Use this checklist BEFORE making ANY file edits.

Policy: [`docs/adr/0012-tiered-quality-gates.md`](../docs/adr/0012-tiered-quality-gates.md)

---

## Step 0: Choose a gate tier

State the tier in your first reply (interactive) or follow the slice `gate:*` label (AFK). When unsure → **promote**. User may override.

| Tier              | Use when                                                                          | Execution                                                                           |
| ----------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `gate:mechanical` | All mechanical criteria below are true                                            | Main agent may edit directly; focused lint + focused tests/`tsc`                    |
| `gate:standard`   | Single-surface behavior change                                                    | One specialist hop for the artifact type (+ reviewer/runner as that skill requires) |
| `gate:full`       | New module, vault/crypto, API contract, multi-file product behavior, ambiguous UX | Full mandatory pipelines                                                            |

### Mechanical criteria (all must be true)

1. No new product behavior or public API contract.
2. Diff is localized (prefer ≤2 files; larger only if pure rename/delete).
3. Assertions/stories unchanged **or** only fixture/type retarget to an already-landed domain model.
4. Success is decidable by deterministic checks alone (`tsc` / `eslint` / focused jest).

If any fails → `gate:standard` or `gate:full`.

**Ticket optional:** Ad-hoc interactive work does not require a GitHub issue. Planned features still use `/to-prd` → `/to-issues`.

---

## Step 1: Pre-Action Decision Tree

### Q1: What file type am I modifying?

- **`*.spec.ts` (Playwright E2E)** → E2E section (tier applies)
- **`*.test.ts` / `*.spec.tsx` (Jest)** → Jest section (tier applies)
- **`*.stories.tsx`** → Storybook section (tier applies)
- **Component in `libs/web-ui/` or `libs/web/pages/`** → React Components section (tier applies)
- **Other files** → Step 2 / matrix

### Q2: Updating or creating?

- Mechanical retarget/rename/delete → may stay `gate:mechanical`
- New behavior, new assertions, new props contracts → at least `gate:standard`
- New UI primitive / multi-pipeline slice → `gate:full`

---

## Step 2: Red Flags — escalate the gate

These patterns usually mean **not** mechanical (promote unless Step 0 criteria still hold):

- New or changed product assertions / flows
- New Jest mocks that encode behavior
- Playwright page-object flow changes (not selector-only strings)
- UI behavior changes (styling, interactivity, props contracts)
- Vault/crypto, API contract, or OpenAPI surface changes

Config/docs/type-only edits with no behavior change may stay mechanical or direct-edit.

---

## Step 3: Task Classification Matrix (by gate)

| File Pattern                                  | `gate:mechanical`                                                                   | `gate:standard`                                                                    | `gate:full`                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Playwright `*.spec.ts`                        | Direct edit (selector/string only) + note; no E2EPlanner                            | TestScaffold + TestReviewer (structural); skip E2EPlanner if flow matrix unchanged | E2EPlanner → TestScaffold → TestReviewer (structural); never execute E2E in AFK      |
| Jest `*.test.ts` / page `*.spec.tsx`          | Direct edit (fixture/type retarget) + focused jest                                  | TestScaffold → TestReviewer → TestRunner                                           | Same full pipeline (max 3 retries)                                                   |
| `*.stories.tsx`                               | Direct edit only for rename/import path                                             | StorybookCurator                                                                   | StorybookCurator                                                                     |
| Components `libs/web-ui/` / `libs/web/pages/` | Direct edit only for rename/import/dead delete; run `yarn component:hygiene <path>` | ComponentBuilder → ComponentReviewer                                               | ComponentBuilder → ComponentReviewer (max 3 FAIL loops) + Storybook/tests after PASS |
| API Contract (controllers, DTOs, Prisma schema for a public HTTP surface) | Direct edit only for rename/import/comment | PrismaWriter (if schema) → ApiWriter → ApiSync (skip unused hops) | Same one-shot hops (ADR 0015). Then leave — Jest stays its Gated Pipeline |
| Config / docs / types                         | Direct edit OK                                                                      | Direct edit OK                                                                     | Direct edit OK                                                                       |

Skills:

- E2E: `.github/skills/playwright-e2e-workflow/SKILL.md`
- Jest: `.github/skills/unit-test-delegation-workflow/SKILL.md`
- Storybook: `.github/skills/storybook-delegation-workflow/SKILL.md`
- Components: `CLAUDE.md` → UI Component Workflows / `.claude/commands/component-builder.md`
- API Contract: `.github/skills/backend-api-contract-change/SKILL.md` (ADR 0015)

Deterministic component checks (any gate): `yarn component:hygiene <path>` — the shape rules from `docs/ui/GUIDELINES.md`. Targeted scans keep warnings advisory; CI and pre-commit enforce zero warnings with `--max-warnings=0` (ADR 0014).

---

## Step 4: Mandatory rules (tiered — not absolute)

1. **Behavioral / structural work** on tests, stories, or components **must** use the matching specialist path for that gate — do not “quietly” hand-edit to skip Reviewer on `standard`/`full`.
2. **Mechanical work** may be edited by the main agent; still run focused deterministic checks and state `gate:mechanical` explicitly.
3. **ComponentReviewer** and **TestReviewer** retries: max **3** cycles, then escalate to the main agent / human.
4. Specialist reports: `PASS|FAIL|ESCALATE` + ≤5 bullets unless `gate:full` after a rejection needs detail.
5. E2E chain when required: **E2EPlanner → TestScaffold → TestReviewer (structural only)**. Never execute Playwright autonomously in Sandcastle.

---

## Step 5: Anti-patterns

### ❌ Wrong (behavioral work)

```
"I see a behavior bug in an E2E test. I'll copy a sibling and patch it directly."
```

### ✅ Right (behavioral — `gate:standard` / `gate:full`)

```
1. Classify gate tier
2. Read .github/skills/playwright-e2e-workflow/SKILL.md
3. E2EPlanner if flow changed (skip only for selector-only + unchanged matrix)
4. TestScaffold → TestReviewer (structural)
```

### ❌ Wrong (mechanical work)

```
"This is a one-line fixture retarget — run TestScaffold → TestReviewer → TestRunner anyway."
```

### ✅ Right (mechanical)

```
1. State gate:mechanical
2. Edit directly
3. Run focused jest / tsc
4. Short summary (≤5 bullets)
```

---

## Step 6: Tool-Level Gatekeeping

**BEFORE** editing test/component/story files:

- If `gate:standard` or `gate:full` → delegate first (do not `StrReplace` / create those files in the main agent).
- If `gate:mechanical` → edit allowed; still run focused checks.
- 3+ consecutive reads for exploration → CodeExplorer.

---

## Quick Reference

| Scenario                                      | Gate                                  | Action                       |
| --------------------------------------------- | ------------------------------------- | ---------------------------- |
| Fixture/type retarget, rename, dead delete    | mechanical                            | Direct edit + focused checks |
| One assertion suite / one component props fix | standard                              | Matching specialist chain    |
| New UI module / vault / API contract          | full                                  | Full pipelines               |
| Selector-only E2E string, matrix unchanged    | mechanical or standard (skip planner) | See Playwright skill         |
| Explore for a pattern                         | —                                     | CodeExplorer                 |
| Config / docs                                 | —                                     | Direct edit OK               |

---

## How to Use

1. Step 0 — pick/state gate (or read `gate:*` label).
2. Step 1–3 — route by file type + gate.
3. If unsure — promote the gate.
4. Keep reports short.

---

## Reference Links

- ADR: `docs/adr/0012-tiered-quality-gates.md`
- E2E: `.github/skills/playwright-e2e-workflow/SKILL.md`
- Jest: `.github/skills/unit-test-delegation-workflow/SKILL.md`
- Storybook: `.github/skills/storybook-delegation-workflow/SKILL.md`
- Components: `CLAUDE.md` → UI Component Workflows
- Implement (ad-hoc): `.github/skills/implement/SKILL.md`
