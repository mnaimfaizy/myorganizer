# Component Builder Command

Use this when creating or editing React components in `libs/web-ui/` or `libs/web/pages/`.

1. Classify gate tier via `.claude/checklist.md` Step 0 (`docs/adr/0012-tiered-quality-gates.md`).
2. For `gate:mechanical` (rename / import path / dead delete only): main agent may edit + focused lint; skip Builder/Reviewer.
3. For `gate:standard` or `gate:full`:
   - Build a **Structured Spec** (see `AGENTS.md` → UI Component Workflows).
   - Delegate to `ComponentBuilder` (`.claude/agents/component-builder.md`).
   - Always run `ComponentReviewer` after Builder (`.claude/agents/component-reviewer.md`).
   - On `FAIL`: max **3** Builder↔Reviewer cycles, then escalate.
4. After `PASS` / `PASS_WITH_WARNINGS` on `gate:full` (and when needed on `standard`): Storybook via `.agents/skills/storybook-delegation-workflow/SKILL.md`, tests via `.agents/skills/unit-test-delegation-workflow/SKILL.md`.

Do not invent conventions — enforce `docs/ui/GUIDELINES.md`. `TECH_STACK.md` is a version table, not a component briefing.
