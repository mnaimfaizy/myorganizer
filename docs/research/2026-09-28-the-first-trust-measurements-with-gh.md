# The first trust measurements with `gh`

**Frozen 2026-09-28.** Interpretation of the first Escaped Defect and
Effective False Positive measurements taken with an authenticated `gh`,
recorded in [`escaped-defect-rate.md`](../review/escaped-defect-rate.md) and
[`effective-false-positive-rate.md`](../review/effective-false-positive-rate.md).
The numbers live there; this brief does not update. Gathered for issue #925.

## What was measured

- Escaped Defect, 2026-07-29 to 2026-09-27: 89 fixes, 9 naming a root cause, 2
  declaring it unknown, 102 Pull Requests the reviewer passed, 1 escape —
  **1.0%**.
- Effective False Positive, 2026-08-28 to 2026-09-27: 124 reviewed pushes, 67
  counted observations, 6 ignored — **9.0%**, with `standard-other` the one rule
  over the 10% budget (2 of 12).

## The one escape was a behaviour defect in a Pull Request reviewed for process

#745 added Sync Run tracking to the YouTube pages. The reviewer passed it with
`comment` on three `should-fix` findings: the ADR's status while its Pull
Request was open, and two about no wired gate validating the new migration
against its schema. The defect #902 later fixed — the pages' refresh gated on
a live state only the poll could see — sits in the frontend diff and drew no
finding.

One escape is not a rate anyone should act on. What it is good for is a golden
case: a real range, a named root cause, and a miss the reviewer made while its
attention went to repository process. That shape — the diff's behaviour
unexamined while conventions are checked — is the one the Golden Set is short
of, since five of its six cases are now caught reliably.

## The parser's first false positive landed on the true answer

The first run counted #902 as escaping from #745 by reading its issue: "**Not a
regression from #745:** The same hole existed before that PR and was wider."
The marker vocabulary had no notion of denial. The fix (#928) skips a negated
marker, and re-running gives the same result anyway, because #902's own commit
names #745 with `Introduced in`.

That coincidence is the lesson. A wrong attribution that agrees with the right
one is invisible in the rate, so the parser's correctness cannot be read off
the number it produces; it has to be tested on sentences, which is what the
code review of #928 then did, running denials the fix still missed ("aren’t"
with a curly apostrophe, "doesn't look like it was", "no doubt").

## The numerator is a lower bound until fixes name their origin

78 of 89 fixes name nothing, and almost all of them merged before
`fix:attribution:check` (ADR 0100) landed on 2026-09-23. Of the twelve fixes
merged since, nine name an origin or declare it unknown. An unattributed fix
cannot be an escape, so 1.0% is what the attributed history supports, not
what the reviewer's history is. A window made entirely of post-gate fixes is
the first one whose rate means what ADR 0077 intends.

## The noise number is real, and one rule is the catalogue's gap

9.0% is the first rate this measurement could produce at all: the previous run
found every pair incomparable, because the finding identity changed on every
push until issue #724. Under the budget overall, the reviewer is worth reading.

`standard-other` is the fallback a finding lands in when no catalogued rule
fits, and it is the one rule over budget. Across all 372 review runs since the
reviewer went live, its most-cited sources were ADR 0085 (seven times) and
`AGENTS.md` (seven times). A fallback over budget is a catalogue that has not
named what reviewers keep finding; #925 gives ADR 0085 its own rule for that
reason.

## Finding identity is coarser than a finding

A finding's id hashes its axis, rule and file (ADR 0071 item 6, after #724).
On #928 the same two ids labelled different defects on consecutive pushes:
`a250d45135ea` was a curly-apostrophe gap on one review and the "no doubt"
idiom on the next, both `standard-missing-focused-test` in the same file.
Two consequences for the noise measurement:

- A defect fixed and a different defect raised under the same rule and file
  reads as one finding that persisted — **ignored**, though the author acted.
- A `Review-ack` names an id, so it can land on a finding the author never
  saw: the one written for a declined comma rule on #928 ended up covering an
  unrelated nit.

Both bias the rate against rules that fire more than once per file. How often
that happens across the window was not measured here.
