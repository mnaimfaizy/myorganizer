# Claude Code Workflows

Use the repo-local command files under `.claude/commands/` for commit and PR tasks.

- Commit requests should use `.claude/commands/commit.md`.
- PR requests should use `.claude/commands/create-pr.md`.
- Commit-message drafting still belongs to the existing `Commit` sub-agent; commit execution belongs to the shared `ai:commit` runner.
