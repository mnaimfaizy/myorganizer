# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in **`mnaimfaizy/myorganizer`**. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --repo mnaimfaizy/myorganizer --comments`
- **List issues**: `gh issue list --repo mnaimfaizy/myorganizer --state open --json number,title,body,labels,comments`
- **Comment on an issue**: `gh issue comment <number> --repo mnaimfaizy/myorganizer --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --repo mnaimfaizy/myorganizer --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --repo mnaimfaizy/myorganizer --comment "..."`

`gh` infers the repo from `git remote` when run inside a clone, but prefer `--repo mnaimfaizy/myorganizer` when scripting.

## Pull requests as a triage surface

**PRs as a request surface: no.**

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `mnaimfaizy/myorganizer`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --repo mnaimfaizy/myorganizer --comments`.

For PRD issues, also read labels — PRDs are tagged `prd`.

## PRD and slice issues

- PRD issues are labelled `prd` and often `ready-for-agent`.
- Slice issues start with `PRD: #<N>` in the body and carry the full slice label set from `.github/skills/to-issues/SKILL.md`.
