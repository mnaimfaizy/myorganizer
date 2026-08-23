# Interrupted slices resume from git, and destruction is the deliberate act

## Status

accepted. Amended by [0044](0044-a-resumed-slice-is-told-what-the-previous-run-did.md): the two guardrails asserting that a checkpoint is unchecked and un-piped apply only to a genuinely interrupted run, and a resumed agent is now told what the previous run reported doing.

## Context

Sandcastle agents authenticate against a Claude subscription, which shares the same five-hour quota window as interactive sessions. A slice that exhausts that window is killed mid-run. This is not an edge case: it is the expected outcome of dispatching a PRD of any size overnight.

When it happened to slice #396, the orchestrator lost the work. `finalizeSliceBranch` exists precisely to capture an agent's leftover uncommitted changes, and the success path calls it — but the crash path does not, so the diff stayed uncommitted. Worse, the next dispatch of the same slice force-deletes the branch and its worktree before recreating them from the base ref, so re-running was not "starting from scratch"; it was destroying the previous attempt first, silently, with no preview and no prompt, because `--prd` mode confirms nothing.

Two further facts shaped the design. The thrown `AgentError` does not carry the quota message — it carries whatever was last on stderr, which in practice was an unrelated trust-dialog warning — so the real cause was legible only in the slice log file. And no agent session was captured, because session capture runs only after a successful agent invocation. The interrupted agent's reasoning is unrecoverable. Only its diff survives.

## Decision

An **Interrupted Slice** is preserved, not discarded. The crash path commits the dirty worktree as a **Slice Checkpoint** on the slice branch, and the next dispatch **resumes by default**. Discarding requires `--fresh`, which targets a single slice through the existing `--issue` flag.

Resumability is a fact about **git**, not about the tracker. A slice branch that exists and is ahead of the base ref is resumable; nothing else is consulted. A sidecar file may cache a `sessionId` as an optimisation hint, but if it disagrees with git, git wins.

Resume is guarded by `merge-base(sliceBranch, baseRef) == baseRef`. Slices stack — each is cut from the live feature head so it builds on every integrated predecessor — so a checkpoint left behind while later slices integrated is based on a superseded head. When the guard fails the slice is reported and skipped, with the branch left intact. It is not rebased automatically and it is not deleted.

A resumed agent is given an **audit-first** prompt: the original slice brief, an inventory of the checkpoint, and an instruction to assess what is actually done against the acceptance criteria and report that before editing anything. It must not reset, rebase, or amend the checkpoint; corrections go forward as normal commits. Critically, **files present in a checkpoint do not satisfy a Gated Pipeline** — a resumed `gate:full` slice that finds a spec file in the tree must still route it through `TestScaffold → TestReviewer → TestRunner`, because "the file exists" is not "the pipeline ran".

For the same reason, **nothing in a checkpoint has passed a deterministic check**. The preservation commit uses `--no-verify` deliberately, so husky never lints work that was half-written when the run died — which means lint, `tsc`, and the suite have not once seen it. A resumed agent must run them over the checkpoint’s files before reporting the slice complete. Auditing a checkpoint for _completeness_ and checking it are different acts, and the first live resume proved an agent will do the former and skip the latter.

A maintainer's conclusions reach the next run through a **`## Maintainer Review`** comment on the Slice Issue. The orchestrator interpolates only an issue's _body_ into a prompt, so review left as an ordinary comment is invisible to every agent — #396 was dispatched three times while three reviewed findings sat unread in its thread. Comments are opt-in rather than wholesale because the orchestrator posts its own status comments (Pipeline Incident notices, unblock notices) on the same issues, and replaying those back is noise at best and stale instruction at worst. Notes are appended after the issue body and declared binding, so a resumed agent treats them as an amendment to the brief rather than weighing them against the acceptance criteria and choosing.

Quota exhaustion may also be waited out rather than crashed on, via an opt-in `--wait-for-quota`, capped at two waits per run. Detection is a scan of the tail of the slice log, since the thrown error does not carry the cause. If the reset timestamp cannot be parsed, the run does **not** sleep a guessed interval — it crashes with the checkpoint preserved and says why.

`maxIterations` drops from 25 to 2.

## Considered Options

**A `status:interrupted` label** was rejected because a slice branch is local and unpushed. The codebase had already ruled on this: the standalone success path deliberately declines to mark `status:done` on the grounds that "marking it done here would lie about work that only exists on an unpushed local branch". A state label asserting resumable work on a shared tracker has the identical defect and is worse, because a second reader — or the same person on another checkout — sees resumable work that is not there. Locally-true facts go in issue comments, which read as reports; globally-true facts go in labels, which read as state. It also avoids adding a fourth term to three selection predicates that already disagree about `status:in-progress`.

**Keeping the destructive behaviour as the default, behind an opt-in `--resume`,** was rejected. Nobody can be relying on the current behaviour deliberately, because nobody could observe it: no preview, no confirmation, no record. The sharp edge should require an argument, not the safe path.

**Refusing to run when a checkpoint is detected** was rejected. It converts every interrupted overnight run into a hard stop, which defeats AFK dispatch — and quota exhaustion happens precisely when nobody is at the keyboard.

**Forwarding `--fresh` through `dispatch-waves`** was rejected, and waves rejects the flag outright. `--fresh` is a surgical instruction about one attempt a human has inspected and judged worthless. Waves is a bulk unattended driver across an entire PRD, so combining them means "discard any checkpoint you encounter anywhere", which reintroduces the exact blast radius this ADR removes. The precise path already exists: discard one slice with `--prd <n> --issue <n> --fresh`, then re-run waves.

**Waiting for quota by default** was rejected. A dispatch that goes silent for five hours with no output is a severe surprise, and an opt-in flag documents the behaviour at the call site.

**Inlining the checkpoint diff or the previous log into the resume prompt** was rejected. It spends the context the resume is meant to conserve on material the agent can read from git in one command, and a tool-call transcript describes work whose outcome is already visible in the tree.

**Leaving `maxIterations` at 25** was rejected once the loop's semantics were established. Iterations 2..N do not resume the session and each spins a fresh sandbox, re-runs the dependency install, and receives the identical prompt. They are cold restarts, not continuations: an agent that failed to signal completion once meets the same wall again, at full price. Sandcastle's own default is 1; 2 buys one honest retry for a transient container fault. Genuine continuation is the resume path, which supplies a different prompt.

## Consequences

A Slice Checkpoint reaches the feature branch's history and, from there, the PRD pull request. This is deliberate: the checkpoint is the anchor a human diffs to see what the interrupted run actually produced. Squashing it away would remove the only record that a slice was interrupted at all.

Resume costs a re-orientation pass. Because the agent session cannot be captured on a crash, "resume" means handing a fresh agent a diff and a checklist, not continuing a conversation. It is cheaper than restarting and more expensive than never having been interrupted.

`dispatch-waves` aborts the whole driver on any incomplete slice, so a single interrupted slice still stops every wave behind it. Waiting is therefore worth more under waves than under a plain dispatch, and `--wait-for-quota` is expected to be the normal thing to pass there.

Waves gates by rewriting `ready-for-agent` across all slices and exits without restoring them. After an abort, later waves' slices have had the label stripped, so recovering with a plain `dispatch-agents` run sees only the aborted wave. Waves does not restore the labels — a failure path that mutates several issues on the way out can half-complete and leave the tracker worse than it found it — so the abort message must name the recovery explicitly instead.
