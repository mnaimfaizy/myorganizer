# Golden replay results

**Kept current.** This file is the running record ADR 0070 asks for: "the ADR
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
([ADR 0071](../adr/0071-a-golden-case-earns-its-replay-frequency.md)).
Promotion to `guard` takes **three consecutive catches**; demotion to
`frontier` takes **one miss**. The asymmetry is deliberate — a wrongly
promoted case is a detector that quietly stopped running.

| Case                                          | Tier       | Since      |
| --------------------------------------------- | ---------- | ---------- |
| `groceries-blob-type-without-fanouts`         | `guard`    | 2026-09-07 |
| `export-envelope-drops-tasks`                 | `guard`    | 2026-09-07 |
| `groceries-ui-written-against-absent-roles`   | `frontier` | 2026-09-07 |
| `sync-bookmarks-without-restore-or-meta-push` | `frontier` | 2026-09-07 |
| `release-bump-leaves-generated-client-stale`  | `frontier` | 2026-09-07 |
| `signup-password-wrapper-inside-formcontrol`  | `frontier` | 2026-09-07 |
| `import-confirm-is-bare-window-confirm`       | `frontier` | 2026-09-07 |
| `mail-test-setup-assigns-undefined-to-env`    | `frontier` | 2026-09-07 |

The tier and the evidence that earned it are in
`tools/config/review-golden-set.json`, asserted by `yarn review:golden:check`.

## Runs

Newest last. "Cases" is the tier replayed, not the whole set.

| Date       | Model             | Cases        | Result                      | Reviewer change under test                    |
| ---------- | ----------------- | ------------ | --------------------------- | --------------------------------------------- |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier) | 1 of 3                      | none — first measurement                      |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier) | 2 of 3                      | none — same skill, re-run                     |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier) | 2 of 3                      | reach-through checks added to Standards brief |
| 2026-09-07 | `claude-sonnet-5` | 3 (pre-tier) | 2 of 3                      | reach-through checks, re-run                  |
| 2026-09-07 | `claude-sonnet-5` | 7 (pre-tier) | **2 of 7**, 2 of 8 findings | reach-through checks, full set                |

Cost of the seven-case run: roughly $14 across seven reviewer sessions of 40
to 60 turns each.

### Not yet run

The consequence checks added on 2026-09-07 have **not** been measured. The
next replay is their first measurement, and it is the one that decides whether
the Opus bake-off is worth running: if the checks move Sonnet substantially,
the misses were instruction rather than capability and a stronger model buys
little. Run the bake-off, if at all, on the cases that still miss after that —
a case Sonnet already catches cannot distinguish two models.

Note that five of the eight cases were the source of those checks, so the next
run is partly a mirror. `mail-test-setup-assigns-undefined-to-env` was added as
a held-out case for exactly this reason: it turns on a language semantic inside
the hunk, which none of the consequence checks addresses.

## Reproduce

```bash
yarn review:golden:check
```

Run the replay from the Actions tab — the **Golden Replay** workflow takes a
`tier` input (`frontier`, `guard`, or `all`). On a pull request it runs by
itself: frontier cases on any review-tooling change, guards only when the brief
or the finding contract changes. `[skip replay]` in the head commit message
skips it for that push; `CODE_REVIEW_ENABLED=false` stops it entirely.
