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

| Case                                          | Tier       | Since      | History                                                                                       |
| --------------------------------------------- | ---------- | ---------- | --------------------------------------------------------------------------------------------- |
| `groceries-blob-type-without-fanouts`         | `guard`    | 2026-09-07 | caught in all six runs                                                                        |
| `export-envelope-drops-tasks`                 | `frontier` | 2026-09-07 | promoted on four catches, demoted on the miss in run 34105977391; missed again in 34171728640 |
| `groceries-ui-written-against-absent-roles`   | `frontier` | 2026-09-07 |                                                                                               |
| `sync-bookmarks-without-restore-or-meta-push` | `frontier` | 2026-09-07 |
| `release-bump-leaves-generated-client-stale`  | `frontier` | 2026-09-07 | caught once, in 34171728640                                                                   |
| `signup-password-wrapper-inside-formcontrol`  | `frontier` | 2026-09-07 |
| `import-confirm-is-bare-window-confirm`       | `frontier` | 2026-09-07 |
| `mail-test-setup-assigns-undefined-to-env`    | `frontier` | 2026-09-07 |

The tier and the evidence that earned it are in
`tools/config/review-golden-set.json`, asserted by `yarn review:golden:check`.

## Runs

Newest last. "Cases" is the tier replayed, not the whole set.

| Date       | Model             | Cases          | Result                      | Reviewer change under test                    |
| ---------- | ----------------- | -------------- | --------------------------- | --------------------------------------------- |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier)   | 1 of 3                      | none — first measurement                      |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier)   | 2 of 3                      | none — same skill, re-run                     |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier)   | 2 of 3                      | reach-through checks added to Standards brief |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier)   | 2 of 3                      | reach-through checks, re-run                  |
| 2026-09-07 | `claude-sonnet-5` | 7 (pre-tier)   | **2 of 7**, 2 of 8 findings | reach-through checks, full set                |
| 2026-09-07 | `claude-sonnet-5` | 8 (all tiers)  | **1 of 8**, 1 of 9 findings | consequence checks added to Standards brief   |
| 2026-09-07 | `claude-sonnet-5` | 8 (all tiers)  | **2 of 8**, 2 of 9 findings | consequence checks reverted                   |
| 2026-09-08 | `claude-sonnet-5` | 8 (all tiers)  | **2 of 8**, 2 of 9 findings | none — same brief, on `main` as base          |
| 2026-09-08 | `claude-sonnet-5` | 7 (`frontier`) | **void** — rate-limited     | none — first tier-selected run                |

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

### The same score, a different pair

Run [34171728640](https://github.com/mnaimfaizy/myorganizer/actions/runs/34171728640),
on the reverted brief again, with `main` as the base rather than a stacked
branch. **2 of 8 again — and not the same two.**
`release-bump-leaves-generated-client-stale` was caught for the first time in
four attempts; `export-envelope-drops-tasks`, caught in the run immediately
before, missed.

That is the clearest statement of variance the record holds. Same brief, same
set, same model, same score, different cases. It also settles how much weight
the 1-of-8 run can carry: a single run moves a case in either direction, so the
consequence-check result was suggestive and never conclusive. The revert stands
on parsimony — the checks bought nothing measurable — not on that one number.

No case earns promotion. `export-envelope-drops-tasks` has now missed twice in
three runs and stays `frontier`; `groceries-blob-type-without-fanouts` is caught
in all seven and remains the only `guard`.

The practical consequence for anyone reading this table: **do not act on a
single run.** A brief change that matters should show itself across several, and
the cheapest way to see that is the frontier tier, not the whole set.

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

### The frontier alone, and a run that measured nothing

Run [34176461268](https://github.com/mnaimfaizy/myorganizer/actions/runs/34176461268)
is the first run the tier filter selected: seven `frontier` cases, no `guard`.
That part worked exactly as designed — `golden-tiers.mjs` chose the tier from a
job with no dependencies installed, which is the thing no local test could
prove.

**Its score is void, not zero.** Every one of the seven sessions was cut off by
the five-hour subscription window, which the transcripts record as
`rate_limit_event` with `status: rejected` and `five_hour.utilization: 1`. Four
sessions died mid-review at 11 to 27 turns, against the 40 to 60 a finished
review takes. Three never reached their first turn. No case in this run was
measured, and none of it belongs in the recall history.

It was very nearly recorded as `0 of 7`. Seven check names read
`Replay <case> — failure`, which is what a run of seven misses looks like from
the outside, and the first version of this section drew exactly that conclusion.
The transcripts are the only place the difference is written down. That is now
a pipeline behaviour rather than a habit: the reviewer action reads its own
transcript, and a rate-limited case fails with `measured nothing` instead of
being scored.

#### What it does measure: the budget

This is the clearest data the repository has on what a replay costs, and the
answer is that the binding constraint is not money.

- **Seven parallel Sonnet sessions exhausted the five-hour window**, at
  `max-parallel: 4` — a limit added after eight-at-once had already lost a run,
  and evidently still too high when the window is not empty at the start.
- The **seven-day** window was at 6% at the moment the five-hour window hit
  100%. Nothing here is a weekly-quota problem.
- The four sessions that ran cost **$6.00** between them before being cut off,
  against roughly $14 for a complete seven-case run.
- Overage was unavailable (`org_level_disabled`), so the window does not
  degrade gracefully. It stops.

The practical consequences are worth stating, because they apply to the reviewer
as much as the replay:

1. **A replay competes with everything else on the same subscription.** The
   token is the maintainer's; a full-set replay can lock the maintainer out of
   their own session, and did.
2. **A replay must start from a known-empty window**, or be small enough to fit
   what is left. There is no way to ask, so in practice this means dispatching
   it deliberately rather than letting a push trigger it.
3. **An Opus replay of the full set is not affordable on this plan.** Seven
   Sonnet sessions already reach 100%. The dispatch-only `model` input exists so
   a bake-off can be run on two or three cases without switching every per-PR
   review to that model, and two or three cases is the honest size.

#### And what it means for the open questions

The frontier arm's measured history is therefore **0, 1, 1** catches out of
seven across three valid runs, not four — roughly one case in seven, with a
spread that swallows any single result.

- **The tier split is earning its keep.** One case is a detector; seven are a
  measurement, and the measurement is expensive enough to lock the window.
- **"Which brief is better" is not answerable at this sample size.** Separating
  one-in-seven from two-in-seven needs repetitions this budget will not pay for.
  Two brief changes have now been recorded as inconclusive; a third would be the
  same result again.
- **A single Opus pass would not settle the model question either.** At 0 to 1
  catches per run, an Opus run scoring 2 of 7 sits inside the Sonnet spread.
  What a small bake-off can settle cheaply is the different question of whether
  these findings are reachable from the brief at all — and the transcripts of
  the four sessions that did run are worth reading before spending anything,
  because they are free.

No case moves tier, in either direction. A void run promotes nothing and demotes
nothing.

## Reproduce

```bash
yarn review:golden:check
```

Run the replay from the Actions tab — the **Golden Replay** workflow takes a
`tier` input (`frontier`, `guard`, or `all`). On a pull request it runs by
itself: frontier cases on any review-tooling change, guards only when the brief
or the finding contract changes. `[skip replay]` in the head commit message
skips it for that push; `CODE_REVIEW_ENABLED=false` stops it entirely.
