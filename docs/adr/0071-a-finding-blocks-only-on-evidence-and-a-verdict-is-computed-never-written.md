# A finding blocks only on evidence, and a verdict is computed, never written

## Status

accepted

## Context

[ADR 0070](0070-a-review-tier-is-a-fact-about-the-diff-and-a-gate-tier-is-a-decision-about-the-work.md)
lets a `review:agent` Pull Request merge on green checks plus an agent verdict with no `blocking`
finding. That sentence borrows a word the repo has not defined. `/code-review` today
([ADR 0017](0017-gated-pipeline-cap-and-slice-code-review.md)) returns two prose reports, one per
axis, whose smell baseline is documented as "always a judgement call" and whose findings carry no
severity, no evidence, and no shape a script could read. Nothing in it can be gated on, and nothing
in it can be measured against a later escaped defect.

The roadmap this repo is following asks for findings with file, line, severity, confidence, and
evidence, and for an aggregator that emits `APPROVE | REQUEST_CHANGES | COMMENT`. Taken literally that
leaves the two most consequential words — `blocking` and `APPROVE` — as free choices of the model
that also wrote the review. A model grading its own authority is the shape ADR 0070 rejected for the
tier, and the same objection applies one level down.

Three further facts shape the contract. Pull Request text is untrusted input and must not flow into
anything another model reads. Every Pull Request is re-reviewed on each push, so "the same finding"
has to mean something across runs. And the repo has one habitual author, so the calibration data the
roadmap expects from human disagreement will be thin; the reviewer needs a regression test of its own.

## Decision

**A finding may block only when it carries evidence a reader can check without trusting the
reviewer. The verdict is a function of the findings, computed by a validator, and no model ever
writes it.**

1. **Three severities, and `blocking` is earned.** `blocking`, `should-fix`, `nit`. A finding is
   `blocking` only when its evidence is `executed` or `cited`, and only when it anchors to either a
   diff location or a quoted spec line. Smell-baseline findings and anything resting on reasoning
   alone cap at `should-fix`. A finding a deterministic check would already fail is not reported; the
   report counts what it suppressed under `suppressed.redundant`, so the number is visible and the
   items are not. **Narrowed by [ADR 0074](0074-a-gate-suppresses-a-finding-only-if-something-runs-it.md):**
   only a _wired_ check suppresses — one a hook or a workflow actually invokes. The structure of this
   item is unchanged; the suppression condition is qualified there.

2. **Evidence is an enum, not a sentence.** `executed` carries the command, its exit code, an output
   excerpt, and the working directory. `cited` carries the source — a repo standard by path and rule,
   or an issue by number — and the quoted rule. `inferred` carries only the reviewer's reasoning.
   Confidence is a display field (`high | medium | low`) and is read by nothing that decides anything;
   an `inferred` finding the reviewer believes would block with evidence is `should-fix` with
   `wouldBlock: true`, which is a calibration signal, not a gate input.

3. **No Pull Request text enters the report.** A `cited` finding addresses the diff by file, line
   range, and head SHA; the renderer fetches the hunk from the checkout for human eyes. A quoted issue
   line is capped in length and marked `untrusted: true`, because an issue is authored on GitHub and
   not in the repo, and the marker lets any downstream consumer fence or skip it.

4. **The reviewer may execute, in a tree it cannot keep.** Existing targets on affected projects and
   throwaway reproductions in a `git worktree` under `tmp/` are permitted; the tree is discarded after
   the run and nothing is committed or pushed. A failing test the reviewer wrote is the strongest
   evidence class there is. Network, `git push`, and edits outside that tree are refused by the harness
   allow-list, not by prose.

5. **The verdict is computed.** Any `blocking` finding requests changes; only `nit` findings approve;
   otherwise the verdict is comment. A report with no spec source is tightened to `review:human` at
   the envelope level without becoming a finding, because half of the reviewer's value is absent and
   there is nothing in the diff to fix. A report that fails validation is rejected whole — no partial
   verdict, no downgraded severity — and a rejected report is a pipeline error, which ADR 0070
   resolves to `human`.

6. **Identity is derived, and the reviewer never sees its last report.** The validator hashes
   `axis + source + rule + file`, excluding line, so a finding survives a rebase and the reviewer cannot
   mint or reuse ids. Each run reviews fresh; the renderer diffs against the previous run's artifact to
   show new, persisting, and resolved findings. Feeding a model its own prior verdict trades
   correctness for consistency.

