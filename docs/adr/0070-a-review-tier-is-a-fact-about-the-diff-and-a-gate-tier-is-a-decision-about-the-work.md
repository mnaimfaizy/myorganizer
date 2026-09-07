# A Review Tier is a fact about the diff, and a Gate Tier is a decision about the work

## Status

proposed

## Context

[ADR 0012](0012-tiered-quality-gates.md) introduced the word _tier_ for `gate:mechanical`,
`gate:standard`, and `gate:full`. A Gate Tier is chosen before any code exists — by `to-issues` on a
Slice Issue, or by the main agent at the start of an ad-hoc session — and it answers one question:
how deep a specialist pipeline does this work deserve. It is a judgement about intent, made by a
person or an agent, recorded as an Issue Orchestration Label, and it can be wrong in a way nothing
checks: a `gate:mechanical` slice can still produce a diff that touches the Vault.

The repo is about to grow a second use of the word. Automated review of Pull Requests — the
AI code review workflow whose roadmap this ADR is the first written decision of — needs to sort every Pull Request into one of three outcomes: merge on green checks alone, merge on green checks
plus an agent verdict, or wait for a named human. That sorting has to be trustworthy in a way a Gate
Tier is not, because it decides whether a human looks at the change at all.

Two things about this repo shape the decision. First, the main-branch ruleset already gates merges on
six required status checks and a code-owner review; the mechanism for "a machine must say yes" exists
and is a status check, not a review approval. Second, `.github/CODEOWNERS` assigns every path to one
person, so today every Pull Request structurally requires that person. Automated review changes
nothing about that until CODEOWNERS is narrowed, and narrowing it is a separate decision this ADR
does not make.

The tempting shortcut is to reuse `gate:*` on the Pull Request, or to let the reviewing agent decide
its own tier. Both put the classification in the hands of the thing being classified.

## Decision

**A Review Tier is computed from the diff by a deterministic script after the code exists. A Gate
Tier is chosen by a person or an agent before it exists. They answer different questions, are set at
different times by different authorities, and neither one changes the other.**

1. **Three Review Tiers, ordered.** `review:auto` — merge on green required checks and an agent
   verdict with no findings above nit. `review:agent` — merge on green checks and an agent verdict
   with no blocking finding; any blocking finding relabels to `review:human`. `review:human` — a named
   human approval is required by the ruleset and the agent verdict is necessary but never sufficient.
   `human` is the default for anything the script cannot classify, and for any error in the script.

2. **The classifier is a Wired Gate and never an LLM.** It lives with the other checkers in
   `tools/scripts/` and is invoked from CI, so the Meta-Gate sees it. Its inputs are the affected Nx
   projects and their `tier:*` tags, a path map in `tools/config/`, the dependency manifests, the size
   of the diff, and the author. Its rule set is fixed and readable. It explains itself: the job posts
   which signals fired, because a tier nobody can trace is a tier nobody will trust.

3. **The run reads the tier from the job output, not from the label.** The label on the Pull Request
   is a display of the classification. A human may edit it, and downstream jobs ignore the edit. The
   only way to lower a path's tier is to change the map in `tools/config/` through a Pull Request that
   is itself `review:human`, because the map is one of the paths the map protects.

4. **The initial human set is the set whose failure is silent or unrecoverable.** Vault and crypto
   code, authentication and session code, Prisma schema and migrations, GitHub workflows, the gate
   scripts and their config, CODEOWNERS, and the dependency manifests. A diff that reaches one of these
   through the Nx dependency graph is `review:human` even when it edits none of them directly — the
   "harmless util that payments imports" case is the case the graph exists to catch.

5. **A tier can only tighten downstream.** A Review Tier may send a `gate:mechanical` slice's Pull
   Request to a human; it never loosens the pipeline the slice ran. A Gate Tier may run the full
   pipeline on a docs change; it never lets that change skip the human the map requires. ADR 0012's
   rule — when unsure, promote — holds mechanically here: unknown project, unmatched path, or script
   error all resolve to `human`.

6. **The agent verdict is a required status check, not a review approval.** It is one more context in
   the ruleset beside `Lint` and `Test`. Whether a GitHub App's review can satisfy a required-approval
   count is a question this repo does not need to answer, because approvals are what CODEOWNERS
   demands of humans and checks are what the ruleset demands of machines. Keeping the two separate is
   what makes "the agent cannot exceed its permissions by construction" true rather than hoped.

7. **`review:*` is a third label set.** It is not a Surface Label, because it names neither kind nor
   area, and not an Issue Orchestration Label, because it never appears on an Issue. It is applied by
   the classifier alone. [ADR 0025](0025-pr-surface-labels.md)'s rule that a Pull Request wears Surface
   Labels only is narrowed to: a Pull Request wears Surface Labels and at most one Review Tier label,
   and no human applies the latter.

## Considered Options

**Reusing `gate:*` on the Pull Request** was rejected. The Gate Tier is a plan made before the diff and
the Review Tier is a measurement made after it. Sharing a label would let a slice planned as
mechanical merge as mechanical regardless of what it actually touched, which is the exact failure
ADR 0012's "when unsure, promote" exists to prevent and cannot prevent without a second look.

**Letting the reviewing agent assign the tier** was rejected. The tier decides whether the agent's own
verdict is sufficient. An LLM classifying a diff it is also reviewing is one component grading its own
authority, and it can be steered by the diff's text. The classifier's value is that it cannot be argued
with.

**Trusting the label as the source of truth** was rejected because labels are editable by anyone with
triage, and an audit trail that can be rewritten in the UI is not one. The label stays because a human
scanning the Pull Request list needs to see the tier; it is a view, not the state.

**Treating `review:*` as a Surface Label** was rejected. Surface Labels are applied by the author or by
`ai:create-pr` from the branch and the issue; a Review Tier is applied by a script from the diff. Putting
them in one set invites a human to set the tier by hand, which is the thing item 3 forbids.

**Skipping the label and posting only a comment** was considered. It would sidestep ADR 0025 entirely.
It was rejected because a label is filterable and a comment is not, and the queue of "Pull Requests
waiting for me" is the one view this whole workflow exists to make small.

## Consequences

Every Nx project needs a `tier:*` tag before the classifier's primary signal means anything; today one
of thirty-three carries any tag, and `@nx/enforce-module-boundaries` allows everything to depend on
everything. Tagging is the real remaining Phase 1 work and is worth doing for the boundary rule alone.

`tools/config/github-labels.json` gains a `review` set beside `orchestration` and `surface`, and the
label sync applies it. CONTEXT.md gains **Gate Tier** and **Review Tier** as distinct terms so that
_tier_ alone is no longer used for either.

The classifier ships with a replay: run it over the last two hundred merged Pull Requests and hand-check
the tiering before it gates anything. Thresholds for size and blast radius are tuned there, not guessed.

Merge policy does not change with this ADR. CODEOWNERS still assigns everything to one person, so every
tier is `human` in effect until a later ADR narrows CODEOWNERS to the human set in item 4 and adds the
agent verdict to the ruleset's required checks. That ADR can only be written once the classifier has a
replay record and the reviewer has a finding schema whose `blocking` is precise enough to gate on —
the subject of the next ADR in this series.

`/code-review` ([ADR 0017](0017-gated-pipeline-cap-and-slice-code-review.md)) is unchanged by this
decision except that, when run in CI, it reads the Review Tier from the job output to decide whether a
`blocking` finding relabels the Pull Request.
