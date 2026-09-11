# A citation that does not match its source is a fact about the pipeline

## Status

proposed

## Context

[ADR 0073](0073-a-required-check-is-a-fact-about-the-pipeline-not-a-judgment-about-the-diff.md)
drew the line this decision stands on: a check may assert a fact about the pipeline and may never
assert a judgment about the diff. `Agent Review Ran` is the first kind — the reviewer crashed, was
cut off, or wrote a report the contract rejected. `Agent Verdict` is the second, and is advisory
for good.

The obligation apparatus was built on the other side of that line. A selector matches
[the review checklist](../review/REVIEW_CHECKLIST.md) against the diff outside the model and hands
the reviewer a worklist of sites with a question it must answer in writing
([`tools/config/review-obligations.json`](../../tools/config/review-obligations.json)).
Completeness is reported and fails nothing, on the reasoning that an unanswered obligation is a
fact about the review's thoroughness and not about either the pipeline or the diff.

Run 45 measured what that buys, and the transcripts are decisive
([2026-09-10](../research/2026-09-10-the-answer-sheet-is-inert.md)). On
`signup-password-wrapper-inside-formcontrol` the selector fired on all seven `FormControl` sites in
the file, including the two the incident is about, and the reviewer wrote an answer for every one.
For those two it recorded the direct child as `Input`; the source at those lines is a positioning
`div`. Five sites answered truthfully, two falsely, and the two false ones are exactly the sites
where the truthful answer produces a finding. On `import-confirm-is-bare-window-confirm` it wrote
`namesEverything: false` — which that entry's own `defect` field calls a finding in as many words —
and then raised nothing.

Neither is a trigger failure, an enforcement failure, or a wording failure. **A written answer is
not a verified answer**, because nothing compared the writing to anything. Presence was never the
weak point: `"Input"` is a perfectly non-blank string, and the completeness report called both
sheets complete.

Two questions were left open by that brief. Whether the self-contradiction should block was
recorded as undecided, with `continue-on-error: true` kept on the workflow step until it was
settled deliberately. Whether a quotation could be checked at all was recorded as unbuilt.

## Decision

**An obligation answer cites rather than asserts, and a citation that does not match its source
fails the pipeline check.**

1. **Every answer field that makes a claim about source carries a citation.** The catalogue names
   those fields in `citedFields`, and the answer carries the file, the line, and the literal text
   at that line. A field whose honest answer points at no line names that one value as
   `uncitedWhen`: `wiredBy: "none"` says nothing invokes the gate, and nowhere has no line. Every
   other answer must quote one.
2. **The check reads the quoted line out of the tree at the reviewed head and compares it.** Three
   ways it fails: the file is not there at head, the line is past the end of the file, or the text
   differs. Comparison is on collapsed whitespace, so re-indentation is the same line and different
   content is not — and for that reason a quotation that collapses to nothing is refused outright,
   because `" "` would otherwise match every blank line in the tree and satisfy a citation without
   reading anything.
3. **A mismatch is a fact about the pipeline, not a judgment about the diff.** It says the
   reviewer's own answer sheet does not hold up. That is the `Agent Review Ran` kind of fact,
   alongside "wrote a report the contract rejected", and it is emphatically **not a finding**: a
   finding is about the code under review, is addressed to the author, and blocks on evidence
   (ADR 0071). Nobody should have to read a report entry about the reviewer's arithmetic.
4. **A self-contradiction blocks for the same reason, and that question is now closed.** An answer
   meeting its obligation's own `defectWhen` while raising no finding is not a judgment the
   reviewer is entitled to make: the catalogue entry already decided that answer is a finding. Like
   a mismatched citation, it is a comparison between two artifacts, not an opinion about the code.
5. **The workflow step no longer continues on error.** Every step after it in the reviewer's job is
   `always()`, so a failed answer sheet still renders, still uploads its artifacts, and still
   publishes whatever findings the reviewer did produce. Removing `continue-on-error` alone would
   have skipped the artifact the publisher reads, which would have turned a bad answer sheet into a
   silently unpublished review — the failure mode ADR 0073 exists to prevent, arriving through a
   different door.
6. **What this does not do.** A quotation can be true about the wrong line: quoting the `<Input>`
   line while claiming it is the direct child still passes. Checking that the quotation _supports_
   the claim is judgment, and a predicate language rich enough to express it would be a second
   reviewer. What is bought is narrower and real — the three facts in a citation are checkable by a
   reader, so an answer can no longer be invented at zero cost.

## Consequences

The reviewer must read the line it writes about. That is the point, and it is also the cost: a
citation is turns, and the turn budget is already the scarcest thing in a replay
([the results record](../review/golden-replay-results.md)).

A failed answer sheet fails `Agent Review Ran`, which is the check eligible to be required, and
skips `Agent Verdict`, which reads `needs.review.result == 'success'`. The review comment is still
posted. A pull request in that state is a pull request whose review was published and whose
reviewer is not trusted on the obligations — which is a more useful thing to see than a green tick.

The escape hatch stays open and is named here rather than left to be rediscovered: a reviewer low
on turns is told to skip the answer sheet entirely, and a run with no sheet fails nothing. A
reviewer that would rather not be checked can therefore write nothing instead of writing something
false. That is a worse review and a visible one — the sheet is uploaded, and its absence is in the
step log. Closing it means deciding that an unanswered obligation blocks, which is the
thoroughness question this ADR deliberately does not reopen.

`checkAnswers` refuses to run when a worklist carries cited fields and no reader of the tree was
supplied, rather than reporting every sheet sound. A citation check with nothing to compare against
is the silent no-op shape this repository keeps rediscovering, and it would be indistinguishable
from the state run 45 was in.
