---
name: qa-plan
description: 'Use when work is complete and its Pull Request is open, and a human needs to verify it before merge — normally a PRD Issue, occasionally a single issue. Establishes what the automated suites actually prove by running them at the branch and its merge-base, then writes a QA Plan containing only the residue: what no passing CI run can establish. Not for planning automated tests.'
---

# QA Plan

Write down what a human still has to prove. Nothing else.

The deliverable is a **QA Plan** (`CONTEXT.md`): the manual verification for work whose Pull
Request is open but unmerged. Its value is entirely in what it **leaves out** — a reader who
trusts it will skip everything it says is covered.

## Use This Skill When

- A PRD Issue's work is complete, its Pull Request is open, and it has not merged.
- A single issue's Pull Request is open and the change warrants manual verification.
- The user asks for a QA plan, a manual test plan, or how to verify something before merging.

## Do Not Use When

- Planning Playwright specs or a Jest behavior matrix → `E2EPlanner`,
  `.agents/skills/playwright-e2e-workflow/SKILL.md`, or
  `.agents/skills/unit-test-delegation-workflow/SKILL.md`. Those design automation. This skill
  documents what automation cannot reach.
- Reviewing the diff for defects → `.agents/skills/code-review/SKILL.md`.
- **There is no open Pull Request, or no branch, for the subject.** A QA Plan verifies work that
  exists. Without a branch there is no diff, and without a Pull Request there is no pinned
  merge-base, so no coverage claim can be attributed. See the precondition in step 1.

## Modes

Resolve the mode from the issue the Pull Request closes. Everything in this skill applies to both
except where a step says otherwise.

|                   | **PRD mode**                                   | **Issue mode**                                |
| ----------------- | ---------------------------------------------- | --------------------------------------------- |
| Input             | A PRD Issue                                    | A single issue                                |
| Work is read from | Slice Issues, then the commits on each         | The commits on the branch                     |
| Composed in       | `tmp/QA-PLAN-prd-<number>.md`, gitignored      | `tmp/QA-PLAN-issue-<number>.md`, gitignored   |
| Published to      | A **QA Plan Issue** on GitHub, labelled `qa`   | Nowhere — the working copy is the deliverable |
| Sign-off          | Closing the QA Plan Issue                      | None — the file is consumed and discarded     |
| Defects found     | Filed as issues, linked from the QA Plan Issue | Filed as issues                               |

If the Pull Request closes several issues, or closes none, ask which subject the plan is for rather
than guessing. If the input is a PRD Issue with no Slice Issues, read its commits directly and say
so in the plan.

**Both modes compose in `tmp/`.** The plan is a document before it is an issue, and it is revised
against the source while you write it. Under ADR 0041 that draft is a short-lived working file, and
`tmp/` is where those live. Write it there first in either mode. Never commit it.

**Only PRD mode publishes.** A PRD is large, multi-slice work whose validation is worth a durable
record others can find, so its plan becomes a QA Plan Issue whose closure is the sign-off. A single
issue is verified once by one person, so its working copy is the whole deliverable. Do not publish
an Issue-mode plan to GitHub.

In PRD mode the working copy is scaffolding, not a second artifact. Once the QA Plan Issue exists,
that issue is the plan: it is what you link, what the tester ticks, and what closes as the sign-off.
The file can be discarded with the working tree. In Issue mode there is nothing to defer to, so the
file is the plan.

## Core Rules

- **The residue rule.** Every line you keep must survive one question: _would a passing CI run
  establish this?_ If yes, delete it. A QA Plan that restates the test suite wastes the one
  resource it exists to protect — human attention.
- **Never assert coverage you have not observed.** Every claim in the coverage section is tagged
  `[observed]` (you ran it this session and saw the result) or `[reconstructed]` (inferred from CI,
  the diff, or issue history). A wrong `[observed]` tag is the worst defect this skill can ship.
