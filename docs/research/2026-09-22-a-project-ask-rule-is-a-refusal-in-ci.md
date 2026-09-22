# A project `ask` rule is a refusal in CI

Frozen 2026-09-22. The decision this supports is
[ADR 0097](../adr/0097-a-project-ask-rule-is-a-refusal-in-a-headless-run.md); the gate is
`yarn review:allowlist:check`. This brief does not move.

## The question

Golden replay run [34582767531](https://github.com/mnaimfaizy/myorganizer/actions/runs/34582767531)
refused `git worktree remove` eleven times and permitted `git worktree add` on the same path in the
same run, under one `--allowedTools` entry — `Bash(git worktree:*)` — that names both. The earlier
brief ([2026-09-11](2026-09-11-the-guard-came-back-with-the-refusals-intact.md)) established the
asymmetry and stopped there: "something below `--allowedTools` refuses `remove` while allowing
`add`". [#732](https://github.com/mnaimfaizy/myorganizer/issues/732) asks what.

The run's transcript artifact has a seven-day retention and is gone. Everything below is read off
the tree instead, which is also why the answer turned out to be gateable.

## The answer

`.claude/settings.json` is tracked (`git ls-files .claude/` lists it), so the CI checkout carries
it and the reviewer's Claude Code session loads it as project settings. Its `permissions.ask` list
contains, verbatim:

```
"Bash(git worktree remove:*)",
```

Claude Code evaluates `deny`, then `ask`, then `allow`, so this rule is consulted before any allow
rule and outranks it — including one added by `--allowedTools`. Interactively it produces a prompt.
In a headless run there is nobody to prompt, so it resolves as a refusal.

`git worktree add` matches no rule in either the `ask` or the `deny` list, so it falls through to
`Bash(git worktree:*)` and runs. That is the whole of the asymmetry.

## Why this is a mechanism and not a story about git

The same file explains two more of the run's four refusal shapes, and one of them is decisive
because the grant was not in doubt:

| Refused in run 46                         | `--allowedTools` grant | Interposed rule in `.claude/settings.json` |
| ----------------------------------------- | ---------------------- | ------------------------------------------ |
| `git worktree remove --force …` (×11)     | `Bash(git worktree:*)` | `ask`: `Bash(git worktree remove:*)`       |
| `node -e` reading `.claude/settings.json` | `Bash(node:*)`         | `ask`: `Bash(node -e:*)`                   |
| `sed -n '1,50p' …`                        | none (removed by #715) | `ask`: `Bash(sed:*)`                       |
| `cd … && find …`, `cd …; sed -n …` (×5)   | —                      | — (the first-token matcher, as documented) |

`node -e` is the second instance under an unambiguous grant: `Bash(node:*)` permits it token-wise
and it was refused anyway. Two unrelated programs, one mechanism. The reviewer was at that moment
running `node -e` to read the very file that was refusing it.

The `sed` row corrects the earlier brief's reading of that refusal, and it matters more than it
looks. [#715](https://github.com/mnaimfaizy/myorganizer/issues/715) removed `Bash(sed -n:*)` from
the allowlist as an entry matching no instruction, and 2026-09-11 attributed the refusal to that
removal. It cannot have been: `Bash(sed:*)` in the `ask` list would have refused `sed -n` with the
entry still in place. The removal changed nothing about this, which is the evidence behind ADR 0097
decision 6 — an unused grant is not debt, and reading it as debt bought a change that fixed nothing.

## Why the gate passed

`yarn review:allowlist:check` compared the instructions against one file. Token-wise,
`Bash(git worktree:*)` does permit `git worktree remove`, so there was nothing for it to report.
The check answered "does the allowlist permit what the instructions say to run" and the gap was one
level down: whether the session in fact permits what the allowlist says it permits.

The 2026-09-11 brief called that "a property that made it cheap and is also its ceiling". That
reading was wrong about the ceiling. The second side is a tracked JSON file with two arrays in it,
so the second direction is exactly as cheap as the first — nothing here needs a transcript. The
checker now reads both and fails on either, and adding it turned up the live instance immediately:
the skill's own worktree-removal line, which is the one the reviewer had been refused eleven times.

## What this does not establish

The harness counter reported 26 denials against 18 visible as `tool_result` text. The difference is
sub-agent calls, which nobody has read, so whether the two sub-agents are refused the same way is
unknown. That is observable only from a transcript, and a transcript expires in seven days — it is
not gateable and is recorded as an open hole rather than closed by assertion.

No new replay was dispatched for this. The refusal count that would confirm the fix is a
measurement for the next run, and a single dispatch would not settle it in either direction
([ADR 0072](../adr/0072-a-golden-case-earns-its-replay-frequency.md)).
