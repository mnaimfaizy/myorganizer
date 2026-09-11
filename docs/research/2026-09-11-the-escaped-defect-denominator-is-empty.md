# The escaped-defect denominator is empty, and the numerator has no candidates

Frozen 2026-09-11. Numbers live in
[`docs/review/escaped-defect-rate.md`](../review/escaped-defect-rate.md); this
brief does not move.

## What was measured

The first run of `yarn review:escaped:measure`, over the sixty days ending
2026-09-11, on `slice/721-code-review-trust-escaped-defect-rate` at `2336065d`.
Git evidence only: the sandbox has no authenticated `gh`, so Pull Request
bodies, issue bodies, and review summary comments were not read.

| Quantity                                             | Value              |
| ---------------------------------------------------- | ------------------ |
| Merged Pull Requests on `main`, all history          | 318                |
| Merged Pull Requests in the window                   | 222                |
| Fix Pull Requests in the window                      | 57                 |
| Of those, naming a root cause                        | **0**              |
| Pull Requests the reviewer passed in the window      | **0**              |
| Pull Requests in the window with no readable verdict | 24                 |
| Escaped-defect rate                                  | **not measurable** |

## The denominator is empty because the reviewer is five days old

`.github/workflows/code-review.yml` landed on 2026-09-06 (`a25dcac5`). Of the
318 Pull Requests on `main`, 294 merged before that date and are `unreviewed`
as a fact about the repository rather than as a failed lookup — the script
establishes them without a single network call. The remaining 24 merged inside
the reviewer's lifetime, and this run could read a verdict for none of them.

None of those 24 is counted as a pass. That is the whole point of separating
`unreviewed` and `unknown` from `passed`: a review nobody read is not a review
that approved anything, and folding either into the denominator would have
produced a rate on the first day the apparatus existed.

So the honest reading is that **the trust measurement cannot report a number
yet, and will not be able to until the pipeline has passed enough Pull
Requests for a fix to have been written against one.** A rate over four or
five passes would be noise with a percent sign on it.

## The numerator has no candidates, and that is the more interesting half

All 57 fixes in the window are `unattributed` — not one names the change that
introduced the defect in a form the parser reads. Widening the window to 120
days adds four fixes and no attributions.

This is not a parser that fails to fire. Scanning four months of `main` for
`<phrase> <reference>` across a vocabulary wider than the one shipped finds
the following, in the whole corpus and not only in fix branches:

| Phrase             | Occurrences | Example                    |
| ------------------ | ----------: | -------------------------- |
| `since`            |           7 | `since #590`, `since #550` |
| `added in`         |           3 | `added in #581`            |
| `introduced in/by` |           1 | `introduced by PR #415`    |
| `broke in/by`      |           1 | `broken by #389`           |
| `arrived in`       |           1 | `arrived in 84b3432`       |
| `shipped in`       |           1 | `shipped in 4919747e`      |

Fourteen references in four months, and the two that are unambiguous
attribution — `introduced by PR #415`, `broken by #389` — are in commits that
merged inside `feat/` Pull Requests, not `fix/` ones. The population this
measurement walks is fix branches, so neither is in it.

What this repository's fix commits do instead is describe the root cause **in
prose without naming the change**: "Root cause was a stale pin, not dependency
drift" (#444); "Four root causes, not thirteen bugs" (#521). These are good
commit messages. They are archaeology about the code, not about the history,
and no parser can recover a Pull Request number from them.

## Why the vocabulary was not widened to fit

Adding `added in` and `arrived in` would have matched three more references.
It was not done, for a reason that outlives this run: an attribution that is
wrong corrupts the numerator permanently, while a fix whose phrasing is not
recognised lands in `unattributed`, where it is counted and visible in every
report. "The check added in #581" is a neutral reference at least as often as
it is a causal claim, and the measurement's whole value rests on the
denominator being one nobody has to trust.

The weakest marker was narrowed by this run rather than by argument. It
shipped as `has had it since | dates back to | since`, and the bare `since`
matched exactly one thing in sixty days of fixes — a sentence about where some
files have lived, in Pull Request #705, which is not attribution at all. The
one measurement available says the loose form is wrong, so it was dropped and
the unambiguous phrasings kept: `ChangePassphraseCard has had it since #590`
is real attribution from this history and still matches.

## What the first run found was two defects in its own apparatus

Both were found by running the measurement over real history rather than over
fixtures, and each would have silently mis-stated the number:

1. **A back-merge broke root-cause resolution.** The reference above resolved
   to no Pull Request, and the reason was the resolver: it took the oldest
   merge descendant of a commit as the Pull Request that landed it, and a
   branch that takes `Merge branch 'main' into <branch>` has a merge
   descendant that is not on `main` at all. The rule is now the oldest
   ancestry-path descendant **on `main`'s own first-parent chain**, which
   resolves that commit to #705 correctly.
2. **A fix could be its own root cause.** With resolution fixed, the same
   reference resolved to the fix's own Pull Request — a commit cited from its
   own branch. That is now `not-earlier`, beside a root cause that merged
   after the fix, because both are references that cannot be causal.

Neither could have been found by a unit test written from the same
understanding that wrote the code. They are the argument for taking a real
measurement as part of building the instrument, rather than after it.

## What would have to change

1. **Fix branches have to name the change, not only the defect.** A single
   line — `Introduced in #415` — in the fix's issue, body, or first commit is
   all the measurement needs, and it is the same sentence the golden set is
   built from when an incident is curated by hand.
2. **The reviewer has to pass enough Pull Requests to have a denominator.**
   Nothing can make that happen faster than merging work through the pipeline.
3. **Re-run with `gh` available.** This run's 24 unreadable verdicts are
   unreadable only because the sandbox has no token; in CI or on a
   maintainer's machine they resolve, and the denominator becomes whatever it
   really is instead of zero.

Until then the record carries a measurement that says `not measurable`, which
is a fact about the repository on 2026-09-11 and not a placeholder. The
apparatus is built, its arithmetic is tested, and the first thing it proved is
that the archaeology this measurement depends on is not currently being
written down.
