# Golden replay results

**Kept current.** This file is the running record ADR 0071 asks for: "the ADR
that narrows CODEOWNERS and makes the agent verdict a required check can be
written once the golden-set replay has a record." Append a row per replay run
and keep the tier table honest; do not freeze it at a date. Interpretation —
why a case missed, what a brief change did — belongs in a dated Research Brief
under `docs/research/`, which is frozen and never edited
([ADR 0041](../adr/0041-internal-notes-have-homes.md)). The numbers live here
because they must stay current; the reasoning lives there because it must not.

The first entry's reasoning is
[the 2026-09-07 baseline](../research/2026-09-07-golden-replay-baseline.md).

## What the numbers mean

Recall is matched expected findings over expected findings, scored by
`tools/scripts/review/score-golden-case.mjs` against the validated report of
one reviewer run per case. A case passes at or above its `minRecall`. The
reviewer is stochastic: a single run of a single case is not a measurement,
which is why the baseline reports five runs of the same three cases and why
promotion between tiers takes three consecutive catches.

## Tiers

A case's tier decides how often it is replayed
([ADR 0072](../adr/0072-a-golden-case-earns-its-replay-frequency.md)).
Promotion to `guard` takes **three consecutive catches**; demotion to
`frontier` takes **one miss**. The asymmetry is deliberate — a wrongly
promoted case is a detector that quietly stopped running.

| Case                                          | Tier       | Since      | History                                                                       |
| --------------------------------------------- | ---------- | ---------- | ----------------------------------------------------------------------------- |
| `groceries-blob-type-without-fanouts`         | `guard`    | 2026-09-07 | caught in all six runs                                                        |
| `export-envelope-drops-tasks`                 | `frontier` | 2026-09-07 | promoted on four catches, demoted on the miss in run 34105977391 the same day |
| `groceries-ui-written-against-absent-roles`   | `frontier` | 2026-09-07 |                                                                               |
| `sync-bookmarks-without-restore-or-meta-push` | `frontier` | 2026-09-07 |
| `release-bump-leaves-generated-client-stale`  | `frontier` | 2026-09-07 |
| `signup-password-wrapper-inside-formcontrol`  | `frontier` | 2026-09-07 |
| `import-confirm-is-bare-window-confirm`       | `frontier` | 2026-09-07 |
| `mail-test-setup-assigns-undefined-to-env`    | `frontier` | 2026-09-07 |

The tier and the evidence that earned it are in
`tools/config/review-golden-set.json`, asserted by `yarn review:golden:check`.

## Runs

Newest last. "Cases" is the tier replayed, not the whole set.

| Date       | Model             | Cases         | Result                      | Reviewer change under test                    |
| ---------- | ----------------- | ------------- | --------------------------- | --------------------------------------------- |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier)  | 1 of 3                      | none — first measurement                      |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier)  | 2 of 3                      | none — same skill, re-run                     |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier)  | 2 of 3                      | reach-through checks added to Standards brief |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier)  | 2 of 3                      | reach-through checks, re-run                  |
| 2026-09-07 | `claude-sonnet-5` | 7 (pre-tier)  | **2 of 7**, 2 of 8 findings | reach-through checks, full set                |
| 2026-09-07 | `claude-sonnet-5` | 8 (all tiers) | **1 of 8**, 1 of 9 findings | consequence checks added to Standards brief   |
| 2026-09-07 | `claude-sonnet-5` | 8 (all tiers) | **2 of 8**, 2 of 9 findings | consequence checks reverted                   |

Cost of the seven-case run: roughly $14 across seven reviewer sessions of 40
to 60 turns each.

### What the consequence checks measured

Run [34105977391](https://github.com/mnaimfaizy/myorganizer/actions/runs/34105977391).
The consequence checks did not work. Recall fell from 2 of 7 to 1 of 8, and the
case that changed direction changed the wrong way.

- **None of the five cases the checks were written from moved.**
  `groceries-ui-written-against-absent-roles` (check 1),
  `sync-bookmarks-without-restore-or-meta-push` (check 2),
  `release-bump-leaves-generated-client-stale` (check 3),
  `import-confirm-is-bare-window-confirm` (check 4) and
  `signup-password-wrapper-inside-formcontrol` (check 5) all still miss.
  Writing an instruction at a miss did not produce a catch.
- **`export-envelope-drops-tasks` regressed.** It had been caught four times
  running under the reach-through brief alone; here it missed, while producing
  four other findings. It is demoted to `frontier` by the rule.
- **The held-out case missed too.** `mail-test-setup-assigns-undefined-to-env`
  turns on a language semantic inside the hunk, and the reviewer did not raise
  it. So the miss is not confined to the reach-through class of defect.
- Every failing case produced a **valid report with other findings in it**, two
  to eight of them. None of these is a rejected report or a scoring artefact,
  and none is the incident.

Two readings survive this run, and one run cannot separate them. **Dilution**:
the brief roughly doubled in length, and the reach-through instruction now
competes with five more, which would explain the one regression precisely.
**Variance**: `export-envelope-drops-tasks` now reads
`missed, caught, caught, caught, caught, missed` — four of six — and a single
run of a stochastic reviewer was never going to settle it.

What the run does settle is that the consequence checks bought nothing
measurable on the cases they were written for, at the cost of doubling the
brief. The parsimonious next step is to remove them and re-measure, not to
shorten them; a second instruction class that helps should show something on
its first eight cases.

The Opus bake-off is now more interesting, not less. If instruction volume is
what hurt, a stronger model is the cleaner test of whether the misses are
capability at all.

### What the revert measured

Run [34117988776](https://github.com/mnaimfaizy/myorganizer/actions/runs/34117988776),
on a brief byte-identical to the one the 2-of-7 baseline was taken on. Recall
returned to **2 of 8**, and the case that moved is the same one that moved
before, in the opposite direction: `export-envelope-drops-tasks` is caught
again.

Every other case is unchanged across the two runs. The two arms differ by one
case, and it is the case the reach-through brief was written for.

`export-envelope-drops-tasks` now reads, in order: missed, caught, caught,
caught, caught (reach-through brief) — missed (consequence checks added) —
caught (checks reverted). Five catches in six runs under the shorter brief,
zero in one under the longer one. That is consistent with dilution and does not
prove it: each arm is a single run at the eight-case size, and the reviewer is
stochastic. It is enough to keep the brief short, which is what the revert did.

What both runs agree on is more important than what separates them. Six of the
eight cases miss under either brief, and the five misses the consequence checks
were written to address are exactly the six-minus-one that never moved. Two
instruction classes have now been tried against them and neither produced a
catch. The next lever is not a third instruction class.

`mail-test-setup-assigns-undefined-to-env` missed in both runs. It was added as
a held-out case, and it holds: whatever is wrong is not specific to the
reach-through class of defect.

The case stays `frontier`. Promotion takes three consecutive catches and it has
one, which is the asymmetry doing its job rather than an oversight.

## Reproduce

```bash
yarn review:golden:check
```

Run the replay from the Actions tab — the **Golden Replay** workflow takes a
`tier` input (`frontier`, `guard`, or `all`). On a pull request it runs by
itself: frontier cases on any review-tooling change, guards only when the brief
or the finding contract changes. `[skip replay]` in the head commit message
skips it for that push; `CODE_REVIEW_ENABLED=false` stops it entirely.
