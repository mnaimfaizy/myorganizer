# A true citation about the wrong gate: run 47's single miss

Frozen 2026-09-12. Numbers live in
[`docs/review/golden-replay-results.md`](../review/golden-replay-results.md);
this brief does not move.

## What ran

Run [34591297535](https://github.com/mnaimfaizy/myorganizer/actions/runs/34591297535),
the `Golden Replay` carried by pull request #733, which integrates PRD #713 —
reviewer containment, the allowlist check, the truncation outcome, the inverted
gate-coverage obligation, bounded rule identifiers, and cited obligation
answers, all measured together for the first time.

**Five of six.** `groceries-blob-type-without-fanouts` (guard),
`export-envelope-drops-tasks`, `import-confirm-is-bare-window-confirm`,
`mail-test-setup-assigns-undefined-to-env` and
`signup-password-wrapper-inside-formcontrol` were caught.
`release-bump-leaves-generated-client-stale` missed.

That is the highest recall in the record. It is also one run, and the record's
own rule applies unchanged: a single run of a stochastic reviewer is not a
measurement, promotion still takes three consecutive catches, and a single run
has moved a case in both directions before. Nothing here promotes anything.

## The miss is one word in one field

`score.json` for the missing case reports `recall: 0`, `matched: []`,
`unexpected: 0` — a clean miss, not an apparatus failure, not a rate-limit
void, not turn exhaustion. The reviewer produced a valid report that did not
contain the incident.

`obligations.answers.json` says why. The gate-coverage obligation fired on the
right site — `package.json` line 3, the version — and was answered:

```json
{
  "gate": "deploy:pages:check",
  "command": "not run",
  "exitCode": "not run",
  "wiredBy": ".github/workflows/ci.yml:705"
}
```

with the citation `"text": "        run: corepack yarn deploy:pages:check"`.

Every part of that answer is **true**. Line 705 really does invoke
`deploy:pages:check`. The citation comparison added by #727 read the line back
from the tree and matched it. `defectWhen` — `wiredBy` equals `"none"` — did
not fire, correctly, because that gate is wired.

The incident is about a different gate. A version bump embeds the version into
the OpenAPI spec and every generated client header, so the gate covering the
changed artifact is `openapi:check`, which at this case's head existed in
`package.json` and was invoked by no hook and no workflow. Name that gate and
`wiredBy` is `none`, the defect fires, and the case is caught.

## What that means for the obligation design

The 2026-09-10 brief
([the answer sheet is inert](2026-09-10-the-answer-sheet-is-inert.md)) found
that a written answer is not a verified answer: the reviewer wrote `"Input"`
where the source said `<div>`, and nothing compared the writing to anything.
Citation closed that. In this run the reviewer wrote nothing false.

It wrote something true about the wrong object. The failure moved from
**false assertion** to **wrong referent**, and citation cannot reach the
second, because a citation proves a claim about the thing named and says
nothing about whether the right thing was named.

The asymmetry is in the entry's own shape. Of its four fields, `wiredBy` is
cited and `gate` is not — and `gate` is the field that selects what everything
else is about. `defectWhen` reads `wiredBy`, so a truthful answer about a
wired gate produces no defect no matter which gate was chosen. The one free
choice in the entry is the one that decides the outcome.

Three shapes could close it, and this brief does not pick one:

1. **Cite `gate` too** — require the line in `package.json` that defines the
   named script. That proves the gate exists; it does not prove it is the one
   covering the changed artifact, so it narrows the gap without closing it.
2. **Remove the choice** — derive the covering gate from the changed path by a
   map outside the model, the way the obligation selector already matches
   triggers outside the model. Then `gate` stops being an answer and becomes
   part of the site.
3. **Answer every candidate** — enumerate each gate whose own trigger paths
   intersect the diff and answer `wiredBy` for all of them. The defect fires if
   any is `none`.

Shape 2 is the one consistent with why the selector exists at all: the entry
already decided that matching a trigger is not a judgement the reviewer gets
to make, and which gate covers `libs/api-specs/**` is the same kind of fact as
which files the trigger matched.

## What this run does not settle

Whether the other five catches are the interventions working or the spread. The
frontier arm's prior valid runs scored 0, 1, 1 and 1 of seven; this is five of
six. That is outside the observed spread, which makes it worth a second run
rather than a conclusion — and under the cadence set by #722 a measurement is
three dispatches, of which this is one.

Two cases moved to two consecutive catches
(`mail-test-setup-assigns-undefined-to-env`) and one
(`import-confirm-is-bare-window-confirm`, `signup-password-wrapper-inside-formcontrol`,
`export-envelope-drops-tasks`). None is promoted. The next dispatch is what
decides whether any of that holds.
