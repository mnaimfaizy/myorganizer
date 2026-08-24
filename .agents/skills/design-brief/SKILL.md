---
name: design-brief
description: 'Design brief for a Designer agent — turns a request for a visual (diagram, animated walkthrough, explainer page) into a prompt someone else executes. Grounds every claim in real source constants when the subject is code; interviews the user when it is not.'
---

# Design Brief

Write the prompt. Do not write the design.

The deliverable is a Markdown brief handed to the Designer sub-agent
(`.github/agents/designer.agent.md`), which produces the artifact. If you find yourself choosing
colours or laying out a diagram, you have left this skill.

Dispatch to Designer, not to a general-purpose agent. Designer owns the house conventions — the
canonical `@font-face` block, the three-state theme tokens, the accessible-name pattern that does
not grow a tooltip — so the brief does not have to re-teach them, and `yarn design:hygiene` gates
what comes back. Briefing a generalist re-derives all of it, and shipped a full-canvas tooltip
that reached users before anyone reported it ([ADR 0046](../../../docs/adr/0046-house-explainer-pages-have-a-designer-and-a-gate.md)).

## Use This Skill When

- The user wants a diagram, animated walkthrough, explainer page, or architecture visual.
- The user asks for "a prompt for the Designer" or wants to brief a visual rather than build one.
- An existing design came back thin, wrong, or confusing and needs a corrective brief.

## Core Rules

- **A brief without a stated audience and one question is not finished.** See step 1.
- **Every factual claim must be traceable.** On the grounded branch that means `file:line`. On the
  ungrounded branch it means an assumption the user stated, recorded as an assumption.
- **Run the collision check.** Skipping it is how a wrong constant reaches a published page that
  readers then trust. See `GROUNDING.md`.
- Do not pad the brief with visual instructions the Designer is better at choosing. Give it facts,
  constraints, and the one question — then get out of the way.
- Do not let the brief grow a section per idea you had. Anti-goals are where scope is bought back.

## Workflow

### 1. Fix the audience and the one question

Write one sentence before anything else:

> A **[reader]** should be able to answer **[question]** from the artifact alone.

Examples that worked: _"An engineer onboarding to this repo should be able to answer: if I ask for
a new UI component with tests, which agents run and who can reject whom?"_ and _"A developer
should be able to answer: if I add this API call, does it cross the boundary?"_

If you cannot write that sentence, you have a topic, not a brief. Ask the user for the missing
half before continuing. Every later decision is judged against this sentence.

### 2. Choose the branch

Ask: **is there a source of truth that could prove this brief wrong?**

- **Yes — grounded.** Code, schema, config, logs, an API contract. The failure mode is _wrong
  facts_. Go to step 3a.
- **No — ungrounded.** A concept, a pitch, a proposed process nobody has written down. The failure
  mode is _vague facts_. Go to step 3b.

Mixed subjects are grounded. If any part of the brief can be checked against a file, check it.

### 3a. Grounded — do the legwork

**Read `GROUNDING.md` (sibling to this file) and follow it.** It is the long half of this skill
and the reason a grounded brief is worth more than a template.

Do not substitute documentation for source. Docs describe intent; the brief must describe
behaviour. Where the two disagree, the source wins and the disagreement is worth reporting to the
user.

### 3b. Ungrounded — interview until the abstractions have edges

The user is the only source of truth, so the brief can only be as sharp as their answers. Push on:

- **The one question** — if they cannot state who reads this and what it settles, nothing else
  matters yet.
- **The concrete referent** — for each element, what is it actually a picture _of_? "The user
  journey" is not an answer; "signup through first successful invoice" is.
- **The failure it prevents** — what does someone currently get wrong, and what does that cost?
- **What it is not** — the fastest way to find the edges of a fuzzy request.
- **Scale and shape** — how many things, how many steps, how many states. A brief that does not
  say "seven scenes" or "nineteen agents" leaves the Designer guessing at composition.

