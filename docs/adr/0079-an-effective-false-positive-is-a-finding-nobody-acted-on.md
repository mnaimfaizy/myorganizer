# 0079 — An effective false positive is a finding nobody acted on

- Status: proposed
- Date: 2026-09-11
- Deciders: maintainers
- Issue: #729 (PRD #713)

## Context

[ADR 0077](0077-an-escaped-defect-is-one-the-reviewer-saw-and-passed.md) measures
what the reviewer misses. It says nothing about what the reviewer costs, and a
reviewer nobody acts on is unusable at any recall: the findings pile up under
every Pull Request, the reader learns to scroll past the section, and the one
finding that mattered is scrolled past with the rest. The published accounts of
static analysis at scale name this — not recall — as the failure mode that
kills a tool.

The obvious measurement — "what fraction of findings were wrong?" — cannot be
taken. It needs a human to label every comment, which is a ritual nobody
sustains, and the labels would be the opinion of whoever was on the Pull
Request that day. The measurement that can be taken is what a finding _does_:
it was raised, and on the next push it is either gone or still there.

Google's Tricorder took the same turn and named it. An issue is an "effective
false positive" if "developers did not take some positive action after seeing
the issue", and an analyzer stays on by default only while it produces fewer
than 10% of them (_Software Engineering at Google_, ch. 20; Sadowski et al.,
ICSE 2015). Their mechanism is a "Not useful" button, which is a labelling
ritual; the definition, however, is about action and not about correctness,
and that part transfers without the button.

One precondition had to land first. A rate over "was it still there?" is
arithmetic over finding identity, and this repository's finding identity was
broken until recently: free-form `rule` prose put the persisting count at zero
in 38 of 38 consecutive reports (issue #718), and the `source` that replaced it
collapsed twelve Fowler smells into one identity (issue #724). Run over that
history, this measurement would not have been noisy — it would have reported a
perfect 0% for every rule, because every finding's id changed on every push and
every finding therefore looked acted on.

## Decision

1. **Inaction is the signal, and correctness is not the question.** A finding
   raised on one push and still present on the next counts against its rule,
   whether or not the finding was right. This is deliberately
   counter-intuitive: a correct finding nobody acts on costs the same attention
   as an incorrect one, and the alternative question cannot be answered without
   a human labelling every comment. Nothing in this measurement records whether
   a finding was true.

2. **The unit is an observation, not a finding.** One finding across three
   pushes is two observations, both ignored, because it cost attention on each
   push. It follows that the signal is what a finding does _between consecutive
   pushes_, which is why the review runs on every push. Debouncing the reviewer
   has been considered as waste and is refused here: it would remove the
   measurement.

3. **Every observation lands in exactly one class, including the ones that say
   nothing.** `acted-on` and `ignored` are the fraction. `pending` (raised on
   the newest push, nothing to compare against), `unreadable` (the next push
   stored no report) and `incomparable` (the two reports are of different
   report schema versions) are set aside by name and counted. A denominator is
   only worth reading if nothing was filtered out of it silently.

4. **An opt-out marker exists, names finding ids, and is never required.** A
   line `Review-ack: <finding id>` in a commit message takes that finding out
   of the numerator. It is for the case where the author read the finding,
   agrees with it, and is deliberately not acting now — inaction that is not
   silent. It names the 12-character finding id the report prints under every
   finding, never a rule id: an id can only have come from the finding itself,
   while a rule id would excuse findings the author never saw and would zero a
   rule's rate in one line. It is written once and **holds for as long as the
   finding it names survives**, because a marker you must re-type on every
   push is the labelling ritual this measurement exists to avoid; it is never
   applied backwards, so inaction already observed stays observed. An
   acknowledged observation is set aside from the denominator as well, because
   counting it as a positive action would let a commit message manufacture
   evidence _for_ a rule.

5. **The budget is 10% per rule, written down, with its source.** It is
   Google's number against Google's definition, borrowed whole rather than
   invented: it is the only published noise threshold that arrives with a
   mechanism attached. The numerators are not identical — theirs requires a
   click, so somebody read the finding; ours counts a finding nobody opened —
   and which way that bias runs is unmeasured, which is why the budget is a
   marker to read the rate against rather than a threshold anything acts on. A
   rule is judged against it only above ten observations, because below ten a
   single ignored finding is already over ten percent.

6. **Nothing is disabled by this measurement.** Not automatically, and not by
   any mechanism built in this slice. The automatic disable needs a month of
   data before its threshold means anything, and it is a follow-up (the slice
   this one blocks). Until then the rate is published and read by people.

7. **The rate is meaningless before finding identity is stable, and it is
   dated from that point.** Only pairs where both stored reports carry the
   current report schema version are observed; anything older is
   `incomparable`. The identity this rests on is `axis + ruleId + file` as
   fixed by issue #718 and issue #724, and no measurement is quoted against a
   window that predates them.

8. **It is not a gate.** It reads weeks of other branches' pushes, downloads
   artifacts over the network, and has no fact to assert about the commit in
   front of it, so it carries a written opt-out in
   `tools/config/gate-coverage-optout.json` under the Meta-Gate's own rule
   ([ADR 0043](0043-gates-assert-facts.md)) — a declared non-gate with a
   reason, not a silent exemption.

## Consequences

- **The number cannot be reported yet, and the reason is structural rather
  than incidental.** No stored artifact carries the current report schema
  version — it lands with the change that introduces this measurement — so
  every pair available today is `incomparable` by construction
  ([the 2026-09-11 brief](../research/2026-09-11-inaction-needs-a-stable-identity.md)).
  The running record is
  [`effective-false-positive-rate.md`](../review/effective-false-positive-rate.md).
- **The measurement depends on an artifact with a 30-day life.** The review
  uploads `code-review-normalized` with `retention-days: 30`, so a window
  older than that cannot be gathered again. `--save-gather` writes the
  evidence to a file, and a saved gather is the only durable record of a
  window that has expired.
- **A rule that raises few findings is never judged.** That is the floor
  working: it means the first months of the record will carry rules that are
  reported and not judged, and a reader must not read
  `insufficient-evidence` as `within-budget`.
- **The reviewer keeps running on every push**, and the cost of that is now
  attributable to something. Any future proposal to debounce it has to say
  what happens to this measurement.

## Alternatives considered

- **Ask a human whether each finding was correct.** Rejected: it is the
  measurement everybody wants and nobody sustains, and it would replace a fact
  about what happened with an opinion recorded under time pressure. Google
  ships the button and still defines the rate by action.
- **Count a finding once per lifetime instead of once per push.** Rejected: it
  under-weights exactly the findings that cost the most — the ones that sit
  under a Pull Request for ten pushes — and it needs a notion of "the same
  finding across a branch" that the identity tuple does not promise.
- **Let the marker name a rule id.** Rejected as item 4 says: it excuses
  findings nobody read, including ones raised after it was written.
- **Count an acknowledged finding as acted on.** Rejected: it would let one
  line of commit message improve a rule's rate, which is worth more to a noisy
  rule than to a good one. Setting it aside keeps the marker able only to
  remove evidence, never to create it.
- **Disable a rule over budget, now.** Rejected: with no data the threshold
  would be acting on noise, and a disabled rule is a finding nobody ever sees
  again. The disable waits for a month of measurement, which is the follow-up
  slice.
- **Debounce the review to the last push of a burst.** Rejected: it is the one
  change that makes this measurement impossible, and it trades a real cost for
  an unmeasurable one.
