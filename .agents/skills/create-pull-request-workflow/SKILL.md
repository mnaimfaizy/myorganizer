---
name: create-pull-request-workflow
description: 'Use when the user asks to create a pull request, open a PR, raise a PR for the current branch, publish this branch as a PR, or submit the current branch for review in MyOrganizer. Delegate title and body to the PrAuthor sub-agent, then run the shared ai:create-pr runner with --title and --body-file. Push upstream, assign the authenticated GitHub user, and keep reviewers empty unless the user explicitly names one.'
---

# Create Pull Request Workflow

## Use This Skill When

- The user asks to create, open, or publish a pull request.
- The user wants a PR for the current branch.
- The user asks to assign reviewers or create a PR from the current work.

## Ownership

| Step                                             | Owner                            |
| ------------------------------------------------ | -------------------------------- |
| Confirm the branch is not the base branch        | Main agent                       |
| Draft the PR title and body from git + issues    | `PrAuthor` sub-agent (read-only) |
| Write the body to a temp file and run the runner | Main agent                       |
| Push, assign, create or reuse the GitHub PR      | `corepack yarn ai:create-pr`     |

The `PrAuthor` sub-agent must stay read-only. Do not ask it to push, create the PR, or edit files.

Humans (or CI) may still run `yarn ai:create-pr` with no `--title` / `--body-file`; the script then uses its thin commit-subject fallback. **Agent sessions must not take that path.** If `PrAuthor` fails, stop and report; do not create a subject-only PR.

## Core Rules

- Base the PR title and description on the branch commits, the merge-base diff, and linked GitHub issues — not on the unstaged working tree and not on chat speculation.
- Do not run `gh pr create` or `git push` directly. The only PR entry point is `corepack yarn ai:create-pr`.
- Always pass `--title` and `--body-file` from the `PrAuthor` draft.
- Push the branch upstream if it is not already tracked (the runner does this).
- Assign the PR to the authenticated GitHub user (the runner does this).
- If the user does not specify reviewers, leave the reviewer list empty.
- If the user specifies one or more reviewers, pass them explicitly with `--reviewer`.
- If an open PR already exists for the current branch, the runner reuses it and overwrites title and body so the description tracks the latest commits.
- Keep the final user-facing output terse: success, the title, and the PR URL. Do not dump the full body.

## Workflow

1. Confirm the current branch is not the base branch (`main` / default). If it is, stop.
2. Call the `PrAuthor` sub-agent to draft the title and body from `merge-base..HEAD` plus linked issues (`#N` in commits and `issue/N-…` / `feat/N-…` branch names).
3. If `PrAuthor` returns `ON_BASE_BRANCH:` or `NO_BRANCH_COMMITS:`, stop and report that line. Do not run `ai:create-pr`.
4. Parse the draft: the first line is `TITLE: <text>`; the rest (from the first `##` heading) is the body. Write the body to a temporary file.
5. Run:

```sh
corepack yarn ai:create-pr --title "<title>" --body-file <path-to-body-file>
```

6. If reviewers were specified, add `--reviewer <login>` for each one (repeat the flag). If the user asked for a draft PR, add `--draft`.
7. Return the PR URL and the title.

## Validation

- Confirm the branch has commits relative to the base branch (or trust `PrAuthor`'s `NO_BRANCH_COMMITS` result).
- Confirm `PrAuthor` returned a `TITLE:` line and a Markdown body.
- Confirm the PR command succeeded and returned a URL.
- If the command reports authentication or push failures, fix that blocker before claiming the PR is created.

## References

- `.github/agents/pr-author.agent.md` — title and body generation only
- `tools/scripts/ai/create-pr.mjs` — shared PR runner (push, assign, create/reuse)
- `DEVELOPMENT.md` — human-facing PR workflow
- `AGENTS.md` — repo-wide workflow routing
