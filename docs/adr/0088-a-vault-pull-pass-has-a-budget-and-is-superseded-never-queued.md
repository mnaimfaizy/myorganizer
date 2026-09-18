# A Vault Pull Pass has a budget and is superseded, never queued

## Status

proposed

## Context

`createVaultPullTrigger` serialises Vault Pull Passes through a `tail` promise chain, because two
passes at once would race two conditional reads and merges for the same Vault Blob Type. The chain
absorbs rejection — `tail.then(pass, pass)` — so a failed pass does not block the next. A pass that
never _settles_ does: `tail` never settles either, and every later `requestCheck` waits behind it for
the life of the tab ([#697](https://github.com/mnaimfaizy/myorganizer/issues/697)).

The route #697 considered — a pass parked on a dialog, as in #691 — is closed: the pull path's prompt
always defers and cannot await a User. The route left open is the network. The generated API client
sets no timeout, and the only `AbortController` in the web code is in `fxRates.ts`. One request that
never settles stops the device pulling, with no error, no retry, and a status indicator that still
reads `synced`.

Separately, the trigger stops for good on a `401`/`403`, and nothing reads that either: `session-ended`
is derived from the Vault Sync Queue alone, so a device that is reading but not editing stops pulling
silently today.

## Decision

**A Vault Pull Pass runs within a budget, a newer pass supersedes an outstanding one rather than
queueing behind it, and a pass that ends without its answers is reported.**

1. **Supersede, not queue.** A pass is started by a `focus` meaning "tell me what is true now"; one
   started earlier is answering a staler question. Aborting it avoids the same-type race the chain
   exists for, and a later pass can no longer inherit a park from an earlier one.
2. **Abort on the request and between types.** An `AbortSignal` reaches the in-flight request, which is
   what makes a stuck pass actually end; the pass also checks for cancellation before each type, which
   is what makes the common case cheap.
3. **A budget backs it up.** `VAULT_PULL_PASS_BUDGET_MS` (10 seconds) sits beside
   `VAULT_PULL_DEBOUNCE_MS` and is an injectable option of the trigger, so tests can shrink it. It lives
   in the trigger and never in the generated client, which is a synced output. A pass over budget
   aborts and ends with its unanswered types recorded as failed.
4. **A superseded pass resolves, it does not reject.** It resolves with a result marked `superseded`.
   A rejection would be absorbed by the chain and read the same as a failure, which is the one
   distinction this ADR needs kept.
5. **A partially applied pass is acceptable.** Each Vault Blob Type converges against its own blob and
   its own Sync Bookmark, so a pass aborted after some types have converged has left each of those
   complete. A pass aborted between writing a blob and recording its bookmark costs a repeated push,
   never an edit ([ADR 0058](0058-a-sync-bookmark-is-a-second-per-user-namespace-not-a-second-vault.md)).
6. **A pass that ends without its answers is a Vault Pull Stall.** A sixth Vault Sync Status Kind,
   `pull-stalled`, applies while the most recent pass left any type unanswered — over budget, a failed
   Vault Blob Inventory read, or a type it could not reach. It ranks below `pending` and above `synced`
   only: every kind above it is either about the User's own unsent edits or cannot be fixed by
   retrying, and this one can. It is state about the last pass, cleared by the next pass that gets every
   answer; a superseded pass never sets it.
7. **Pull feeds `session-ended`.** The trigger exposes its status in memory the way the Vault Sync
   Queue does, and `sessionEnded` becomes true when either has seen a `401`/`403`. No new kind and no
   new copy.

## Considered Options

- **Keep the queue, add a deadline.** Fixes liveness, but keeps a bounded stall behind every slow pass
  and answers each `focus` with a result that is already out of date.
- **Supersede without aborting.** A superseded request that never settles would stop blocking but keep
  holding its socket.
- **Stay silent on a stalled pass**, since the next `focus` retries it. Rejected: silent cessation is
  what made #691 expensive to diagnose.
- **One status for a stall and a lost Session.** Rejected: one is fixed by retrying and the other is
  not, so any single affordance is wrong for one of them.

## Consequences

- #697's missing test becomes this decision's regression test: a later `requestCheck` runs while an
  earlier pass never settles. It is written red against the current chain.
- Adding `pull-stalled` to `VAULT_SYNC_STATUS_KINDS` fails to compile at the rules and readings tables
  until both say what it reports, as [ADR 0053](0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)
  intends.
- Two trigger instances still share no chain; supersede does not coordinate between them. Under
  [ADR 0087](0087-a-vault-pull-pass-asks-the-vault-blob-inventory-and-absence-deletes-nothing.md) a
  duplicate pass costs one `304`, which is why that is left alone.
