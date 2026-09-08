# A golden case earns its replay frequency

## Status

accepted

## Context

[ADR 0071](0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md) gave
the reviewer a regression test of its own: the golden set, commit ranges from this repository's
history in which a documented incident merged, replayed one reviewer session per case whenever
anything that produces a review changes. The set has eight cases and the first record
([the 2026-09-07 baseline](../research/2026-09-07-golden-replay-baseline.md)) reports two catches
in seven, at roughly $14 per run.

Two facts about that arrangement were discovered by running it.

**A `pull_request` path filter cannot narrow per push.** GitHub matches it against the whole pull
request diff — the three-dot comparison against the merge base — not against the push that fired
the event. So once any commit in a pull request touches a filtered path, every later push
re-satisfies the filter for the life of that branch. On pull request #682 the commit `0e590e5`,
which added one research Markdown file and nothing else, ran the full seven-case replay plus a
full review. The path filter reads like a cost control and is not one.

**The cases are not doing the same job.** After the reach-through brief, two cases are caught in
every run and five are missed in every run. A caught case carries almost no new information per
run — it reports that something still works. A missed case is the entire reason to run. But the
caught ones cannot simply be deleted: they are the only detector that would notice a brief edit
silently undoing the one instruction that demonstrably works.

Costs compound in one direction. Every case added to the set is a reviewer session added to every
run, forever, while the archaeology to attribute a case is paid once. The set therefore grows a
standing tax unless something bounds it.

## Decision

**A golden case's replay frequency is earned by its measured behaviour, and a push can decline a
replay it knows is pointless.**

1. **Two tiers, in the set itself.** Every case carries `tier: "guard" | "frontier"`, asserted by
   `yarn review:golden:check`. A **frontier** case is one the reviewer misses; it is the reason to
   run the replay, and it runs on any change to the paths that produce a review. A **guard** case
   is one the reviewer catches reliably; it runs only when the Standards brief
   (`.agents/skills/code-review/**`, `.github/actions/code-reviewer/**`) or the finding contract
   (`tools/scripts/review/schema.mjs`, `validate-review-report.mjs`) changes, because those are what
   could silently undo the instruction the guard protects.

2. **Promotion is asymmetric and cited.** Promotion to `guard` takes **three consecutive catches**,
   named in the case's `tierEvidence` with the runs that earned them; the validator refuses a guard
   without it. Demotion to `frontier` takes **one miss**. A wrongly promoted case is a detector that
   quietly stopped running, so falling back is cheap and staying promoted is expensive. The export
   envelope case — `missed, caught, caught, caught, caught` — is why one catch is not enough.

3. **`[skip replay]` in the head commit message skips the replay for that push.** It is read from
   the API by SHA, never from the checkout, because a `pull_request` checkout is a synthetic merge
   commit whose message is not the author's. It skips the replay only: the ordinary review still
   runs, so the escape cannot be used to land a change unreviewed. `Golden Replay` reports success
   rather than pending, so it never blocks a merge.

4. **`workflow_dispatch` replays a tier on demand**, so a measurement can be taken deliberately
   rather than by arranging for a qualifying push.

5. **The numbers are kept current; the reasoning is frozen.** Run results and the tier table live in
   [`docs/review/golden-replay-results.md`](../review/golden-replay-results.md), appended per run.
   Interpretation — why a case missed, what a brief change did — is a dated Research Brief under
   `docs/research/`, frozen at its date ([ADR 0041](0041-internal-notes-have-homes.md)). The record
   ADR 0071 gates its final step on is the pair, not either alone.

6. **The replay measures the model that reviews.** Both workflows read `CODE_REVIEW_MODEL`; the
   replay follows production rather than being pinned separately. A replay run on a model no pull
   request receives certifies a reviewer nobody gets. Comparing models is a deliberate,
   `workflow_dispatch`-driven experiment, recorded as its own run rows — not the default.

## Consequences

A docs-only push to a review-tooling branch costs one review instead of a review plus eight
replays. An ordinary review-tooling change costs six frontier sessions instead of eight. The full
set runs when the brief or the contract changes, which is when it is worth its price.

The set gains a bound it did not have: as the brief improves, cases migrate from frontier to guard
and the recurring cost falls rather than rises. A set with no frontier case left is measuring
nothing, and the tests assert that at least one remains.

`schemaVersion` moves to `2`. `tier` is required on every case, so no golden set from before this
decision loads — deliberate, since a case with no tier has no defined frequency.

Two things this does not do. It does not make `Agent Verdict` a required check; ADR 0071 still gates
that on the record, and the record's first entry says two of seven. And `[skip replay]` is a
judgement a human makes in a commit message, which means it can be wrong — the mitigation is that
the frontier is cheap enough to run when unsure, not that the escape is safe.

> **Amended by [ADR 0073](0073-a-required-check-is-a-fact-about-the-pipeline-not-a-judgment-about-the-diff.md).**
> The first sentence above described the required-check question as open and waiting on the record.
> It is closed. ADR 0073 decides `Agent Verdict` is advisory permanently, on the ground that a check
> may assert a fact about the pipeline but not a judgment about the diff — so no recall number
> reopens it. The replay's purpose is unchanged: it measures the reviewer, which is worth knowing
> whether or not anything gates on it.

## Alternatives considered

- **Move the replay to a nightly or 48-hourly schedule.** Rejected. The replay's input changes a
  few times a year; a timer would re-measure an untouched reviewer daily, at a large standing cost,
  and would decouple a score movement from the diff that caused it. The per-push cost was the real
  complaint, and tiering plus `[skip replay]` addresses it without giving up the "measured before it
  reaches a real pull request" property that made the replay a gate.

- **Pin the replay to a stronger model than production.** Rejected as a default; kept as an
  experiment. It would certify a reviewer no pull request receives, and ADR 0071 gates a required
  check on that certification.

- **`[skip ci]` instead of a bespoke token.** Rejected. GitHub honours it on `pull_request`, but it
  skips every workflow on that push — CI and the reviewer included — and documented behaviour is
  that the skipped checks "remain in a 'Pending' state," blocking merge on any required check.

- **A `skip-replay` pull request label.** Rejected. It is pull-request-wide rather than per-push, so
  it must be applied before a push and removed after; a ritual people forget, and forgetting it is
  expensive in exactly the direction this decision is trying to avoid.

- **Derive the tier from replay history rather than a field.** Rejected for now. It needs a
  persistent scoreboard CI writes and reads, which is more machinery than eight cases justify, and
  it would make the set's behaviour depend on a file no reviewer of the set can see.

- **Prune by axis instead of tiering** — keep one of the two fan-out cases and spend the slot
  elsewhere. Rejected. The two have different shapes, a blob type and an export envelope, and the
  export one is the more sensitive detector precisely because it is the one that flickered.
