# A PRD is gated once, on the assembled feature branch, and the gate reports instead of blocking

## Status

accepted. Amends [0010](0010-sandcastle-local-only-integration.md).

## Context

[ADR 0010](0010-sandcastle-local-only-integration.md) made the build gate fail-closed: a slice that does not pass is not integrated and not marked `status:done`, "so we never stack later slices on broken code." Sound in isolation. Combined with `dispatch-waves`, which aborts the driver the moment a slice does not reach `status:done`, it produces a failure mode that defeats the point of unattended dispatch.

PRD #446 demonstrated it twice in one night. Wave 1's two slices both failed the gate, so neither integrated, so the driver aborted and waves 2 and 3 never ran. Six slices of planned work, three dispatch runs, roughly forty sub-agent invocations, and **nothing integrated**. Neither failure was the code:

1. `nx show projects --affected` was invoked without `--json`, so the gate could not parse the project graph and failed closed on every slice.
2. `NX EACCES, Permission denied 'dist/apps/myorganizer/public'` — a Node 22.17 `cpSync` regression on Docker bind mounts, hit after the build had already compiled and typechecked.

Both were environment faults in the gate itself. Under fail-closed-and-abort, a bug in the verifier is indistinguishable from a bug in the work, and it costs the entire PRD. This matters specifically because these runs happen overnight: the maintainer is asleep, cannot triage, and wakes to a run that stopped hours in with nothing to show.

There is a second, quieter problem. A per-slice gate compares one slice against the head it was cut from. Two slices that each pass individually but break **each other** are invisible to it, and surface on the PR. The scope that would catch them — the assembled feature branch against `origin/main` — is exactly the scope CI runs, and it was never gated at all.

Per-slice gating is also the expensive path: every gate is a fresh worktree plus a full in-container `yarn install` plus `nx run-many`. Six slices means six installs to verify a branch that will be reviewed as one unit.

## Decision

**A PRD is gated once, on the assembled feature branch, against `origin/main`.** Not per slice.

- **Slices integrate unconditionally in PRD mode.** Any slice that produced work fast-forwards into the local feature branch and is closed with `status:done`. `status:done` now means _integrated_, not _verified_.
- **The gate runs at the end, on `origin/main...feat/<slug>`** — the same scope the eventual PR gets from CI, and the only scope that can see two slices breaking each other.
- **The gate reports; it does not block.** There is nothing left to protect by the time it runs. A red gate leaves every slice integrated, every slice branch intact, and nothing pushed.
- **`dispatch-waves` no longer aborts on an incomplete wave.** It records the wave, continues, and reports everything at the end. Later waves may depend on the failed one and may fail too; a PRD that runs to the end and reports is still strictly more useful than one that stopped at wave 1.
- **The verdict is posted as a comment on the PRD issue**, not only to the terminal. Terminal scrollback is gone by morning and the run may have finished hours earlier; the issue comment is what reaches a phone.
- **Standalone (`--issue` with no `--prd`) keeps its per-slice, fail-closed gate.** Its work branch _is_ the deliverable, so there is no later gate to defer to.

Because `dispatch-waves` invokes `main.mts` once per wave, "once at the end" cannot live inside `main.mts` alone. Two flags carry it: `--defer-gate` suppresses the end-of-run gate (the driver passes it to every wave), and `--gate-only` runs just the feature-branch gate and exits (the driver calls it after the last wave). A direct `dispatch-agents --prd <n>`, with no driver, gates at the end of its own run — which for a single invocation is the same thing. `--gate-only` requires no agent credential, because it launches no agent.

## Considered Options

**Feed a failed gate back to the agent that produced the slice** was rejected. Every iteration is a cold sandbox with a fresh install and the full prompt at full price, and both real failures were environmental — the agent would have burned a quota window "fixing" code that was never broken. It also converts a deterministic check into an open-ended agent loop, which is the opposite of what a gate is for.

**Keep per-slice gates but make them non-blocking** was rejected as the primary design, though it is close. It preserves per-slice attribution, which the chosen design gives up. But it keeps all N installs, and — decisively — it still cannot see cross-slice breakage, so it would leave the PRD ungated at the scope that actually ships. Retained in spirit: the per-slice verdict still reaches the log as a `HANDOFF:` marker ([ADR 0043](0043-a-resumed-slice-is-told-what-the-previous-run-did.md)) when a gate does run.

**Gate once per wave** was seriously considered and is the strongest alternative. Three gates instead of six or one on a PRD like #446, attribution narrowed to a wave, and a broken wave caught before the next stacks on it. Rejected for cost against benefit: it triples the gate spend to narrow a bisect that `git log --oneline origin/main..feat/<slug>` already makes cheap, and it still misses interactions between slices in _different_ waves. Worth revisiting if PRDs grow long enough that a full-branch bisect stops being trivial.

**Leaving slices open until the gate is green** was rejected. It keeps `status:done` meaning "verified", which is tidier, but a re-run would then re-dispatch slices whose commits are already in the feature branch, risking duplicate work and duplicate commits. Both `main.mts` and `dispatch-waves` skip on `status:done`; that skip is what makes re-runs idempotent, and it must key on something that is true.

**Keeping the abort so a failure is impossible to miss** was rejected. The abort did not make failure visible — it made it _total_. Visibility is better served by a verdict on the PRD issue, which is legible in the morning, than by a run that stopped.

## Consequences

- An unattended PRD now always runs to the end. This is the whole point.
- **The feature branch can contain unverified code**, and a broken slice can compound into every later slice. Accepted: nothing is pushed, `git branch -f` is reversible, every slice branch survives, and the human QA before the PR was always the real gate for a local branch.
- **Per-slice attribution is lost.** A red feature gate says the branch is broken, not which slice broke it. Mitigated by ordered slice commits — `git log --oneline origin/main..feat/<slug>` — and by the slice branches remaining intact for individual re-gating.
- Gate spend drops from one container install per slice to one per PRD.
- The gate now catches cross-slice breakage it structurally could not see before, so a green PRD gate is a much stronger signal than N green slice gates were.
- `status:done` weakens from "verified and integrated" to "integrated". ADR 0010 tied it to a green gate; that tie is cut here. Re-run idempotency is unaffected, since it only ever needed "this slice's commits are in the branch".
- `dispatch-waves` still leaves `ready-for-agent` mid-rewrite when a run ends, so recovery is still "re-run the wave driver, not a bare dispatch". The abort removal makes that trap rarer, not gone.
- Exit codes stay meaningful: the driver exits non-zero if the gate failed or any wave was incomplete, after everything has been integrated and reported.
