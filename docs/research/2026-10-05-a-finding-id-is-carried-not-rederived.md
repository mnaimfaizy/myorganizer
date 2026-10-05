# A finding id is carried, not re-derived

**Frozen 2026-10-05.** The measurement behind the issue #940 amendment to
[ADR 0071](../adr/0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md)
item 6. It answers the question
[the 2026-09-28 brief](2026-09-28-the-first-trust-measurements-with-gh.md) left
open: how often two distinct findings share one id. This brief does not
update; the running numbers are in
[`effective-false-positive-rate.md`](../review/effective-false-positive-rate.md).

## What was read

`yarn review:noise:measure --days 30 --limit 1500`, window 2026-09-05 to
2026-10-05: 1115 review runs, 605 distinct pushes on 140 branches, 362 of them
with a stored report, 292 of those at report schema version 3 — the version
whose ids hash `axis + ruleId + file`. Nine pushes' commit messages could not
be read. The saved gather is kept out of the tree for size.

## Within one report

Of 292 reports, 193 carry a finding and **9 carry two or more findings on one
tuple**: 23 of 378 findings, all located, under
`spec-requirement-missing` (12), `standard-doc-claim-drifted` (2), `smell-duplicated-code` (2), `spec-requirement-implemented-wrong` (7).
Within a report the old disambiguator kept their ids apart, so nothing was
miscounted there. The cost was the renumbering: fix the first and the survivor
took its id.

## Across consecutive pushes

165 pairs of consecutive pushes both carry a version-3 report. Across them
**36 ids survived a push** — the 27 observations the measurement counted as
ignored and the 9 it set aside as acknowledged. Each was read by hand, the
two summaries side by side, and labelled by whether the second push's finding
is the defect the first push reported.

- **20 the same defect.**
- **15 a different defect** under the same rule in the same file.
- **1 unclear** (pair 11: two overlapping complaints about duplicated test
  bootstrap).

So 15 of 36 surviving ids, 42%, are the collision the 2026-09-28 brief saw
twice on #928. Fourteen of the 15 were counted as ignored; the fifteenth
(pair 27) is an acknowledgement that landed on a finding its author never
saw.

## What it did to the rate

The window measures **9.6%** (27 ignored of 281) with four rules over budget.
Taking the 14 mislabelled observations out leaves 13 of 281, **about 4.6%**,
or 4.3% if pair 11 is also a different defect. Per rule, by the hand labels:

| Rule                                 | Published            | Hand-labelled        |
| ------------------------------------ | -------------------- | -------------------- |
| `spec-requirement-missing`           | 9 of 35, over budget | 6 of 35, over budget |
| `spec-requirement-implemented-wrong` | 4 of 31, over budget | 3 of 31, within      |
| `standard-other`                     | 3 of 26, over budget | 1 of 26, within      |
| `smell-duplicated-code`              | 6 of 59, over budget | 1 or 2 of 59, within |

Three of four over-budget verdicts were the identity, not the rule.

## Why no field added to the hash fixes it

The obvious discriminator is where the finding is. The reviewer does not
write that the same way twice:

- Of the 19 located findings that genuinely persisted, **8 started at a
  different line on the next push**. Five of those are one declined blocking
  finding on the #841 branch, anchored at line 34, 42, or 44 from one push
  to the next.
- The text of the anchored line tracks the line number: unchanged in 12 of
  the 13 pairs whose line number is unchanged, and in none of the others. So
  hashing line content instead of line number buys nothing here: the
  instability is the reviewer choosing a different line, not the line
  moving.
- The cited quote is no better: it is word-for-word equal in 3 of the 20
  same-defect pairs.

Hashing `startLine` would turn 12 of the 15 collisions into new findings and
8 of the 19 genuine repeats with them, including the blocking one, on every
push. That swaps one bias for the opposite one and resolves a declined
blocking thread each time.

## What overlap does

A pairwise rule needs no stable anchor, only a nearby one: the second
finding is the first when they share axis, rule, and file **and their line
ranges overlap**. Replaying the window under it — every stored report
re-normalized in order, each handed the one before — gives the last column
below. Against the 35 labelled pairs:

|                        | Agrees with the labels | Different read as same | Same read as different |
| ---------------------- | ---------------------- | ---------------------- | ---------------------- |
| `axis + ruleId + file` | 20 of 35               | 15                     | 0                      |
| hash `startLine` too   | 24 of 35               | 3                      | 8                      |
| carry on overlap       | 28 of 35               | 5                      | 2                      |

The five it still merges are four different defects on overlapping lines
(pairs 16, 17, 33, 34) and one unlocated pair with no lines to compare (24).
The two it splits are a range that missed by two lines (19) and a finding
re-raised as a file-wide pattern (35). The replayed rate is 16 ignored of 282
once the eight acknowledgements are honoured, **5.7%**, against 4.6% by hand
and 9.6% published. The replay cannot honour them itself: the commits name
ids the replay re-derives.

Thirty-five pairs is a small sample, and the labels are one reader's. Nothing
here was tuned to it — the rule is plain overlap, with no slack — which is why
pair 19 is left as a miss rather than fixed with a tolerance.

## Every pair

"Old" is what the published measurement recorded; "New" is whether the
overlap rule carries the id.

