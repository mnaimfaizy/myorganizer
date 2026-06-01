---
name: commit-change-workflow
description: 'Use when the user asks to commit changes, make a commit, git commit the current work, commit this branch, or save the current staged work as a commit in MyOrganizer. Use the existing Commit sub-agent to draft the message, then execute the commit through the shared workflow so Husky is allowed to finish.'
---

# Commit Change Workflow

## Use This Skill When

- The user asks you to commit the current work.
- The user asks for `git commit`, a Conventional Commit, or to save the staged changes.
- The user wants the agent to finish the commit, not only to draft the message.

## Core Rules

- Use the existing `Commit` sub-agent to draft the Conventional Commit message. Do not invent a message without checking the actual diff.
- Treat the `Commit` sub-agent as read-only. It drafts the message only.
- Execute the actual commit through `corepack yarn ai:commit`.
- Wait for the `git commit` process to return. Do not cancel it, detach it, move on, or start other work while Husky pre-commit checks are still running.
- Do not auto-stage unrelated files. If nothing is staged, stop and ask the user whether the intended files should be staged first.
- If Husky fails, fix the reported formatting, linting, typecheck, test, or other validation issue before retrying the commit.
- After fixing a Husky failure, rerun the narrowest relevant validation for the touched slice before re-running `corepack yarn ai:commit`.

## Workflow

1. Inspect the current git state and confirm which files are staged.
2. Call the `Commit` sub-agent to draft the Conventional Commit message from the staged diff.
3. Write the drafted message to a temporary file or pipe it over stdin.
4. Run one of these commands:

```sh
corepack yarn ai:commit --message-file <path-to-message-file>
```

or

```sh
printf '%s\n' '<commit-message>' | corepack yarn ai:commit
```

5. Wait for completion.
6. If the commit fails because Husky fails:
   - read the actual error output
   - fix the reported issue
   - rerun the narrowest relevant validation
   - rerun `corepack yarn ai:commit`
7. Report the final commit result concisely.

## Validation

- Prefer the exact failing check reported by Husky.
- If Husky reports lint issues, rerun the relevant lint target or affected lint command.
- If Husky reports formatting issues, rerun the narrowest formatter or repo formatter that matches the touched files.
- Only retry the commit after the focused validation passes.

## References

- `.github/agents/commit.agent.md` — message generation only
- `tools/scripts/ai/commit-change.mjs` — shared commit runner
- `.husky/pre-commit` — commit-time formatting and lint checks
- `AGENTS.md` — repo-wide workflow routing
