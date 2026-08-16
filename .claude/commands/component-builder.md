# Component Builder Command

Use this when creating or editing React components in `libs/web-ui/` or `libs/web/pages/`.

1. Classify gate tier via `.claude/checklist.md` Step 0 (`docs/adr/0012-tiered-quality-gates.md`).
2. For `gate:mechanical` (rename / import path / dead delete only): main agent may edit + focused lint; skip Builder/Reviewer.
3. For `gate:standard` or `gate:full`:
   - Build a **Structured Spec** (see `CLAUDE.md` → UI Component Workflows).
   - Delegate to `ComponentBuilder` (`.claude/agents/component-builder.md`).
   - Always run `ComponentReviewer` after Builder (`.claude/agents/component-reviewer.md`).
   - On `FAIL`: max **2** Builder↔Reviewer cycles, then escalate (ADR 0017). File a Pipeline Incident when the cap is hit, the FAIL repeats, or a sibling already solved it.
4. After `PASS` / `PASS_WITH_WARNINGS` on `gate:full` (and when needed on `standard`): Storybook via `/storybook`, tests via `/unit-test`.

Do not invent conventions — enforce `docs/ui/GUIDELINES.md` and `TECH_STACK.md`.