Record the answers in the brief as **stated assumptions**. Nothing here can be cited, so say so
plainly rather than implying a rigour the brief does not have.

### 4. Draft the brief

Use the anatomy below. Every section earns its place or is cut.

### 5. Verify before handing over

Run the completion criteria at the end of this file. On the grounded branch, the collision check
is not optional.

### 6. Close the loop (grounded only)

Require an embedded manifest so the artifact can be checked against the code later. See
**Machine-readable requirement** in the anatomy. Without it, the page starts rotting on the day it
is committed and no one finds out.

## The Brief Anatomy

Each section, in order. Cut any that is empty; do not invent filler to complete the set.

**What I want.** The artifact and its hard constraints. Default deliverable contract for this
repo: a self-contained HTML page, no CDN, no external assets, no network at load, correct in light
and dark. Add that a page with no template bindings ships far smaller, so interactivity should
earn its place.

**Why this exists.** State the concrete failure the artifact prevents, not the topic it covers.
"An engineer adds a convenience endpoint and quietly moves plaintext across a line they could not
see" produced a far better design than "document the vault architecture" would have. This section
is what makes the Designer choose the right hero.

**The system in one sentence.** If it takes two, the artifact probably needs to be two artifacts.

**The hero.** What must be visually obvious above everything else, and why it is the spine rather
than one element among many.

**Supporting panels.** One idea each. Name what each panel settles.

**Visual guidance.** Only what carries meaning: what must be distinguishable from what, what must
dominate, what must not be conveyed by motion or colour alone. Do not art-direct.

**Anti-goals.** What this is not. Always include the audience anti-goal where it applies — for
this repo, these pages are for humans, and the Designer should not compromise the reading
experience for machine consumption.

**Machine-readable requirement (grounded only).** One JSON block with the constants the artifact
asserts, so a check script can diff it against the exported source constants. Name the keys by
scope — `envelopeParseBytes`, `backendExportBytes` — never one ambiguous `maxBytes`. Ambiguous
names are how a wrong value survives review.

## Two Devices Worth Requesting

**The reading test.** A line inside the artifact that converts it from a poster into a review
tool: _"if your change adds an arrow leaving Zone A, it may carry ciphertext or metadata —
nothing else."_ Ask for one in every brief. It is what makes a diagram usable in a pull request.

**The halt.** If the artifact animates or steps through a process that pauses for a human in real
life, the artifact must pause too, and must not be advanceable past that point without an explicit
approval action. An animation that glides through a blocking gate teaches the opposite of the
truth.

## Splitting One Brief Into Two

A reference you consult and a story you watch once are different artifacts. Symptoms that a brief
is carrying both: the hero diagram needs a legend to be read at all; the page opens with a wall of
constants before any narrative; a single column has to show two opposite directions of flow.

When that happens, propose two canvases and say which is which. Do not silently write one brief
that tries to satisfy both readings.

## Completion Criteria

A brief is finished when all of these hold. State the branch you took when handing it over.

Both branches:

- [ ] The audience-and-one-question sentence is written and appears in the brief.
- [ ] Every section of the anatomy is present or deliberately cut.
- [ ] Anti-goals are stated.
- [ ] The brief specifies the artifact, not the aesthetics.

Grounded branch, additionally:

- [ ] Every number, identifier, and error code in the brief is traced to a `file:line`.
- [ ] **Every constant name has been searched repo-wide for a conflicting definition, and each
      distinct value is reported with its scope.**
- [ ] Source was read directly; no claim rests only on documentation.
- [ ] The machine-readable manifest requirement is included, with scope-qualified key names.
- [ ] Any contradiction found between docs and source has been surfaced to the user.

Ungrounded branch, additionally:

- [ ] Every element has a concrete referent, not a category.
- [ ] Assumptions are labelled as assumptions in the brief.
- [ ] Scale and shape are stated (how many things, steps, or states).
