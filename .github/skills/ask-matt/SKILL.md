---
name: ask-matt
description: Ask which MyOrganizer skill or workflow to run next. Use when the right path is unclear and you need a routing recommendation.
disable-model-invocation: true
---

# Ask Matt

Adapted from `mattpocock/skills`, adjusted to MyOrganizer's actual skill set and workflow conventions.

Use this as a **router** when you are unsure which workflow to run.

Always recommend a **gate tier** first (`gate:mechanical | standard | full` — ADR 0012 / `.claude/checklist.md` Step 0).

## Main MyOrganizer flow: idea -> implementation

1. **`/grill-with-docs`**  
   Start here to sharpen a feature/problem statement against domain language and existing decisions.

2. **If the idea needs runnable validation first**  
   Use **`/prototype`** for throwaway validation (logic or UI), optionally bridged across sessions using **`/handoff`**.

3. **Planned feature path (multi-slice work)**
   - `/to-prd` -> publish PRD issue
   - `/to-issues` -> split into slice issues (assign `gate:*` + `complexity:*`)
   - then run `yarn dispatch-agents --prd <issue-number>` for AFK slices

4. **Ad-hoc or single-shot implementation (ticket optional)**
   - Classify gate tier (no ticket required for mechanical/standard fixes).
   - If the user wants a tracked bug/enhancement issue: `/github-issue-creation-workflow`
   - If they want it built now: **`/implement`**, then domain skills as needed

## Quality and delivery routing

- Jest unit/integration tests → `/unit-test-delegation-workflow` (or mechanical direct edit per checklist)
- Playwright E2E work → `/playwright-e2e-workflow` (skip E2EPlanner for selector-only + unchanged matrix)
- Storybook story changes → `/storybook-delegation-workflow`
- Prisma/schema/migrations → `/prisma-migration-workflow`
- Release/deploy preparation → `/release-and-deploy-workflow`
- Architecture deepening pass → `/improve-codebase-architecture`
- Review branch or WIP changes → `/code-review` (optional for `gate:mechanical`)

## Session transitions

- Use **`/handoff`** when changing sessions or branching work into a fresh context.
- Keep one unbroken context for tightly coupled planning phases when possible (for example grilling -> PRD -> issue slicing), then split implementation into fresh sessions if needed.

## Rule of thumb

If the work is:

- **New planned feature** → `/to-prd`
- **Incoming raw request to track** → `/github-issue-creation-workflow`
- **Ad-hoc fix now, no ticket** → classify gate → `/implement`
- **Test-heavy behavioral change** → matching test workflow at `standard`/`full`
- **Architecture/terminology uncertainty** → `/grill-with-docs` (and `/domain-modeling` when updating glossary/ADRs)
