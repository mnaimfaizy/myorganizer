# Commit Command

Use this workflow when the user asks Claude Code to commit the current staged changes.

1. Draft the Conventional Commit message with the existing `Commit` sub-agent.
2. Execute the commit with `corepack yarn ai:commit`.
3. Wait for `git commit` to finish. Do not cancel the command while Husky pre-commit checks are running.
4. If Husky fails, fix the reported issue, rerun the narrow validation, and retry the commit.
5. Keep the final response concise.
