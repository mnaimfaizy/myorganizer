# The frontier caught everything, and the set it caught is smaller

Frozen 2026-09-12. Numbers live in
[`docs/review/golden-replay-results.md`](../review/golden-replay-results.md);
this brief does not move.

## What ran

Run [34663295486](https://github.com/mnaimfaizy/myorganizer/actions/runs/34663295486),
`tier=frontier`, dispatched deliberately on pull request #733's branch rather
than carried by a push — the first replay to use the cadence issue #722 set:
`max-parallel: 1`, one repetition per dispatch, so a run cannot lock the
maintainer's five-hour window the way the eight-at-once runs did.

**Five of five.** Every frontier case scored `recall: 1`, `pass: true`, read
from each case's `score.json` rather than from the job status.

| Case                                         | Run 47 | Run 48 |
| -------------------------------------------- | ------ | ------ |
| `export-envelope-drops-tasks`                | catch  | catch  |
| `release-bump-leaves-generated-client-stale` | miss   | catch  |
| `signup-password-wrapper-inside-formcontrol` | catch  | catch  |
| `import-confirm-is-bare-window-confirm`      | catch  | catch  |
| `mail-test-setup-assigns-undefined-to-env`   | catch  | catch  |

The guard tier did not run, so `groceries-blob-type-without-fanouts` keeps its
eleven-of-eleven untouched and unextended.

## The comparison that flatters, and the one that does not

The frontier arm's previously recorded valid runs were **0, 1 and 1 out of
seven**, and 1 of 6 after the retirement. Set beside 5 of 5, that reads like a
transformation. Two things make the raw ratio the wrong number to quote.

**The set is not the same set.** `groceries-ui-written-against-absent-roles`
was retired on 2026-09-08 as unwinnable, and
`sync-bookmarks-without-restore-or-meta-push` was parked on 2026-09-11. The
parked case had **never been caught in any run**. Removing a case that always
missed raises the rate arithmetically without the reviewer improving at
anything. The honest comparison drops it from both ends: roughly 1 of 6 before,
9 of 10 across runs 47 and 48. Still a large move, and a smaller one than
5-of-5-against-1-of-7.

**Two runs is not the measurement.** Issue #722 set a measurement at three
dispatches, and this is the second. The record has already been wrong once in
exactly this shape: run 44 and run 45 scored the same total on different cases,
which is what a stochastic reviewer near the middle of its range looks like.
What is different here is that the two runs agree at the _ceiling_ rather than
at a score — nine of ten individual case outcomes, not two totals that happen
to match.

## What moved, and what it cost to say so

`mail-test-setup-assigns-undefined-to-env` reaches **three consecutive
catches** — 34441162698, 34591297535, 34663295486 — and is promoted to
`guard`, the first case in the set's history to graduate. The rate-limit void
at 34351285079 neither extends nor breaks the streak, per the rule the record
already applies to voids.

The promotion is a cost as well as a result. A `guard` case runs only when the
Standards brief or the finding contract changes, so a detector that has been
firing on every review-tooling change now fires rarely. ADR 0072 prices that
deliberately — promotion takes three catches and demotion takes one miss,
because a wrongly promoted case is a detector that quietly stopped running.
Four frontier cases remain, so the set still measures something on an ordinary
change.

Nothing else moves. `export-envelope`, `signup` and `import-confirm` each sit
at two consecutive catches, one short. `release-bump` sits at one.

## What `release-bump` turning over does and does not settle

[The 2026-09-12 brief on run 47](2026-09-12-a-true-citation-about-the-wrong-gate.md)
traced that case's miss to the gate-coverage obligation's `gate` field: the
reviewer named `deploy:pages:check`, cited it truthfully, and the defect never
fired because the answer was true about the wrong object. Issue #734 was filed
from it.

Run 48 catches the case. That does **not** retire the finding. The mechanism is
unchanged — `gate` is still the one answer field with no citation requirement
and still the field that selects what every other field is about — and one
catch shows only that the reviewer can name the right gate, not that it must.
What the catch does settle is the urgency: the miss was a draw from a
distribution, not a deterministic dead end, so #734 describes a gap that
widens the variance rather than a wall that guarantees the miss. Anyone
picking up that issue should know the case passes sometimes, or they will be
unable to reproduce what the issue describes.

## What is still not measured

Neither trust metric moved, because neither depends on recall. The
escaped-defect rate still reports `not measurable` — 57 fixes in the window,
none naming a root cause (issue #736). The effective-false-positive rate still
reports `insufficient-evidence` at zero observations. Recall is a regression
signal; the question of whether a human can rely on a passing review remains
unanswered by every number in this brief.