- **Two points, always.** Run the suites at the branch **and** at the merge-base. A failure present
  at both is pre-existing and belongs in Expected Red Herrings, not in the scenarios. A failure
  present only at the branch is a regression and blocks the plan — report it and stop.
- **A green suite is not a proving suite.** For crypto, vault, auth, or ownership boundaries,
  optionally perturb the source so a test _should_ fail, and confirm it does. Record the result. A
  suite that passes against broken code proves nothing, and its coverage claims must be downgraded.
- **Read the UI, do not imagine it.** Steps name real button labels, field ids, and toast copy read
  from the components. A scenario a human cannot follow literally is not a scenario.
- **Do not delegate the body.** Compose it here. In PRD mode publish directly with `gh` — an
  intermediary that re-words load-bearing exclusions is a liability, and the ad-hoc issue template
  does not fit this shape. Same reasoning as `to-prd`.
- **Verify the work exists before planning to verify it.** An issue describing a defect that
  nobody has fixed yet has nothing to QA. Halt rather than producing a plan for code that does not
  exist — such a plan is speculation, and it is worse than none because it looks authoritative.
- **One QA Plan Issue per PRD Issue.** Search before creating.
- **This is invoked, never enforced.** Do not add a gate asserting that a Pull Request links a QA
  Plan — that is the "surface X changed, therefore doc Y must change" shape ADR 0043 deliberately
  does not build.
- Use `CONTEXT.md` vocabulary. Do not use its avoided terms.

## Workflow

### 1. Check the precondition, then fix the anchors

**Before anything else, confirm the subject has work to verify.** Check for a branch and an open
Pull Request:

```sh
gh pr list --state open --json number,title,headRefName
git branch -a
```

**Halt immediately if either is missing.** Report which is absent, state that the subject has no
implemented work, and recommend the actual next step (implement it, or open the Pull Request).
Do not offer a partial plan, a provisional plan, or a plan "to use later" — a QA Plan asserts what
automation proves about a specific diff, and there is no diff.

Only once both exist, establish and state these. Do not proceed while any is unknown:

- the subject issue number, and whether it is a PRD Issue (→ PRD mode) or not (→ Issue mode)
- the Pull Request number
- the merge-base SHA (`git merge-base origin/main HEAD`)

The merge-base is what makes coverage attributable. Without it every pre-existing failure reads as
a regression.

### 2. Establish coverage empirically

Run the relevant suites at the branch and at the merge-base, and diff the results. Prefer the
narrowest command that covers the change's surface.

Record for each suite: passed, failed, and **which** tests failed at each point. Classify:

| At merge-base  | At branch | Meaning                                                 |
| -------------- | --------- | ------------------------------------------------------- |
| fails          | fails     | Pre-existing → Expected Red Herrings                    |
| passes         | fails     | **Regression → stop and report; do not write the plan** |
| passes         | passes    | Covered → excluded from the plan                        |
| n/a (new test) | passes    | Covered → excluded, and name what it proves             |

If the suite cannot run at the merge-base, say so and tag every coverage claim `[reconstructed]`.

### 3. Read the change and the decisions behind it

- **PRD mode** — read the PRD Issue, each Slice Issue, and the commits on each. Slices carry the
  acceptance criteria the PRD promised; unmet criteria are prime scenario material.
- **Issue mode** — read the issue and the commits on the branch. A single issue rarely states
  acceptance criteria, so derive the promise from the issue body and the diff.

In both modes read any ADR the change implements or depends on. You are looking for the promises
the change makes — those are what a human verifies.

### 4. Read the UI copy

Open the components the scenarios will touch and copy exact labels, ids, and messages. This is what
separates an executable plan from an abstract one.

### 5. Compute the residue

Subtract step 2 from step 3. What remains is the plan. Residue usually clusters as:

- **Real-world upgrade paths.** Automation synthesises prior state; it rarely produces it the way a
  released build did. State created by the _previous_ version and read by the new one is the single
  highest-value thing a human can test.
- **Cross-boundary claims nothing asserts.** Where the change promises isolation, ownership, or
  authorization, check whether any test actually proves it. If not, that is a scenario — and often
  also an issue worth filing.
