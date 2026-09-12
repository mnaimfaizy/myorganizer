# The guard came back with the refusals intact

Frozen 2026-09-11. Numbers live in
[`docs/review/golden-replay-results.md`](../review/golden-replay-results.md);
this brief does not move.

## What ran

Run [34582767531](https://github.com/mnaimfaizy/myorganizer/actions/runs/34582767531)
at `e02d20eb`, dispatched deliberately with `tier=guard` — one case, one
repetition, the acceptance test issue #728 asked for. It is the first replay to
measure the reviewer containment (#716), the tool allowlist check (#715), the
truncation outcome (#717) and the inverted gate-coverage obligation (#723)
together.

| Case                                          | Result | Recall        |
| --------------------------------------------- | ------ | ------------- |
| `groceries-blob-type-without-fanouts` (guard) | catch  | 1/1, 14 other |

The guard is caught again, which is what the containment work was supposed to
buy. Against run 45, the same case on the same model:

| Run                | Outcome                | Turns       | Permission denials |  Cost |
| ------------------ | ---------------------- | ----------- | -----------------: | ----: |
| 45 (`34441162698`) | void — turn exhaustion | 81, ceiling |                 26 |     — |
| 46 (`34582767531`) | catch                  | 56 of 80    |                 26 | $2.93 |

## The headline number moved and the diagnosis did not

Run 45's brief read its 26 denials as the cause of the turn ceiling, and the
fix followed from that reading: narrow `Write`/`Edit` to `tmp/code-review/**`,
drop the `Bash(sed -n:*)` entry the allowlist check found matched nothing
anybody was told to run. The case now passes with 24 turns of headroom.

**The denial count is unchanged.** Twenty-six, both runs. Whatever the
containment fix bought — and it bought a catch — it did not buy fewer
refusals, so the causal story in run 45's brief cannot be right as stated: 26
denials are survivable in 56 turns, and were not by themselves what exhausted 80. Reading a count as a cause is what went wrong; the count was a symptom
sitting next to one.

## What is actually being refused

Eighteen refusals are visible as `tool_result` text in the transcript (the
harness's own counter says 26, which also counts the sub-agents' calls). By
shape:

| Refused command                                 | Count | Why the allowlist does not permit it              |
| ----------------------------------------------- | ----: | ------------------------------------------------- |
| `git worktree remove --force tmp/code-review/…` |    11 | permitted by `Bash(git worktree:*)`; `add` ran    |
| `cd … && find …`, `cd …; sed -n …`              |     5 | compound; the matcher reads the first two tokens  |
| `sed -n '1,50p' …`                              |     1 | the entry #715 removed as matching no instruction |
| `node -e` reading `.claude/settings.json`       |     1 | inspecting its own permissions after being denied |

Three things follow, and none of them is about this case.

**The eleven are one command, retried, and the allowlist permits it.** The
replay's own `facts` block tells the reviewer to add a worktree at the head and
remove it afterwards, and `Bash(git worktree:*)` is in `--allowedTools`. The
asymmetry is the evidence: `git worktree add tmp/code-review/worktree b917685`
was **permitted and ran** — twice, because the first one was never removed —
while `git worktree remove` on that same worktree was refused eleven times,
the reviewer varying the spelling each time (`&& git worktree list`,
`; echo done`, `--force` dropped) the way anyone does when a command that
should work does not. One pattern, one prefix, two subcommands, opposite
outcomes. So this is not a missing allowlist entry, and not the first-token
rule either: something below `--allowedTools` refuses `remove` while allowing
`add`. Roughly a fifth of the turn budget went on it.

**`yarn review:allowlist:check` passes.** It matches token-wise against the
commands the documents instruct, and `git worktree remove` _is_ permitted
token-wise, so there is nothing for it to report. The check answers "does the
allowlist permit what the instructions say to run" and the gap is one level
down: whether the harness in fact permits what the allowlist says it permits.
A file-reading checker cannot see that, which is the property that made it
cheap and is also its ceiling.

**The compound refusals are the matcher working as documented.** `cd X && find`
is not a `find` command by the first-token rule, and widening the allowlist to
admit compounds would admit arbitrary commands after `&&`. The instruction, not
the allowlist, is the side to change.

## What this does not establish

One dispatch is one repetition. The guard's tier does not move on it — it was
already `guard`, and a single catch promotes nothing (ADR 0072) — and the
record's own cadence rule says no narrative conclusion should rest on one
dispatch. What this run does establish is narrower and is a fact about the
apparatus rather than the reviewer: the case that measured nothing on
2026-09-10 measures something again, so the containment work cleared the
blockage it was dispatched to clear.

The refusal count is a separate, open finding. It costs turns on every case,
not just this one, and the eleven identical refusals of an instructed command
are the cheapest known lead on the frontier arm's turn budget.
