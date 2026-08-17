# Commit Command

Use this workflow when the user asks Claude Code to commit the current staged changes.

1. Inspect `git status`. Never `git add .`. If nothing is staged, or the tree is mixed, list files and ask before staging. Do not stage secret-looking files.
2. Draft the Conventional Commit message with the existing `Commit` sub-agent (staged diff only). If it recommends splitting commits, ask which group to commit first.
3. Write the message to a temp file and execute `corepack yarn ai:commit --message-file <path>`. Do not run `git commit` directly.
4. Wait for the command to finish. Do not cancel it while Husky pre-commit checks are running.
5. If it fails, read the `ai:commit: failed` trailer, fix the reported slice, rerun the hinted check, and retry.
6. Keep the final response concise.

Canonical skill: `.agents/skills/commit-change-workflow/SKILL.md`
