# Inaction needs a stable identity: the first effective-false-positive measurement

- Date: 2026-09-11
- Author: maintainers
- Issue: #729 (PRD #713)
- Status: frozen. The running record is
  [`docs/review/effective-false-positive-rate.md`](../review/effective-false-positive-rate.md);
  the decision is
  [ADR 0079](../adr/0079-an-effective-false-positive-is-a-finding-nobody-acted-on.md).

## The question

The effective-false-positive rate asks, per rule, what share of the findings
it raised were still there on the next push. The first run of it reports **not
measurable**. This brief is why, and what the answer says about the
measurement rather than about the reviewer.

## What was run

```bash
yarn review:noise:measure --days 30 --out tmp/noise.md --json tmp/noise.json
```

on `slice/729-code-review-trust-effective-false-positi`, window 2026-08-12 to
2026-09-11. The sandbox has no authenticated `gh`, so no workflow run was
listed and no stored report was downloaded. Evidence block, verbatim:

```
- review runs (gh): not read — no `gh`
- stored reports (gh, `code-review-normalized`): not read — no `gh`
- commit messages (git): not read — no runs to read them for
- artifact retention: 30 days; anything older is gone and cannot be re-gathered
```

Result: 0 branches, 0 pushes, 0 observations, rate not measurable, 0 rules
over budget.

## The finding: `gh` was not the binding constraint

An absent credential is the shallow reason, and fixing it would not have
produced a number. An observation requires two stored reports **at the same
report schema version**, because a finding id is only meaningful within one
(`isComparableReport`, `tools/scripts/review/schema.mjs`). The current version
is `3`, and version `3` is what carries `ruleId` in the identity tuple — the
change that landed in issue #724, in the same branch lineage as this
measurement. Nothing in CI history has stored a version `3` report, because
version `3` did not exist while those runs happened.

So every pair available today is `incomparable`, and it is `incomparable` by
construction rather than by accident. The class exists for exactly this: the
measurement reports the pairs it could not read instead of treating an
unreadable pair as a finding that went away.

**The earliest date any real measurement can start from is the day the
`ruleId` identity merges.** That is not an inconvenience to work around; it is
the precondition, and it is the reason this slice was sequenced after the two
that fixed identity.

## Why running it over the old history would have been worse than useless

The temptation is to point the measurement at the history that does exist —
the reports written at schema `1` and `2`, which are real reports about real
diffs — and take a first number from them. The result would have been a
**perfect 0% effective-false-positive rate for every rule**, and it would have
been entirely an artefact.

The evidence is already published. While a finding's identity included the
free-form `rule` sentence, the model reworded it every run, and the persisting
count was zero in 38 of 38 consecutive reports across four Pull Requests
(issue #718, recorded in
[ADR 0071](../adr/0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md)
item 6). Every finding's id changed on every push. This measurement classifies
a finding as `acted-on` when its id is absent from the next push's report — so
every finding, including the ones that were re-posted verbatim under a new id
on the very next run, would have been counted as acted on.

Two things follow, and the second is the uncomfortable one:

1. The rate is **meaningless before finding identity is stable**, which is
   ADR 0079 item 7 and the reason the slice is ordered where it is.
2. The most flattering number this measurement can produce — 0% noise,
   everywhere — is also the number a _broken_ identity produces. A trust
   measurement whose best-looking output is indistinguishable from its
   most-broken input has to say so out loud, in the record, permanently. It
   does: the running record carries this reading next to its first row, and
   the `incomparable` class keeps a schema-crossing pair from ever being
   counted as action.

The schema-version guard is what makes the second point safe rather than
merely noted. It is tested in both directions — an older report before a newer
one and a newer before an older — because the pairing is chronological and the
bump can be crossed either way when runs are re-gathered out of order.

## The second constraint: a 30-day window on the evidence

The measurement reads `code-review-normalized`, uploaded with
`retention-days: 30` (`.github/workflows/code-review.yml`). A window older
than 30 days cannot be gathered again, ever. The escaped-defect measurement
has no equivalent exposure — its evidence is git history and Pull Request
comments, which do not expire.

The mitigation built here is `--save-gather`, which writes every input the
pure measurement consumes to a file that `--gathered` replays. It is
mechanically the same split the escaped-defect script uses, but it is doing a
different job: there, a saved gather avoids re-reading the network; here, it
is the _only_ durable record of a window that has since expired. A month of
data for the follow-up disable therefore has to be gathered as it happens, not
reconstructed afterwards.

## What would move the number

- **Merge the `ruleId` identity, then let CI run.** Two consecutive reviewed
  pushes on one branch at schema `3` produce the first observation. A rule
  reaches a judgeable ten observations considerably later.
- **Nothing else.** In particular, no reviewer change is indicated by this
  result. It is a fact about the apparatus, and reading it as a fact about the
  reviewer is the error the `incomparable` class exists to prevent.

## What was deliberately not built

The automatic disable. It is named in ADR 0079 item 6 and in the running
record, and it stays a follow-up until a month of data exists — because a
threshold applied to an empty denominator disables rules on noise, and a
disabled rule is a finding nobody ever sees again.
