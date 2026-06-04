# Storybook Delegation Command

Use this workflow when Claude Code is asked to create or update Storybook stories for UI components.

1. Do **not** edit `*.stories.tsx` in the main context.
2. Delegate implementation to the `StorybookCurator` sub-agent (`.claude/agents/storybook-curator.md`).
3. Provide a complete brief:
   - requirement summary
   - component file path(s)
   - target story file path(s)
   - expected states/variants and any references
4. Require the sub-agent to run requirement-readiness analysis before editing.
5. If the sub-agent returns clarifications or rejects weak requirements, route those details back to the human-in-the-loop.
6. Accept only when the story set is UX/a11y-aware and covers meaningful scenarios.
