# Create PR Command

Use this workflow when the user asks Claude Code to create a pull request for the current branch.

1. Gather the branch commits relative to the base branch.
2. Execute `corepack yarn ai:create-pr`.
3. If the user names reviewers, pass `--reviewer <login>` for each reviewer.
4. Push the branch upstream if needed, assign the authenticated GitHub user, and leave reviewers empty when none are specified.
5. Return only the PR URL on success.
