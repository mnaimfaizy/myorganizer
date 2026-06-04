# Claude Code Workflows

Use the repo-local command files under `.claude/commands/` for commit, PR, test, and Storybook tasks.

- Commit requests should use `.claude/commands/commit.md`.
- PR requests should use `.claude/commands/create-pr.md`.
- Unit test creation or updates should use `.claude/commands/unit-test.md`.
- Storybook creation or updates should use `.claude/commands/storybook.md`.
- Commit-message drafting still belongs to the existing `Commit` sub-agent; commit execution belongs to the shared `ai:commit` runner.
- Unit test implementation is delegated to the `TestScaffold` sub-agent (`.github/agents/test-scaffold.agent.md`); consult `docs/testing/README.md` for per-project tooling and mock patterns.
- Storybook implementation is delegated to the `StorybookCurator` sub-agent (`.claude/agents/storybook-curator.md`); require requirement-readiness analysis before edits and route clarification questions to the human-in-the-loop.
