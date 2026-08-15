# Implement Command

Use this workflow when the user wants to implement agreed work from a spec, PRD, slice issue, ticket set, **or ad-hoc request** in the current session.

1. Read and follow `.github/skills/implement/SKILL.md` exactly.
2. **Classify and state the gate tier** (`gate:mechanical | standard | full` — ADR 0012 / `.claude/checklist.md` Step 0). Ticket optional for ad-hoc work.
3. Confirm the spec source and read `AGENTS.md` for touched areas.
4. If targeting a GitHub issue: check `## Blocked by` / `## Blocks`; after completion run the unblock protocol in the skill.
5. Use `/tdd` at pre-agreed test seams when appropriate; otherwise work in small vertical slices.
6. Route Jest / Playwright / Storybook / components by **gate + file type** (not absolute always-delegate).
7. Run focused `yarn nx lint` / tests while iterating; full relevant suite at the end.
8. `/code-review` for `gate:full` (and large `standard`); skip for mechanical unless asked.
9. Commit or open a PR only when the user explicitly asks (`/commit`, `/create-pr`).