| #   | Pushes                | Rule                                              | Start line  | Label     | Old          | New     |
| --- | --------------------- | ------------------------------------------------- | ----------- | --------- | ------------ | ------- |
| 1   | `6e6920d` → `9ec0694` | `obligation-run-the-gate-that-covers-this-change` | 1 → 1       | same      | acknowledged | carried |
| 2   | `6e6920d` → `9ec0694` | `obligation-run-the-gate-that-covers-this-change` | 31 → 31     | same      | acknowledged | carried |
| 3   | `9ec0694` → `aa2e735` | `obligation-run-the-gate-that-covers-this-change` | 1 → 1       | same      | acknowledged | carried |
| 4   | `9ec0694` → `aa2e735` | `obligation-run-the-gate-that-covers-this-change` | 31 → 31     | same      | acknowledged | carried |
| 5   | `aa2e735` → `a483f41` | `obligation-run-the-gate-that-covers-this-change` | 1 → 1       | same      | acknowledged | carried |
| 6   | `aa2e735` → `a483f41` | `obligation-run-the-gate-that-covers-this-change` | 31 → 31     | same      | acknowledged | carried |
| 7   | `a483f41` → `9568773` | `obligation-run-the-gate-that-covers-this-change` | 1 → 1       | same      | acknowledged | carried |
| 8   | `a483f41` → `9568773` | `obligation-run-the-gate-that-covers-this-change` | 31 → 31     | same      | acknowledged | carried |
| 9   | `737db1f` → `f26962d` | `spec-requirement-implemented-wrong`              | 2629 → 2630 | same      | ignored      | carried |
| 10  | `f26962d` → `3d57489` | `spec-requirement-implemented-wrong`              | 2630 → 2630 | same      | ignored      | carried |
| 11  | `aec4562` → `1804e99` | `smell-duplicated-code`                           | 118 → 1     | unclear   | ignored      | carried |
| 12  | `05736f2` → `115d5c2` | `smell-duplicated-code`                           | 425 → 56    | different | ignored      | new     |
| 13  | `115d5c2` → `40fc34e` | `smell-duplicated-code`                           | 56 → 56     | same      | ignored      | carried |
| 14  | `40fc34e` → `8aad6a2` | `smell-duplicated-code`                           | 56 → 138    | different | ignored      | new     |
| 15  | `8aad6a2` → `39987c6` | `spec-behaviour-not-asked-for`                    | 60 → 158    | different | ignored      | new     |
| 16  | `15a95dc` → `9b1a4a1` | `smell-duplicated-code`                           | 24 → 155    | different | ignored      | carried |
| 17  | `4866424` → `75c0d68` | `standard-doc-claim-drifted`                      | 83 → 83     | different | ignored      | carried |
| 18  | `5d42b94` → `1d4e439` | `spec-requirement-missing`                        | unlocated   | same      | ignored      | carried |
| 19  | `5835210` → `d869b56` | `spec-requirement-missing`                        | 34 → 44     | same      | ignored      | new     |
| 20  | `d869b56` → `b4c4815` | `spec-requirement-missing`                        | 44 → 34     | same      | ignored      | carried |
| 21  | `b4c4815` → `6f3335b` | `spec-requirement-missing`                        | 34 → 42     | same      | ignored      | carried |
| 22  | `1729de4` → `b86a529` | `spec-requirement-missing`                        | 34 → 42     | same      | ignored      | carried |
| 23  | `b86a529` → `7e01e9d` | `spec-requirement-missing`                        | 42 → 44     | same      | ignored      | carried |
| 24  | `3d19f5b` → `d39dbb5` | `spec-requirement-missing`                        | unlocated   | different | ignored      | carried |
| 25  | `063c00a` → `f6ef177` | `standard-design-token-bypassed`                  | 28 → 73     | same      | ignored      | carried |
| 26  | `4228d2c` → `4c9713f` | `standard-domain-term-off-glossary`               | 133 → 114   | different | ignored      | new     |
| 27  | `af81865` → `62b5314` | `smell-duplicated-code`                           | 95 → 148    | different | acknowledged | new     |
| 28  | `4a13310` → `2d99ede` | `spec-requirement-missing`                        | 125 → 25    | different | ignored      | new     |
| 29  | `3c12594` → `919aef4` | `standard-other`                                  | 198 → 14    | different | ignored      | new     |
| 30  | `6d2c516` → `47c3bc9` | `smell-duplicated-code`                           | 358 → 676   | different | ignored      | new     |
| 31  | `2dabb8e` → `a21677d` | `standard-other`                                  | 62 → 646    | different | ignored      | new     |
| 32  | `3eef6c4` → `7db9aa8` | `spec-requirement-implemented-wrong`              | 1 → 1       | same      | ignored      | carried |
| 33  | `f510967` → `a804d8d` | `spec-requirement-missing`                        | 411 → 411   | different | ignored      | carried |
| 34  | `911da43` → `936997c` | `spec-requirement-implemented-wrong`              | 188 → 190   | different | ignored      | carried |
| 35  | `7720e4a` → `f2209d7` | `standard-other`                                  | 147 → 231   | same      | ignored      | new     |
| 36  | `2b70c35` → `3bfb2fc` | `standard-doc-claim-drifted`                      | 16 → 71     | different | ignored      | new     |
