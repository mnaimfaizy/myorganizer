# A QA Plan is composed in `tmp/` before it is published anywhere

ADR 0048 decides where a QA Plan is **published** and never says where it is **composed**. The skill implementing it filled that silence with a prohibition the ADR does not carry, and a session that wrote a PRD-mode plan to `tmp/` read as a contradiction. Every QA Plan is composed as an uncommitted working file in `tmp/`; publication routing is untouched.

## Status

accepted

Extends [ADR 0048](0048-a-qa-plan-carries-only-what-automation-does-not-prove.md). Nothing in ADR 0048 is superseded — its routing decision stands exactly as written, and this decision covers the step before it.

## Context

ADR 0048 routes by subject, framed by _how long the record is worth keeping_: a PRD Issue "gets a **QA Plan Issue**", a single issue "gets an uncommitted file in `tmp/`". Both sentences say what each subject **gets**. Neither says where the document is written on its way there.

The skill went further than the ADR it cites. `.agents/skills/qa-plan/SKILL.md` carried "do not leave a PRD-mode plan in `tmp/`" — a prohibition that appears nowhere in ADR 0048. Read together, the pair looked like one rule, and the skill's half was the stronger one.

The gap surfaced when the QA Plan for PRD 544 (pull request #573) was composed at `tmp/QA-PLAN-prd-544.md` at user direction. Issue #575 was filed on the belief that this contradicted an accepted decision, and proposed reversing ADR 0048's routing to resolve it — reversing a decision that had not in fact been broken. Two independent review passes over ADR 0048's Decision section confirmed the reading: no sentence in it is contradicted by composing a PRD-mode plan in `tmp/`.

A QA Plan is a document before it is an issue. It is drafted against the source, revised while coverage is attributed at the branch and the merge-base, and shown to the user for confirmation before anything is created. It has to be written somewhere. ADR 0048 simply did not say where.

The working copy is genuinely short-lived, and this is observable rather than assumed: neither `tmp/QA-PLAN-prd-489.md` — the pre-ADR artifact ADR 0048 was written in response to — nor `tmp/QA-PLAN-prd-544.md` survives in the working tree today. Both were consumed and discarded exactly as ADR 0041 expects of a file in `tmp/`.

## Decision

- **Every QA Plan is composed as an uncommitted working file in `tmp/`, in both modes** — `tmp/QA-PLAN-prd-<number>.md` and `tmp/QA-PLAN-issue-<number>.md`. Under ADR 0041 that is a short-lived working file. It is never committed.
- **Publication is unchanged and remains ADR 0048's decision.** PRD mode publishes the working copy once, as a QA Plan Issue labelled `qa`, after user confirmation. Issue mode publishes nothing; its working copy is the deliverable.
- **The working copy is scaffolding, not a second artifact.** Once a QA Plan Issue exists, that issue is the plan — it is what is linked, what the tester ticks, and what closes as the sign-off. The file is not cited and needs no ceremony.
- **Confirmation gates delivery, not publication.** Nothing leaves `tmp/` before the user answers. In PRD mode that means no issue is created; in Issue mode it means the plan is not final and is not handed over. Stating the gate in terms of publication alone would make it vacuous in the mode that never publishes.
- **A skill may not carry a prohibition stronger than the ADR it cites.** Where a skill needs a rule its ADR does not state, the rule is recorded as a decision — as here — rather than inserted into the skill as though the ADR already said it.

## Considered Options

- **Reverse the routing so both modes stop at `tmp/`** (option 1 of #575) — rejected. It answers a contradiction that does not exist. It would also empty ADR 0049's `qa` label of its only subject, and cost multi-slice PRD verification both its sign-off mechanism and its audit trail, neither of which has a replacement designed.
- **Narrow PRD mode to "multi-slice work requiring multi-person verification"** (option 3 of #575) — rejected. It refines a routing rule that is not the problem, and buys that refinement with a slice-count or verifier-count threshold that would have to be defended at every invocation.
- **Fix the skill's prose and record nothing** — rejected, and this is the option this ADR exists to close. It is correct as far as it goes: no ADR was being violated, so none needed changing. But a reader of ADR 0048 alone still infers that a PRD-mode plan must never touch `tmp/`, because the retention framing invites it. That inference is precisely what produced #575, and leaving it in place invites the same issue to be filed again.
- **Amend ADR 0048 in place with a line in its Consequences** — rejected under ADR 0042. A merged ADR is a fact; it is superseded or extended by a new one, not edited into saying something it did not say.
- **A gate asserting a QA Plan was written** — rejected, as ADR 0048 already rejected it under ADR 0043. "A human should have composed a document" is not a factual mismatch between two artifacts, and a gitignored file is not an artifact a gate can read.

## Consequences

- Nothing mechanical protects the working copy. It is gitignored by design, so a plan can be written and then lost with the working tree — and both QA Plans ever written are already gone from `tmp/`. In PRD mode the published issue is the durable record and the loss costs nothing. In Issue mode ADR 0048 already accepts the trace-free outcome, and treats a repeated manual check as a signal the check belongs in automation.
- ADR 0049 is untouched. `qa` keeps its only subject, and closing a QA Plan Issue remains the sign-off for PRD-mode verification.
- The skill is longer and more stateful than before: PRD mode now has two outputs where it had one, and the composition step has to be distinguished from the publication step everywhere the confirmation gate is described.
- The `tmp/` working copy is now named in both modes rather than being an artifact the user understood and the skill did not mention. Issue #575 identified that silence as a cost of this option; naming it is what pays it.
- This ADR records a reading of another ADR, which is unusual. It is worth the number because the mis-reading had already cost one issue proposing to reverse an unbroken decision, and the reading is not recoverable from the skill once the skill's prose is corrected.
