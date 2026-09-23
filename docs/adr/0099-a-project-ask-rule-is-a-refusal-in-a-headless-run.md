# A project `ask` rule is a refusal in a headless run

Golden replay run [34582767531](https://github.com/mnaimfaizy/myorganizer/actions/runs/34582767531)
came back with a catch and twenty-six permission denials, the same count as the run before it
whose containment fix was supposed to reduce them
([research](../research/2026-09-11-the-guard-came-back-with-the-refusals-intact.md)). Eleven were
one command: `git worktree remove` on the throwaway worktree the reviewer's own instructions told
it to remove, under a `--allowedTools` list carrying `Bash(git worktree:*)`, in a run where
`git worktree add` on that same path had been permitted and had run. One pattern, one prefix, two
subcommands, opposite outcomes — roughly a fifth of the turn budget. `yarn review:allowlist:check`
passed throughout, because token-wise the grant does permit `git worktree remove`
([#732](https://github.com/mnaimfaizy/myorganizer/issues/732)).

## Status

accepted

## Context

The refusal was below `--allowedTools`, and the place below it is a file this repository commits.

`.claude/settings.json` is tracked. The CI checkout carries it, so the reviewer's Claude Code
session loads it as project settings alongside whatever the job passes on the command line. Its
`permissions.ask` list contains `Bash(git worktree remove:*)`, and Claude Code evaluates `deny`,
then `ask`, then `allow` — so an `ask` match outranks an allow rule, including one supplied by
`--allowedTools`. Interactively that is a prompt a developer answers. The reviewer has no
keyboard, so the prompt has no answer, and an unanswerable `ask` comes back as a refusal.

`git worktree add` matches no `ask` rule and falls through to the grant. That is the asymmetry,
and it is not about git: `node -e` was refused in the same run while `Bash(node:*)` was granted,
because `Bash(node -e:*)` is in the same `ask` list — the reviewer was, at that moment, trying to
read `.claude/settings.json` to find out why it kept being told no. Three of the four refusal
shapes in the run have this one cause. The fourth, `cd X && find …`, is the documented first-token
matcher working as designed.

The settings file is not wrong. Putting a destructive command behind an `ask` is correct policy
for a developer at a terminal, which is who it was written for. What was wrong is that one file
silently governs two readers with different capabilities, and nothing said so or checked it.

## Decision

**1. A rule in `.claude/settings.json` binds the CI reviewer, and `ask` binds it as `deny`.**
There is no third outcome in a headless run. Anything the reviewer is instructed to do must be
reachable past the project settings, not merely named in a grant.

**2. The instruction side gives way, not the allowlist.** `--allowedTools` cannot reach this —
widening it changes nothing, because the interposed rule is evaluated first. So the fix is to stop
instructing the command, or to instruct a spelling no rule catches. The reviewer no longer removes
its worktree: the CI runner is discarded whole and `tmp/` is gitignored locally, so there was never
anything for it to clean up. The skill still names
`git worktree remove --force tmp/code-review/worktree` for the human who does clean up and can
answer the prompt, and that naming carries a written suppression rather than a grant.

**3. The same rule settles the compound refusals.** `cd X && find …` is a `cd` by the first-token
rule, and admitting `&&` would admit anything after it. The skill now says one command per Bash
call, addressed by path — never `cd` into the worktree, never chain with `&&` or `;`, and locate
files with Glob and Grep rather than `find`.

**4. The harness-level question is gateable, and is now gated.** Both sides are files, which is the
property that made the original check cheap and is the property this one inherits.
`yarn review:allowlist:check` asserts a second direction: no command the skill or the Review
Checklist instructs is matched by an `ask` or `deny` rule in `.claude/settings.json`. It is not a
transcript check and does not need to be — nothing here expires after seven days.

**5. A placeholder cannot produce an interception.** An unfixed token (`<project>`, `$SHA`) reads
as matching anything when asking whether a grant _covers_ an instruction, which is the generous
reading that avoids inventing refusals. It reads as matching nothing when asking whether a rule
_catches_ one: `node tools/scripts/check-<name>.mjs` is not `node -e` for any value of `<name>`,
and the first version of this gate reported it as refused. An interception has to be certain.

**6. An unused `--allowedTools` entry is still not failed.** [#715](https://github.com/mnaimfaizy/myorganizer/issues/715)
removed `Bash(sed -n:*)` for matching no instruction, and `sed` was refused in the very next run
regardless — the entry was never what refused it; `Bash(sed:*)` in the `ask` list was. Reading an
unused grant as debt cost a change that fixed nothing, and the checker's header now says why that
direction is omitted.

## Consequences

The reviewer stops paying eleven turns per run for an instruction it cannot follow, and the class
of defect — a grant an interposed rule overrides — fails at commit time instead of being
rediscovered from a transcript two runs later.

The cost is a coupling that must stay visible: tightening `.claude/settings.json` can now break the
reviewer, and the gate is what makes that arrive as a failing check rather than as a turn budget
quietly draining. Adding `Bash(git ...:*)` to `ask` for a subcommand the reviewer is told to run
will fail `review:allowlist:check`, and the fix is to reword the instruction — not to remove the
`ask`, which protects the developer the file was written for.

This says nothing about whether the reviewer's _sub-agents_ are refused the same way. The harness
counter reported twenty-six denials against eighteen visible in the transcript, and the difference
is sub-agent calls nobody has read. That remains observable only from a transcript, and a
transcript expires in seven days; it is a known hole and is left stated rather than closed.
