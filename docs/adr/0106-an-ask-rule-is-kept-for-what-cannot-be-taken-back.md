# An ask rule is kept for what cannot be taken back

The `ask` list in `.claude/settings.json` names only commands that rewrite
history, reach the remote, publish, merge, or release. Every other command is
left to the permission mode. The list used to also hold `find`, `sed`, `awk`,
`xargs`, `node -e`, `curl`, `wget`, dependency changes, `git tag`, issue and
label writes, and dev-server launches. In a mode that already asks, those rules
added nothing. In auto mode they overrode the classifier, and cloud sessions
paid for them on nearly every turn.

## Status

accepted

## Context

An `ask` rule prompts in every permission mode, auto included, and it outranks
both allow rules and a PreToolUse hook's `allow`. That is what an `ask` rule is
for: "a human looks at this one, whatever else is configured." The same
property makes it expensive. A cloud session reads only this committed file,
so every `ask` entry is a browser round trip there. ADR 0099 records the
headless version of the same cost: the CI reviewer was refused `node -e` and
`git worktree remove` by this list.

Most of the removed entries were not doing an `ask` rule's job:

- `find` is on Claude Code's built-in read-only list. Our rule was the only
  reason it ever prompted.
- `sed`, `awk`, `xargs`, `node -e`, `curl`, and `wget` can do harm, but so can
  every interpreter the list never named. Claude Code documents that a text rule
  is not a boundary around a program: `bash -c 'curl …'` passes a
  `Bash(curl *)` rule.
- Dependency changes already go through `dep-sync-reminder.mjs` and the
  `dep-sync` Skill. An issue, a label, or a tag can be undone in one command.

Until the same change added `--defer`, the guard hooks answered `allow` for
every command they had no objection to. That skipped the prompt for everything
outside `ask` and `deny`, so the `ask` list was, in practice, the whole of the
confirmation this file provided. Removing that blanket allow is what makes a
shorter `ask` list safe.

## Decision

**1. An `ask` entry must name something that cannot be taken back from the
working copy.** The current list is exactly that: `git push`, `git rebase`,
`git merge`, `git commit --amend`, `git worktree remove` (kept by ADR 0099),
opening a pull request, merging or closing one, releases, and `gh api` calls
that write.

**2. Anything destructive with no legitimate use in a session is `deny`, not
`ask`.** That covers force and delete pushes in any flag position,
`reset --hard`, `clean`, `restore`, forced `git switch`, repository and secret
administration, and the Sandcastle dispatcher.

**3. Everything else is the permission mode's call.** In Manual mode a command
missing from `allow` still prompts, because the guard hooks no longer approve
it. In auto mode the classifier reviews it, and the classifier sees the
transcript, which a text rule does not.

## Consequences

In auto mode and in cloud sessions, the commands this ADR removes from `ask`
run when the classifier allows them, not when a person does. That trade is
deliberate: the classifier blocks destructive and exfiltrating actions by
rule, and a human answering the same prompt fifty times a session was
approving without reading.

A new `ask` entry needs the argument in decision 1. "This command could be
misused" is not that argument, because it is true of every interpreter, and an
`ask` list built on it becomes the one this ADR replaced.

Tightening `ask` still binds the CI reviewer as a refusal, so
`yarn review:allowlist:check` must pass after any change here (ADR 0099).
