# The same-family test has one data point

Frozen 2026-09-11. Numbers live in
[`docs/review/golden-replay-results.md`](../review/golden-replay-results.md);
this brief does not move.

## Question

Issue #725: does the reviewer share blind spots with the agent that wrote the
code, because reviewer and author are the same model family? The 2026-09-10
brief on run 45 ([the answer sheet is inert](2026-09-10-the-answer-sheet-is-inert.md))
raised this as a live possibility — the reviewer asserted a Slot-based
component's direct child was the input control when the source shows a
positioning wrapper, "plausibly the same mistake an author of the same family
would have made for the same reason." Whether that suspicion holds, or
whether it survives contact with who actually wrote the code, had not been
checked.

## Method

Each of the six golden cases in `tools/config/review-golden-set.json` carries
an `incident` line naming the pull request that introduced its defect. That PR
was read directly from `git log` — the merge or squash commit, and, where the
squash body carries `Co-authored-by` trailers or the commit predates this
repository's agent-orchestration tooling, the underlying authorship. No new
archaeology: the incident lines already named the PRs, and this reused them.

Two independent signals decided each case:

1. **Does the commit carry a machine co-author?** GitHub records
   `Co-authored-by: Cursor <cursoragent@cursor.com>` on every sub-commit of
   PR #215's squash. No other case's commits carry any such trailer.
2. **Does the commit predate `sandcastle` orchestration?** `feat(planning):
add to-prd/to-issues skills and sandcastle orchestration` (`a13e4c2d`)
   landed 2026-06-08. PR #40 (2025-12-30), PR #77 (2026-04-29), and PR #101
   (2026-06-03, five days before) all merged before any agent orchestration
   existed in this repository, so their commits — plain messages, personal
   email addresses, no co-author trailers — are read as human.

PR #379 (`release-bump`) postdates sandcastle but its commits are a
`chore(release): v0.4.0` produced by a human running `yarn release:cut`, not
by an agent writing application code; it is classified human on that basis,
not on date.

PR #415's own incident line already does the harder half of this work: it
names the range as "the interrupted slice #396 checkpoint that #415 carried."
The defect-introducing commit, `1f056fa`, is a `wip(slice)` checkpoint whose
body says so in as many words: _"EmailService.spec.ts is raw TestScaffold
output that the agent died immediately before reviewing — it has not been
through TestReviewer or TestRunner."_ `tools/config/agent-model-policy.json`
pins `test-scaffold` to `haiku` on the Claude harness, and the checkpoint's
own language — "5-hour subscription session limit" — is the Claude-specific
rate-limit vocabulary this record uses everywhere else for the reviewer's own
runs. So this one case is not merely "agent-authored": it is authored by a
Claude-family sub-agent, the same family as the reviewer itself
(`claude-sonnet-5` by default, per `CODE_REVIEW_MODEL` in
`.github/workflows/code-review.yml`).

Catch rates were then read case by case from every dated run this record and
its linked briefs report: the 2026-09-07 baseline, the three 2026-09-07
`8-case` runs, the 2026-09-08 frontier runs, the two 2026-09-09 runs, and Run
45 (2026-09-10). One run is excluded on the record's own instruction: run
`34344266006` (2026-09-09) is the one
[the wired-gate qualifier brief](2026-09-09-wired-gate-qualifier-replay.md)
says was "cancelled mid-flight" and confounded by a stale standards copy, and
"not evidence either way and should not be read as such." Void runs (rate
limit, turn exhaustion) are excluded the same way the record always excludes
them — as a third outcome, not a miss.

## Result

| Case                                          | Author        | Catches | Valid runs |  Rate |
| --------------------------------------------- | ------------- | ------: | ---------: | ----: |
| `groceries-blob-type-without-fanouts` (guard) | human         |       9 |          9 |  100% |
| `export-envelope-drops-tasks`                 | human         |       6 |         12 |   50% |
| `release-bump-leaves-generated-client-stale`  | human         |       2 |          7 |   29% |
| `import-confirm-is-bare-window-confirm`       | human         |       1 |          7 |   14% |
| `signup-password-wrapper-inside-formcontrol`  | agent, Cursor |       1 |          8 | 12.5% |
| `mail-test-setup-assigns-undefined-to-env`    | agent, Claude |       1 |          6 |   17% |

Human total: 18 of 35 (51%). Agent total: 2 of 14 (14%). Dropping the guard —
a fan-out pattern the reviewer catches by a mechanism unrelated to who wrote
it, and the only case anywhere near saturation — human frontier cases alone
are 9 of 26 (35%) against the same 2 of 14 (14%) for agent frontier cases.

## What this does not show

**The issue's own motivating example is not a same-family case.** The Slot/div
miss the 2026-09-10 brief flagged as "plausibly the same mistake an author of
the same family would have made" is `signup-password-wrapper-inside-formcontrol`
— written by Cursor's Composer, co-authored on every sub-commit, not by any
Claude-family agent. Whatever caused that miss, it was not demonstrated to be
a family-shared one; a Cursor agent and a Claude reviewer independently failed
to notice the same Slot mechanics, which is either a coincidence or evidence
that the mistake is not family-specific at all. Both readings undercut the
premise the issue opened with more than they support it.

**Only one case actually tests the same-family hypothesis.** Of six golden
cases, four are human and two are agent — and the two agents are different
families. `mail-test-setup-assigns-undefined-to-env` is the only case where
author and reviewer share a family, and it is one case, caught in one run out
of six. A single catch in a single run is exactly the outcome the record has
repeatedly warned carries no weight on its own — the same caveat this record
already applies to `import-confirm`'s lone catch and to `signup`'s lone catch.
Flip that one run and the "same-family" case reads 0 of 6 instead of 1 of 6;
nothing about the hypothesis would follow either way.

**The human/agent gap is not distinguishable from noise already on record.**
Every frontier case here — human or agent — has been caught at most once or
twice across six to twelve attempts. The 2026-09-09 wired-gate brief already
characterized this exact pattern before authorship was ever considered:
"apart from the guard, per-case outcomes look close to independent draws at a
low hit rate, not stable per-case capability." A 35%-vs-14% split built from
three human cases and two agent cases, each individually a coin that has been
flipped fewer than a dozen times, is inside that same noise. It would take
many more independently-attributed cases — and, to test the family question
specifically, more than one case where author and reviewer share a family —
before a gap this size meant anything.

## What would change that

1. **More agent-authored incidents, attributed the same way.** This
   repository's own commits document agent authorship unusually well when the
   work went through `sandcastle` (a `wip(slice)` checkpoint, a `chore(slice):
finalize` commit, a sub-agent name in the body) — the harder problem the
   2026-09-11 escaped-defect brief hit, that fix branches don't name their
   root cause, does not apply here, because the golden set's incident lines
   already carry that citation by construction. Growing the golden set with
   incidents whose introducing PR is agent-authored, and specifically
   Claude-family agent-authored, is the direct way to grow the one case this
   brief found to a sample.
2. **More runs per case**, on the cadence the record already uses (three
   dispatches, read together, per ADR 0072 item 8) — the frontier cases here
   are each resting on six to twelve attempts total, not per arm.

## What this settles

**Not whether the reviewer shares blind spots with agent authors of its own
family.** The sample cannot support that conclusion — not "weakly supports"
or "leans toward," cannot. Six cases, two of them agent-authored, one of
those two sharing the reviewer's family, is not a comparison; it is an
anecdote next to an anecdote. Per issue #725's own framing, this is the
honest result to report, and it is the whole result: **whether this produces
a standing policy about which changes a human always reads is deliberately
not decided here, in either direction.**
