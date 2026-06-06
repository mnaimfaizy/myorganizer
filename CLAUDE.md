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
