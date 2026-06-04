# Claude Code Workflows

Use the repo-local command files under `.claude/commands/` for commit, PR, and test tasks.

- Commit requests should use `.claude/commands/commit.md`.
- PR requests should use `.claude/commands/create-pr.md`.
- Jest unit or integration test creation/updates should use `.claude/commands/unit-test.md`.
- Playwright E2E creation/updates should follow `.github/skills/playwright-e2e-workflow/SKILL.md`.
- Commit-message drafting still belongs to the existing `Commit` sub-agent; commit execution belongs to the shared `ai:commit` runner.
- Jest test implementation is delegated to the `TestScaffold` sub-agent (`.github/agents/test-scaffold.agent.md` and `.claude/agents/test-scaffold.md`). Always provide a behavior matrix from the actual implementation, including unsupported scenarios to avoid. Consult `docs/testing/README.md` for per-project tooling, integration scope, mock patterns, and validation checks.
