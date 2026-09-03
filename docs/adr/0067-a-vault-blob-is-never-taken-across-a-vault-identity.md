# A Vault Blob is never taken across a Vault Identity

## Status

accepted

## Context

`convergeVaultBlob` is the single primitive every Vault Blob decision goes through — Vault Push, Vault
Pull, and Vault Reconcile all enter here, which is deliberate:
[ADR 0054](0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md) put the decision in one
place, and [#512](https://github.com/mnaimfaizy/myorganizer/issues/512) is what happens when it lives
in two.

It has two paths, and only one of them is guarded.

The dirty path — this device holds unsent Ciphertext — reaches `decideConflict`, whose doc says "the
order of the guards is the decision": locked first, then decryptability established by trying it, then
the pinned strategy. The clean path — nothing unsent, the server's copy differs — is four lines with no
guards at all, ending in `takeRemote`. Its comment states the premise: "the server's copy supersedes
this one without anything being lost."

That premise holds while both sides are the same Vault and fails completely when they are not. If the
Vault was re-initialized on another device, the server's Ciphertext is encrypted under a different
Master Key, and the clean path writes it into the Local Vault under this device's wrapping — correct
per [ADR 0057](0057-vault-meta-converges-separately-and-never-silently.md), which never swaps a
wrapping on the strength of a data answer. The result is that readable local Ciphertext is replaced by
bytes this device cannot open, with no prompt, no way back, and a Sync Bookmark now asserting the two
sides agree ([#571](https://github.com/mnaimfaizy/myorganizer/issues/571)).

What selects between the guarded path and the unguarded one is whether this device happened to have
unsent changes — which has nothing to do with the hazard. The same destruction is reachable from the
dirty path too: answering `keep-remote` to an `undecryptable-remote` prompt calls the same
`takeRemote`.

The insight that closes it already landed once, on the other convergence. A Vault Identity that moved
cannot be a rotated passphrase: rewrapping re-derives from the identity the Vault already holds, while
initialising mints a fresh one beside a fresh Master Key. `vaultMetaConverge` was taught this after a
User with two separately created Vaults was told their passphrase had changed and was offered the
button that would have bricked the device. The Vault Blob path never got it.

## Decision

**A Vault Blob is never taken across a differing Vault Identity, on any path, by any caller.**

1. **Detection is by Vault Identity, not by decryption.** The question "is the server's Vault this
   Vault?" is answered by the Vault Identity alone. Decrypting the remote blob would answer it too,
   and cannot be used: `takeRemote` is documented to work while the Vault is locked, and the clean
   path is precisely the path that keeps a locked device syncing. A check needing a Master Key could
   only guess or defer there, and deferring means a locked device stops pulling — a regression on the
   most common background case. A Vault Identity comparison costs one field and needs no unlock.

2. **Evidence goes in; the decision stays inside.** `convergeVaultBlob` does not fetch a Vault Meta.
   It is called once per Vault Blob Type inside a loop, so a self-fetching primitive would issue one
   request per type per pass, and reaching for the meta endpoint from the blob module would cross the
   separation ADR 0057 built structurally. The caller supplies what it observed about the server this
   pass — Vault Reconcile already holds it — and `convergeVaultBlob` classifies and decides.

3. **The parameter is required, not optional.** `remote` is optional because it is an optimisation; a
   caller that omits it gets a correct answer more slowly. This one is a safety guard, and optional
   would mean a caller can omit it and silently get the destructive behaviour back. Required makes the
   compiler enumerate every call site the moment it lands, the same instinct as
   [ADR 0053](0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md).

4. **The guard sits above the clean/dirty branch.** It is the first thing decided after the Local Vault
   is loaded. A guard on one branch is already the two-places shape #512 punished, and the dirty path
   reaches the identical `takeRemote` through a `keep-remote` answer.

5. **Refusal, not a prompt.** Vault Meta Converge already owns this conversation: `different-vault` is
   a Vault Meta Change with its own dialog and no adopt button. A second dialog would tell the User the
   same fact twice in one sign-in, which ADR 0057 already works to avoid for two prompts and would be
   worse for three. Vault Blob convergence's duty here is narrower and is the one currently failing:
   do not destroy readable Ciphertext while that is outstanding. Refusing needs no dialog, no Master
   Key and no unlock, so it behaves identically on a locked device and on the background pull that
   never asks.

6. **The standoff is visible as status, not as an interruption.** A silent refusal turns data loss into
   a stalled sync nobody can see — and worse once declining the Vault Meta dialog records a durable
   refusal, because the User can silence the only notification and leave Vault Blob sync stopped
   forever with nothing on screen saying why. The sync status carries it, persistent while true. Under
   this decision that indicator is load-bearing rather than decorative.

## Considered Options

**Decrypting the remote blob on the clean path** is what #571 assumes, and it is the intuitive fix:
it reuses `decideConflict`'s existing `undecryptable-remote` reason and establishes the answer by
trying rather than inferring. It is rejected because it cannot run on a locked Vault, which is the
state the clean path exists to serve. Every alternative there — guess, defer, or stop the pull — is
worse than a comparison that is exact and free.

**Asking instead of refusing**, with a new pinned ask reason, was rejected as the third dialog about
one fact. It also asks the wrong question at the wrong granularity: "keep yours or theirs?" per Vault
Blob Type, when the two sides are different Vaults, offers a choice where either answer discards an
entire Vault one type at a time. CONTEXT.md already holds that this question is whole-Vault — "it was
never per-record" — and Vault Reconcile already raises it there.

**Fixing it inside Vault Reconcile**, where the old whole-Vault byte comparison used to catch this
before [#554](https://github.com/mnaimfaizy/myorganizer/issues/554) deleted it, rebuilds the second
decision site that slice existed to remove.

## Consequences

A User who genuinely wants to abandon their Local Vault for the server's loses a route they have
today — answering `keep-remote` per type. That intent is better served by a deliberate whole-Vault
action than by a per-type dialog reached while syncing, but it is a capability removal and should not
ship unnoticed.

**This is preventive only.** A device that has already taken undecryptable bytes has lost that
Ciphertext, and nothing here recovers it. The Escape Copy is the only route back, and only if one was
made.

Vault Pull gains a Vault Meta fetch per pass, and the push path one per drain. With Vault Meta Converge
moving to the focus trigger
([ADR 0066](0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md)) and Server
Reachability already probing the same endpoint on focus, three readers now want the same server Vault
Meta on the same event. Sharing one fetch between them is not sharing a decision and is not forbidden
here, but the duplication is real and is named so it is not discovered as a surprise.
