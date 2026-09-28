# A golden replay runs on a schedule and on request

## Status

accepted

Supersedes the trigger in [ADR 0071](0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md)'s
Consequences and items 1 and 3 of
[ADR 0072](0072-a-golden-case-earns-its-replay-frequency.md), and reverses
ADR 0072's rejection of a schedule. Everything else in both stands.

## Context

ADR 0071 made the Golden Set replay run on every Pull Request that touches a
reviewer input, so a prompt or contract change is measured before it reaches a
real Pull Request. ADR 0072 tiered the cases to cut that cost, added
`[skip replay]` as a per-push escape, and rejected a schedule on the ground that
"the replay's input changes a few times a year".

Three weeks of history say otherwise (issue #925, measured 2026-09-28 from the
run logs of all 108 replay runs between 2026-09-07 and 2026-09-27):

- **The inputs changed constantly.** The replay workflow, the set, the
  ledger and the golden module took 53 commits in those three weeks alone;
  the path filter also covered `.claude/**`, so a permission tweak bought a
  six-case replay.
- **Pull Request pushes paid for nearly all of it.** 228 reviewer sessions,
  $531 billed-equivalent (`total_cost_usd`, about $2.54 and 35 turns a case),
  about 59 CI job-hours. $461 of it — 88% — came from `pull_request`; $70 from
  deliberate dispatches. On the subscription token the dollars are quota in
  the maintainer's own five-hour window, which a replay has already exhausted
  once.
- **Most of it measured nothing new.** Since 2026-09-12 the four guard cases
  were caught 60 of 63 times, $149 spent re-confirming the known; 20 of the 108
  runs reached the ledger.
- **One run per case per push cannot carry a conclusion.** ADR 0072 item 8
  already says so: three dispatches, read together, are one measurement. A push
  that happens to touch an input buys one repetition and a red or green check
  whose colour is mostly noise for the case that sits near half.
- **The escape was a tax.** About thirty merged commits carry `[skip replay]`
  in their subject, each one somebody remembering to decline a run they never
  wanted.

What the replay is for has not changed: it is the regression signal for the
reviewer (ADR 0077 keeps it apart from the trust measure). What changes is who
decides that a measurement is worth paying for.

## Decision

**The replay runs when somebody asks for it, and once a week when the reviewer
moved — never because a push happened to touch an input.**

1. **No push trigger.** The workflow listens to `pull_request` only for the
   `labeled` event, and only the `golden-replay` Request Label is a request.
   Like `agent-review` it is a button: the workflow removes it when the run
   ends. Any other label is steered into a concurrency group of its own before
   a job reads it, so labelling a Pull Request never cancels a replay in
   flight. On a labelled Pull Request, frontier cases run, and guard cases run
   too when that Pull Request changes the Standards brief or the finding
   contract, as ADR 0072 item 1 already decided for the guards.
2. **A weekly schedule on `main`, gated on the inputs' own history.** The
   scheduled run asks git whether any reviewer input moved: the frontier tier
   when one moved in the last seven days; every case in the first week of a
   month in which one moved in the last 31; nothing when the reviewer did not
   move. The input list and the decision live in one dependency-free module
   the workflow calls, and its tests name every input. The inputs are the
   paths that produce a review — the code-review Skill, the review scripts, the
   reviewer action, both review workflows, the Golden Set, and the Obligation
   and rule catalogues. `.claude/**`, the Copilot hooks and the upstream-brief
   Skill are not, although the replay lays them over each case tree (ADR
   0102): the one way they broke a replay, a permission rule refusing an
   instructed command, is `review:allowlist:check`'s to catch (ADR 0099), and
   `.claude` moves most weeks, so watching it would make the gate always true.
3. **`workflow_dispatch` stays** exactly as ADR 0072 item 4 and item 8 left it:
   one repetition of a tier per dispatch, on any model.
4. **`[skip replay]` is retired.** With no push trigger there is nothing for it
   to skip. Historical commits that carry it are left as they are.
5. **`yarn review:golden:check` asserts the triggers**, in both directions: it
   fails a `pull_request` trigger that carries a path filter or any type other
   than `labeled`, a workflow with no schedule or no dispatch, a label guard or
   concurrency group that lets another label through, and a schedule that does
   not ask which inputs moved. The contract suite proves each refusal.

## Consequences

A reviewer change can now merge unmeasured if nobody adds the label. That is
the trade, made deliberately: the weekly run measures `main` within seven days
of the change, and the cost of that week's delay is bounded by the same
week's live measurements — the Escaped Defect and Effective False Positive
rates, which read every real Pull Request at no reviewer cost. A change the
author believes is risky gets the label.

Standing spend falls from roughly $180 a week to at most one frontier run
(two cases today, about $5) a week plus one full run a month, and to nothing in
a week the reviewer did not move.

What the replay measures is unchanged, and so are ADR 0072's tier rules,
promotion and demotion, the ADR 0101 void rule, and the ADR 0102 case tree. The
remaining work in issue #925 — a machine results record, clean-diff cases,
standing by rate rather than streak, and a larger set — builds on this
cadence and does not depend on anything here beyond it.

## Alternatives considered

- **Keep the push trigger and narrow the path filter.** Rejected. It removes
  `.claude/**` and the hooks from the filter but keeps one repetition per push,
  which is the part that measures nothing, and it keeps `[skip replay]`.
- **Nightly schedule.** Rejected for the reason ADR 0072 gave for all
  schedules, which still holds at that frequency: an untouched reviewer
  re-measured daily. The gate on the inputs' history is what makes a weekly
  schedule cheap, and it would make a nightly one cheap too; weekly is chosen
  because three repetitions of a measurement already span separate days by
  ADR 0072 item 8, and a week holds them.
- **Remove the replay entirely and rely on the live measurements.** Rejected
  for now. The live rates say whether a passing review can be trusted; they do
  not say whether a specific brief edit undid a catch, which is the one
  question the replay answers. Issue #925 sets a review date of 2026-10-26
  with a written kill criterion instead.
