# Create PR Command

Use this workflow when the user asks Claude Code to create a pull request for the current branch.

1. Confirm the current branch is not the base branch.
2. Call the `PrAuthor` sub-agent to draft the title and body from the branch diff and linked GitHub issues.
3. If `PrAuthor` returns `ON_BASE_BRANCH:` or `NO_BRANCH_COMMITS:`, stop and report that line.
4. Write the body (everything after the `TITLE:` line) to a temporary file.
5. Execute `corepack yarn ai:create-pr --title "<title>" --body-file <path>`.
6. If the user names reviewers, pass `--reviewer <login>` for each reviewer. If they asked for a draft, pass `--draft`.
7. Do not run `gh pr create` directly. Do not fall back to a title-only `yarn ai:create-pr` if `PrAuthor` failed.
8. Return the PR URL and the title on success.
