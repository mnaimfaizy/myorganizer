# The frontier emptied itself: three dispatches, three promotions, one case left

Frozen 2026-09-12. Numbers live in
[`docs/review/golden-replay-results.md`](../review/golden-replay-results.md);
this brief does not move.

## The measurement issue #722 asked for

Three deliberate dispatches on pull request #733's branch, at
`max-parallel: 1`, one repetition each.

| Run | Id                                                                                | Tier          | Result |
| --- | --------------------------------------------------------------------------------- | ------------- | ------ |
| 47  | [34591297535](https://github.com/mnaimfaizy/myorganizer/actions/runs/34591297535) | all tiers, 6  | 5 of 6 |
| 48  | [34663295486](https://github.com/mnaimfaizy/myorganizer/actions/runs/34663295486) | `frontier`, 5 | 5 of 5 |
| 49  | [34673097908](https://github.com/mnaimfaizy/myorganizer/actions/runs/34673097908) | `frontier`, 4 | 4 of 4 |

**Fourteen of fifteen case outcomes.** The single miss is `release-bump` in
run 47, traced in
[its own brief](2026-09-12-a-true-citation-about-the-wrong-gate.md) to the
gate-coverage obligation's uncited `gate` field (issue #734). Every catch was
read from the case's own `score.json` — `recall: 1`, `pass: true` — not from
job status.

Against the prior regime, dropping from both ends the two cases since retired
and parked so the comparison is like for like, the frontier arm was **3 of
20**. Roughly 15% to 93%.

**The three dispatches did not measure the same set.** Six cases, then five,
then four — because run 48's own result promoted a case out of the tier that
run 49 then replayed. The series is not clean, and the record should not be
read as though it were. What it does support is narrower and still worth
having: across fifteen case-runs spanning three tier compositions, the
reviewer missed once.

## Three promotions at once

`export-envelope-drops-tasks`, `signup-password-wrapper-inside-formcontrol`
and `import-confirm-is-bare-window-confirm` each reach three consecutive
catches — 34591297535, 34663295486, 34673097908 — and are promoted to `guard`.
With `mail-test-setup-assigns-undefined-to-env` promoted a day earlier, the
set is now **five guard and one frontier**.

`release-bump-leaves-generated-client-stale` sits at two consecutive catches
and is the only frontier case left.

### The rule produced an outcome nobody chose

Three things about this are worth writing down before someone reads the table
and assumes it was designed.

**The frontier is at its floor.** ADR 0072's tests assert at least one
frontier case remains, and exactly one does. On an ordinary review-tooling
change the replay now runs a single case. That is the assertion satisfied and
the instrument at its minimum simultaneously.

**`export-envelope` promoted for the opposite of the reason it was kept.** It
survived the narrowing to six precisely because it flickered near half, and a
case that always passes or never passes carries less information per run than
one in the middle — ADR 0072's Alternatives considered says so, and its
2026-09-11 amendment repeats it. The promotion rule does not read intent. One
miss demotes it straight back, which is the only reason this is tolerable.

**The cost moved rather than fell.** ADR 0072 promised that as the brief
improves, cases migrate to `guard` and the recurring cost falls. Half of that
happened. Five guard cases means any change to the Standards brief or the
finding contract now triggers a five-case sequential replay — and the subject
of the pull request these runs were taken on **is** that contract. The saving
is real on ordinary changes and inverted on exactly the changes most likely to
need measuring.

## This is the designed success condition, not a malfunction

The temptation is to read an emptying frontier as the instrument breaking, and
to withhold promotions to keep it busy. That would be re-authoring ADR 0072 in
practice while leaving its text alone, which is the shape this repository
treats as a defect everywhere else.

ADR 0072 says plainly that cases migrating from frontier to guard is what
improvement looks like. The correct response to a thin frontier is to **feed
it**, and the set already declares how it grows: by attribution, when a merged
defect is traced to the pull request that introduced it (ADR 0071). Two inlets
exist today and neither is open yet:

- **New incidents.** Issue #736 is the convention that would make attribution
  routine rather than archaeological — the same fact the escaped-defect rate
  needs. One mechanism feeds both.
- **`sync-bookmarks-without-restore-or-meta-push`**, parked rather than
  retired precisely so it could come back, returns the day its Deferred
  Candidate becomes a real obligation. It has never been caught in any run,
  so it would rejoin as a frontier case immediately.

Until one of those opens, the set measures a single case per ordinary change,
and that is a fact about the set's supply of hard cases rather than about the
reviewer.

## What none of this measures

Neither trust metric moved, because neither depends on recall. The
escaped-defect rate still reports `not measurable` — fifty-seven fixes in the
window, none naming a root cause (issue #736). The effective-false-positive
rate still reports `insufficient-evidence` at zero observations.

Recall is a regression signal. Fourteen of fifteen says the reviewer still
catches what it was taught to catch on a set it has seen before. Whether a
human can rely on a passing review on a diff nobody has seen is a different
question, and every number in this brief leaves it open.
