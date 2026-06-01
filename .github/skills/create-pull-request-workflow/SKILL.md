---
name: create-pull-request-workflow
description: 'Use when the user asks to create a pull request, open a PR, raise a PR for the current branch, publish this branch as a PR, or submit the current branch for review in MyOrganizer. Gather commit history from the branch, ensure upstream push, assign the authenticated GitHub user, and keep reviewers empty unless the user explicitly names one.'
---

# Create Pull Request Workflow

## Use This Skill When

- The user asks to create, open, or publish a pull request.
- The user wants a PR for the current branch.
- The user asks to assign reviewers or create a PR from the current work.

## Core Rules

- Base the PR title and description on the commits in the current branch relative to the base branch, not on the unstaged working tree.
- Use the shared workflow command `corepack yarn ai:create-pr`.
- Push the branch upstream if it is not already tracked.
- Assign the PR to the authenticated GitHub user.
- If the user does not specify reviewers, leave the reviewer list empty.
- If the user specifies one or more reviewers, pass them explicitly with `--reviewer`.
- If an open PR already exists for the current branch, reuse it and return the existing PR URL.
- Keep the final user-facing output terse: success plus the PR link.

## Workflow

1. Confirm the current branch is not the base branch.
2. Gather the branch commit history relative to the default base branch.
3. Draft or refine the PR title and description from those commits when needed.
4. Run:

```sh
corepack yarn ai:create-pr
```

5. If reviewers were specified, run:

```sh
corepack yarn ai:create-pr --reviewer <login>
```

Repeat `--reviewer` for multiple reviewers.

6. Return only the success status and the PR URL.

## Validation

- Confirm the branch has commits relative to the base branch.
- Confirm the PR command succeeded and returned a URL.
- If the command reports authentication or push failures, fix that blocker before claiming the PR is created.

## References

- `tools/scripts/ai/create-pr.mjs` — shared PR runner
- `DEVELOPMENT.md` — human-facing PR workflow
- `AGENTS.md` — repo-wide workflow routing
