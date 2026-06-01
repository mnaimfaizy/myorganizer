# Gemini Workflows

Use these repo-local workflows for commit and pull request tasks.

## Commit Changes

- Draft the Conventional Commit message with the existing `Commit` sub-agent or equivalent diff-based commit-message generator.
- Execute the commit with `corepack yarn ai:commit`.
- Wait for the commit process to finish; do not cancel the command while Husky is running.
- If Husky fails, fix the reported issue, rerun the narrow validation, and retry the commit.

## Create Pull Request

- Build the PR title and description from the current branch commits.
- Execute `corepack yarn ai:create-pr`.
- Push upstream if needed.
- Assign the authenticated GitHub user.
- Leave reviewers empty unless the user explicitly supplies them with `--reviewer <login>`.
- Return only the PR URL on success.