- **Destructive and irreversible actions.** What survives a failed attempt, and what the blast
  radius of a successful one is.
- **Judgement.** Whether copy is honest, whether an error is actionable, whether a flow feels safe.

When the residue includes something automation _should_ cover and does not, say so in the scenario
and file it, rather than silently converting a coverage gap into permanent manual labour.

If the residue is empty, say so and recommend merging without a QA Plan. An empty plan is a real
and good outcome; padding it to look substantial is the failure this skill exists to prevent.

### 6. Draft into the working copy

Write the plan to its `tmp/` path using the anatomy below — `tmp/QA-PLAN-prd-<number>.md` in PRD
mode, `tmp/QA-PLAN-issue-<number>.md` in Issue mode. Never commit it.

Then show the user the draft and ask whether to proceed. **Nothing leaves `tmp/` before they
answer** — in PRD mode no issue is created, and in Issue mode the plan is not final and is not
handed over. Writing the working copy is not the decision point; delivering it is.

### 7. Deliver

- **PRD mode** — publish the working copy's body with `gh issue create`, labels `qa` plus the
  relevant area labels, title `[QA Plan] <PRD title>`. Link the PRD Issue and the Pull Request. Do
  not apply `ready-for-agent`; this is human work. Publish **once** — later revisions edit the
  existing issue, they do not create a second one.
- **Issue mode** — hand the working copy to the user. It is the deliverable; do not publish it.

### 8. Close the loop

Tell the user how it ends. In PRD mode: tick the boxes on the QA Plan Issue while testing, file each
defect as its own issue linked from it, and close the QA Plan Issue as the sign-off — the `tmp/`
file has served its purpose and needs no further attention. In Issue mode: file defects as issues;
the file needs no ceremony.

## The Plan Anatomy

```
## Anchors
Subject issue, Pull Request, merge-base SHA, branch name.

## What automation already proves — do not re-test
Tagged [observed] or [reconstructed], one line each, naming the suite and what it establishes.
This section exists so the reader skips it, so it must be trustworthy.

## Expected red herrings
Table of failures and noisy signals the tester WILL encounter that are not this change's fault,
each with the reason and the tracking issue. Prevents hours lost to known breakage.

## Setup
Exact commands, ports, services, and accounts needed. Assume a cold machine.

## Scenarios
Numbered. Each carries:
  - Why only a human can prove this — one sentence, the justification for its existence
  - Steps, using real UI copy
  - Expected result
  - What a failure means — whether it blocks the merge or is a follow-up

## Sign-off checklist
One checkbox per scenario, tickable while testing.

## Stop and do not merge if
The short list of outcomes that block the merge outright, stated as observable results.
```

## References

- `docs/adr/0048-a-qa-plan-carries-only-what-automation-does-not-prove.md` — the decision behind
  this skill: the residue rule, the two-point coverage run, the routing split, and why no gate
  enforces it.
- `docs/adr/0041-internal-notes-have-homes.md` — why the working copy is an uncommitted file in
  `tmp/`, in both modes. ADR 0048 decides where a plan is **published**; it says nothing about where
  it is composed, so a PRD-mode working copy in `tmp/` does not contradict it.
- `docs/adr/0043-gates-assert-facts.md` — the gate shape this repo does not build.

## Completion Criteria

- A branch and an open Pull Request were confirmed to exist before any planning began.
- The mode was resolved from the subject issue and stated explicitly.
- Every coverage claim is tagged `[observed]` or `[reconstructed]`.
- No scenario re-tests something the coverage section says is covered.
- Every scenario states why a human is required for it.
- Steps quote UI copy read from source, not invented.
- Pre-existing failures appear as red herrings, never as scenarios.
- The user confirmed the draft before it was published (PRD mode) or handed over (Issue mode).
- The plan was composed in `tmp/` and was not committed.
- In PRD mode a QA Plan Issue exists and carries the plan; in Issue mode nothing was published.
