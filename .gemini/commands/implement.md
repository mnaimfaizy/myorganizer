# Implement Command

Use this workflow when the user wants to implement agreed work from a spec, PRD, slice issue, or ticket set in the current session.

1. Read and follow `.github/skills/implement/SKILL.md` exactly.
2. Confirm the spec source and read `AGENTS.md` for touched areas.
3. Use `/tdd` at pre-agreed test seams; otherwise work in small vertical slices.
4. Route Jest tests, Playwright specs, Storybook, and React components through their mandatory delegation workflows.
5. Run `yarn nx lint` / `yarn nx test` on affected projects while iterating; run the full relevant suite at the end.
6. Review the diff with `/code-review` before finishing.
7. Commit or open a PR only when the user explicitly asks.