7. **Two axes stay two.** Every finding carries `axis: standards | spec`. The prose report renders two
   sections and sorts by severity within each, never across them, so ADR 0017's refusal to rerank one
   axis against the other is preserved in a single array. In the interactive skill, one sub-agent per
   axis emits its own array and the main agent assembles the envelope; the main agent authors no
   finding.

8. **The schema is code, the prose is rendered, and the token stays out of the model.** A Zod schema
   in `tools/scripts/review/` is the contract; `SKILL.md` describes it and defers to it. The reviewer
   emits JSON only. A renderer produces the two-section Markdown for the terminal and the Pull Request,
   and a script — not the model — posts one summary comment edited in place and inline comments only for
   located `blocking` findings. The GitHub token is never among the reviewer's tools.

## Considered Options

**Letting the reviewer set severity freely with prose criteria** was rejected. "Would ship a defect"
is a judgement the gate then trusts without recourse. Tying `blocking` to evidence class turns
"verified over inferred" into a rule the validator enforces rather than a hope the prompt expresses.

**A numeric confidence as a gate input** was rejected. It is the reviewer's estimate of its own
reasoning, which is exactly the quantity the merge decision should not lean on. It remains for humans
reading the report, and the golden set measures evidence classes rather than self-assessment.

**The reviewer emitting `APPROVE`** was rejected as the single field most exposed to prompt injection
and fatigue. When the verdict is a pure function of findings, the only way to approve is to have found
nothing blocking, and the only way to be steered is to be steered out of a finding, which the evidence
requirement makes harder.

**Quoting the offending diff lines in the JSON** was rejected. It is convenient for readers and it puts
untrusted text in front of every future aggregator. Addressing the hunk and rendering it from the
checkout gives humans the same view with no model in the path.

**Keeping the reviewer's previous report as input** was rejected for the bias it introduces; the diff
between runs is a set operation the renderer does better with derived ids.

**Downgrading an unsupported `blocking` to `should-fix`** was rejected because it silently converts a
schema violation into a finding nobody is obliged to read.

## Consequences

`tools/scripts/review/` gains the schema, the validator, the renderer, a replay runner, and the
posting script; all are Wired Gates or invoked by one, so the Meta-Gate sees them. The report envelope
carries `schemaVersion`, `base`, `head`, `tier` (null when run interactively), the spec source and how
it was found, the standards files read, the commands executed, the suppression counts, `model`,
`durationMs`, and the computed `verdict`. Cost per review is recorded from the first run because it is
the number the trust ratchet needs and the one that cannot be backfilled.

The interactive `/code-review` changes shape: it writes the JSON to `tmp/` as an uncommitted file
([ADR 0041](0041-internal-notes-have-homes.md)), runs the validator, and prints the rendered report.
Spec discovery reads the branch name first, because `<type>/<issue>-slug` is the one place the repo
makes the issue mandatory and machine-readable; then commit references, then an argument, and only the
interactive mode asks.

A golden set lives in `tools/config/review-golden-set.json` as expected findings written as the same
`axis + source + rule + file` tuples, hashed identically, so recall is a set intersection. It is seeded
from incidents the repo already documents — the enum fan-out losses behind
[ADR 0053](0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md), the unstyled groceries
pages behind [ADR 0065](0065-tokens-json-is-the-single-source-of-web-colour.md) — and from merged Pull
Requests a later `fix/` branch names, ten to fifteen to start, growing by attribution. Replay runs as a
required check on any Pull Request touching the skill, the schema, the validator, the renderer, or the
review workflow, all of which ADR 0070 already places in `review:human`.

No finding count is capped; the renderer folds `nit` findings so they cannot bury the rest. Labels,
CODEOWNERS, and the ruleset are untouched by this ADR; the ADR that narrows CODEOWNERS and adds the agent
verdict as a required check can be written once the golden-set replay has a record.

> **Amended by [ADR 0073](0073-a-required-check-is-a-fact-about-the-pipeline-not-a-judgment-about-the-diff.md).**
> The record was collected and the ADR was written, but it does not add the verdict to the ruleset:
> the verdict is advisory permanently, because a check may assert a fact about the pipeline and not a
> judgment about the diff. The reviewer's work is now two checks, and it is the other one —
> `Agent Review Ran` — that is eligible to be required. No recall number reopens this.
>
> Two paragraphs above, "Replay runs as a required check" was never true and is not true now:
> `Golden Replay` is in no ruleset, which
> [ADR 0072](0072-a-golden-case-earns-its-replay-frequency.md) makes deliberate. Noted here because
> it sits beside a claim being corrected, not because ADR 0073 changed it.
