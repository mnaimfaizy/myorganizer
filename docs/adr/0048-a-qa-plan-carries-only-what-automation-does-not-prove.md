# A QA plan carries only what automation does not prove

## Status

accepted

## Context

PRD 489 was verified before merge with a hand-written plan that deliberately opened by listing what
CI already established, then spent itself on what no passing run could: the real pre-#489 upgrade
path, a cross-token replay whose outcome nothing asserted, and a table of pre-existing failures the
tester would otherwise chase for an hour. It was useful, and nothing made it repeatable.

Two obstacles stood in the way of simply naming the thing. First, "QA Plan" was already used in this
repo for two different artifacts: #191 published a matrix of unit and integration tests that ought to
exist, and #237 published behaviour-first validation for one pull request. Second, `E2EPlanner`
already owns planning automated tests, so any new workflow emitting a test matrix would duplicate an
agent that exists.

The plan's usefulness also depended on knowledge that was not in the diff. That it named the 13
pre-existing E2E failures tracked by #506 as red herrings — rather than as regressions — was only
possible because both the branch and its merge-base had been run. An earlier claim in the same
session that "PRD 489 breaks the E2E suite" was confident and wrong, and running two points is what
disproved it.

## Decision

A **QA Plan** records the manual verification for finished work whose pull request is open, and
carries only the residue: what the automated suites do not already prove. Every line must survive the
question _would a passing CI run establish this?_ — if yes, it is cut.

This inverts the usual failure mode. A test plan that omits something is merely incomplete; a QA Plan
that wrongly says "already covered" steers a human away from a defect. Three rules follow from that:

- **Coverage is established by running the suites at the branch and at its merge-base, and diffing.**
  A failure at both points is pre-existing and is recorded as an expected red herring. A failure only
  at the branch is a regression, which halts the plan rather than becoming a scenario.
- **Every coverage claim is tagged `[observed]` or `[reconstructed]`**, matching the `[found]` /
  `[inferred]` convention `CodeExplorer` already uses. A reader can then discount the claims that were
  inferred from CI rather than watched.
- **An empty QA Plan is a valid outcome.** If the residue is empty, the recommendation is to merge
  without one.

Routing depends on the subject, because the two cases differ in how long the record is worth keeping:

- A **PRD Issue** gets a **QA Plan Issue** — a GitHub issue labelled `qa`, whose scenarios are
  checkboxes and whose closure is the sign-off. Defects it finds become their own linked issues.
- A **single issue** gets an uncommitted file in `tmp/`. Under ADR 0041 that is a short-lived working
  file, and it is verified once by one person.

Both live in one skill, `.agents/skills/qa-plan/`, with the mode resolved from the subject issue.

The skill is **invoked, never enforced.** No gate asserts that a pull request links a QA Plan.

## Considered Options

- **A full verification plan covering automated and manual coverage together** — rejected. It is the
  #191 shape, it overlaps `E2EPlanner` and `TestScaffold`, and it re-lists work CI already does. The
  scarce resource is human attention, and a document that spends it restating the test suite has
  inverted its own purpose.
- **Two skills, one per mode** — rejected on arithmetic. The modes differ only in how the input
  resolves and where the output lands, about 36 lines of the 198. The residue rule, the two-point run,
  the evidence tagging, the plan anatomy and the completion criteria — roughly 130 lines — are common.
  Splitting would copy those into two files, and `AGENTS.md` and `E2EPlanner` both already state the
  house position that a duplicated rule is one more place for guidance to drift. The real cost paid
  instead is a broader skill description, which triggers less precisely.
- **A `QaPlanner` sub-agent** — rejected. A sub-agent starts cold, and the most valuable parts of the
  489 plan came from session knowledge no brief would have carried: a login-stub defect found and
  fixed mid-run, a mutation test confirming the suite had teeth, and which scanner findings had
  already been dismissed as fixture false-positives. A skill runs where that knowledge already is.
- **Publishing through `IssueCreator`** — rejected. Its template does not fit this shape, and an
  intermediary that re-words load-bearing exclusions is a liability. `PrAuthor` produced three drafts
  in one session and materially mis-stated something in each, including a `Fixes` line that would have
  auto-closed a 17-commit PRD. `to-prd` already sets the precedent of composing and publishing
  directly with `gh`.
- **Running the suites only at the branch** — rejected. It detects failures but cannot attribute them,
  so every pre-existing failure reads as a regression and the red-herring table — the section that
  saves the most time — cannot be produced at all.
- **Trusting CI status instead of running anything** — rejected. A green check means the tests that
  ran passed, not that they assert anything. It would have missed that the vault E2E suite was
  entirely unrunnable on `main`, which is the exact condition that made the coverage question worth
  asking.
- **Refusing to run without the originating session's context** — rejected as unusable. QA commonly
  happens a day later against an open pull request. Degrading honestly, with reconstructed claims
  labelled as such, keeps the skill reachable in the case that actually occurs.
- **A gate asserting that a PRD's pull request links a QA Plan Issue** — rejected under ADR 0043. That
  is precisely the "surface X changed, therefore doc Y must change" shape this repo deliberately does
  not build. Every gate here is an Assertion Gate comparing two artifacts on a factual mismatch, and
  "a human should have verified this" is not such a fact.

## Consequences

- The plan's value rests entirely on the accuracy of its exclusions, which is a heavier obligation
  than a test plan carries. The `[observed]` / `[reconstructed]` tags make the weaker claims visible
  rather than pretending the problem away.
- Running two points is slow, and slower still for E2E, which needs a running stack. This is the cost
  of attributable coverage and it is paid on every invocation.
- A QA Plan shrinks as automation improves, and a nearly-empty one is evidence of a healthy suite
  rather than a neglected plan. Anyone reading one as thin should check the coverage section first.
- Nothing mechanical ensures a QA Plan is written. Deliberately: the alternative was a gate of a shape
  this repo has rejected, and the honest position is that review and habit are the only defence —
  which ADR 0041 already concedes for placement.
- `qa` on an issue continues to mean several things historically. #191 and #237 are not QA Plan Issues
  under this decision and are not retrofitted; they are closed, and rewriting history to match a
  later vocabulary would be worse than the ambiguity.
- Issue-mode plans leave no trace once consumed. That is intended, and it means a repeated manual
  check on a single issue is a signal that the check belongs in automation instead.
