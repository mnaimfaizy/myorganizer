# An agent branch carries its issue in its first commit

## Status

accepted

## Context

[ADR 0071](0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md)
gives `/code-review` two axes. The Standards axis reads the repository's own documents and needs
nothing from the ticket tracker. The Spec axis reads the originating issue and asks whether the diff
does what the issue asked for. Without a spec source the Spec sub-agent is skipped and the validator
drops the effective tier one level, because the spec contributes one step of confidence.

The spec source is discovered in a fixed order (`tools/scripts/review/resolve-spec.mjs`): the branch
name `<type>/<issue>-<slug>`, then a GitHub-style issue reference in a commit, then nothing.

Agent-authored work fails the first step by construction. `yarn dispatch-agents` integrates a PRD's
slices into a local `feat/<prd-slug>` branch, and the slug is the PRD's **title**, not its number;
the pull request a human opens for the PRD is opened from that branch. The other agent prefixes,
`claude/…` and `copilot/…`, carry no number either, and `AGENTS.md` says to leave those names alone
— renaming them is not available as a fix.

So the review ran with one axis on the pull requests that most need two. Agent-authored work is
precisely the work a human did not write, did not watch being written, and is reading for the first
time in review.

The obvious-looking fix is to accept the pull request **body** as a spec source. It is rejected. On
agent-authored work the body is written by the same agent that wrote the code, after it wrote the
code. Checking a diff against its author's own summary of that diff is a tautology: the Spec axis
would report clean on work that does the wrong thing flawlessly, and it would report clean most
confidently exactly when the agent misunderstood the issue, because a misunderstanding is carried
identically into the code and into the summary of the code.

## Decision

1. A branch whose **name** carries no issue number carries the issue in its **first commit**, as a
   `Closes #<issue>` line. Nothing about the discovery order changes: the commit step already reads
   exactly this shape.

2. `yarn dispatch-agents` writes that commit itself when it creates a `feat/<prd-slug>` integration
   branch, before any slice branch is cut from it. It is an empty commit, written with
   `git commit-tree` — the branch is not checked out at that point, and plumbing needs no worktree
   and runs no hooks, so there is nothing to skip with `--no-verify`. Being empty, it changes no
   diff, no `origin/main...feat/<slug>` gate scope, and no fast-forward.

3. A slice agent ends its own commit body with `Closes #<slice-issue>`. The slice branch name
   already carries the number; the commit is what survives integration into a branch whose name
   does not.

4. The message is built by `tools/scripts/lib/sandcastle-spec-anchor.mjs`, whose tests assert
   against the real `discoverSpec` rather than restating its regex. The two are a contract, and a
   test that restates the pattern passes while the contract breaks.

5. Agent-orchestrated work originates from a Slice Issue or a PRD Issue, so the reference always
   points at something a reviewer can read. Nothing in the orchestrator invents an issue number.

6. **A pull request body is not a spec source**, for the reason above. If a future change admits
   one, the envelope must record the spec as author-derived and it must not satisfy the tightening
   step — it is weaker evidence than a tracked issue, not equal evidence from a different place.
   This is recorded in the skill beside the discovery order, not only here.

## Consequences

- An agent-authored pull request reaches the reviewer with a resolved spec, and both axes run, with
  no new discovery step and no change to `resolve-spec.mjs`.

- The PRD issue closes when its pull request merges, because the anchor is a closing reference. That
  is the behaviour a PRD branch wants; a branch that should not close its issue must not be anchored
  with `Closes`.

- Branches created before this decision have no anchor. They resolve a spec only if one of their
  commits happens to reference an issue, and otherwise review one axis, as they did before.

- `branchNameCarriesIssue` duplicates the resolver's branch regex. The duplication is deliberate and
  guarded: one test asserts the two agree across every prefix the repository uses, so the copy
  cannot drift into anchoring a branch that needed no anchor, or skipping one that did.
