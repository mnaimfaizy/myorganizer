# A replay whose answer sheet fails its check measured nothing

## Status

accepted

## Context

Golden Replay run [35833576958](https://github.com/mnaimfaizy/myorganizer/actions/runs/35833576958)
(pull request #884) scored `release-bump-leaves-generated-client-stale` as a miss. The miss was a
suppression. The worklist handed the reviewer `package.json:3` with `coveringGate: openapi:check`.
The reviewer answered `wiredBy` by citing `.github/workflows/ci.yml:527` as
`run: corepack yarn openapi:check`, and raised nothing. That line exists in the pull request's
checkout. At the case head `8175cb6` it is `timeout-minutes: 30`
([the results record](../review/golden-replay-results.md), "A miss that quoted the wrong tree").

`yarn review:obligations:check` exists for exactly this. It reads a quoted line out of the tree at
the reviewed head and compares it
([ADR 0078](0078-a-citation-that-does-not-match-its-source-is-a-fact-about-the-pipeline.md)). Run
over that run's artifacts, it exits 1. In `code-review.yml` that exit fails `Agent Review Ran` as
a pipeline fault. `review-golden-replay.yml` uploaded the answer sheet and never ran the check. So
the replay recorded as a measurement of recall a run that production would have refused to trust.

The replay already has a class for runs that measured nothing: the rate-limit lockout, the turn
ceiling, and the prevented measurement. Each one fails the case, says so in its own words, and is
never written into the record as a miss, because a miss demotes a guard under
[ADR 0072](0072-a-golden-case-earns-its-replay-frequency.md). The open question was which side of
that line a failed answer sheet falls on.

## Decision

**A replay whose obligation answer sheet fails `review:obligations:check` is a void. It is not a
miss and not a catch.**

1. **The replay runs the check as production does.** It uses the same script, the same worklist,
   and the same `--report tmp/code-review/report.json`. It runs after `Require a validated report`
   and before `Score the case`. The check reads the head recorded in the worklist, which is the
   case head. It does not read the checkout, which is the pull request's head.
2. **Exit 1 and exit 2 are both voids.** Production gates on both (ADR 0078 item 5). A replay that
   treated either one more leniently would be measuring a different pipeline from the one it
   exists to predict.
3. **A void is not scored.** The score step runs only on success, so after a failed sheet it does
   not run. The case fails with an error naming the void and this ADR. The failure is visible. The
   case never records a recall number, and the summary never lists a miss.
4. **The void holds in both directions.** A run whose report caught every expected finding is still
   a void if its answer sheet failed, because production would fail `Agent Review Ran` on that run
   as well. The verdict does not change that. Scoring the lucky runs and voiding the unlucky ones
   would make the void a filter that flatters recall.
5. **No sheet and no worklist fail nothing,** as in production. Whether an obligation got an
   answer is a question of thoroughness, and ADR 0078 leaves that question closed.
6. **`yarn review:golden:check` asserts the wiring.** It reads the replay workflow. It fails when
   no step runs the check, when the check runs after the score, when the check does not pass
   `--report`, when the check continues on error, or when the score step carries an `if:` that
   could run it after a failure. Each of those brings the void back as a miss. Deleting the step
   would otherwise pass every other check the replay has
   ([ADR 0074](0074-a-gate-suppresses-a-finding-only-if-something-runs-it.md)).

## Consequences

Run 35833576958's miss should be read as a void. The case stays `frontier`. It was `frontier`
already, so no tier moves.

A reviewer could avoid misses by writing false citations. That would turn every run into a void,
and every void fails the case. So false citations can't make the reviewer look better. They make
it look unmeasured, and the step log says so.

The check only helps when it reads the right tree. The second gap the results record names is
still open: the replay's working tree is the pull request's head, and the reviewer reads standards
and sources from it. This decision catches the symptom when it reaches a citation, and it does
nothing when the contamination never reaches one. Making the case head the reviewer's working
tree is a separate decision.
