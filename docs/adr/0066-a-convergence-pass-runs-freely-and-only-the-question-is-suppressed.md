# A convergence pass runs freely and only the question is suppressed

## Status

accepted

## Context

Three runners in `web-vault-ui` ask the server what changed elsewhere. `VaultPullRunner` checks
every Vault Blob Type on mount and on window focus. `VaultReconcileRunner` and
`VaultMetaConvergeRunner` each run their pass at most once per tab session, guarded by a
`sessionStorage` boolean keyed `<prefix>:<owner>`.

The boolean is not arbitrary. It is the price the two asking runners pay for being allowed to ask:
`VaultPullRunner` buys frequent re-checking by never prompting at all (`prompt: () => 'defer'`),
and the other two buy the right to prompt by running once. Frequency and asking were traded
against each other, and the trade was made at the entry to the pass.

Making it there is what produced two defects, both reported as separate bugs and both the same
mistake. The guard sits ahead of the network call, so it suppresses the whole pass, while every
comment around it describes suppressing the _dialog_ — "leaving the flag unset is what brings the
choice back". It is documented as a rule about the question and implemented as a rule about the
pass.

[#596](https://github.com/mnaimfaizy/myorganizer/issues/596): a User who keeps a tab open — the
ordinary case — never learns their passphrase was changed on another device, because the meta pass
never runs again. A reload does not help; `sessionStorage` survives one. Closing the tab is the
only cure, and nothing says so.

[#628](https://github.com/mnaimfaizy/myorganizer/issues/628): after an explicit Local Vault removal
([ADR 0033](0033-local-vaults-are-user-owned-and-never-silently-destroyed.md)) the reconcile flag is
already set, so the reconcile never runs, so the "no Local Vault and the server holds meta →
download the wrapping" path is never reached. `VaultGate` reads `absent` and offers to **create a
new Vault** — minting a fresh Master Key and salt — while the server still holds the User's real
one. That is the most destructive control in the product, offered at the moment a User is most
likely to take it.

A third defect no one reported follows from the same shape. The boolean records that this owner was
asked _something_, not _what_ they were asked. A User who answers `keep-local` to a passphrase
change sets it for the session; a second, genuinely different wrapping change arriving afterwards is
swallowed in silence. Fixing the pass does not fix this — a boolean guarding the question swallows
it just the same.

[ADR 0058](0058-a-sync-bookmark-is-a-second-per-user-namespace-not-a-second-vault.md) already ruled
on this shape one layer down, for dirtiness: derived by comparing current Ciphertext to a record,
"never read from a stored flag", because a flag can be forgotten and nothing would then know. The
session flag is the shape that reasoning rejects, applied to prompts instead of pushes.

## Decision

**A convergence pass runs whenever its triggering event says something may have moved. Only the
question it might raise is suppressed, and it is suppressed by what was asked about rather than by
the fact that asking happened.**

1. **The guard moves off the pass and onto the prompt.** Reaching the server, converging what
   converges silently, and advancing what can be advanced are all cheap and are never suppressed.
   Deriving what this device owes needs no Master Key (ADR 0058), so a locked Vault is no obstacle.
   The only thing rationed is interrupting the User.

2. **The two runners take different triggers, because their events differ.** A wrapping changed on
   another device is a _remote_ event with no local signal, so `VaultMetaConvergeRunner` re-runs on
   mount and on window focus, the house answer for polling that `VaultPullRunner` already uses. A
   Local Vault removed on this device is a _local_ event the server knows nothing about, so
   `VaultReconcileRunner` re-runs on mount and on a Local Vault Revision bump — the signal that
   already exists for "what a reader holds is no longer what is stored", and which already fires on
   removal, import, and convergence-replacement. Reconcile does not take a focus trigger: "what
   changed on the server for blobs" is `VaultPullRunner`'s job, and duplicating it with a runner
   that _can_ ask is how a background pass starts interrupting people.

   **A reconcile triggered by the revision must not trigger itself.** `VaultHandle.saveVault` bumps
   the revision, and reconcile's own convergence writes through `saveVault` — so a runner that
   re-runs on every bump re-runs on the bump it just caused, forever. CONTEXT.md warns about this
   shape for the Vault Sync Sink ("feeding one from the other would be a loop, since convergence
   writes through the path the sink must not hear"), and the warning generalises to any consumer of
   the revision that also writes. Reconcile therefore records the revision it last settled at and
   re-runs only above that watermark. A watermark rather than a suppression window because the
   distinction being drawn is "has anything changed since I finished" — which is what the revision
   already answers — and not "was I the one who changed it", which would need reconcile to track its
   own writes and would go wrong the moment something else wrote during a pass.

3. **A refusal is recorded as a Vault Meta Refusal, keyed by the wrapping refused.** The question is
   raised only when the divergence found is one this device has neither agreed to (a Vault Meta
   Bookmark, [ADR 0060](0060-a-device-may-push-a-wrapping-it-wrote-over-a-server-it-can-prove-has-not-moved.md))
   nor already refused. `keep-local` records a durable refusal — it is an answer, and it holds until
   the question changes. Dismissal records a session-scoped one — it is "not now", and it holds
   until the tab closes. One comparison, two lifetimes; see the amendment to
   [ADR 0057](0057-vault-meta-converges-separately-and-never-silently.md) for why dismissal now
   records anything at all.

4. **`absent` is not offered without proof, exactly as `unclaimed` is not.**
   [ADR 0061](0061-vault-claim-is-proven-by-evidence-not-by-unwrap.md) already stops `VaultGate`
   rendering anything about an Unclaimed Local Vault until the server has answered. The `absent`
   branch had no equivalent and went straight to the create offer. It gets the same discipline: no
   offer to mint a new Vault while the question of whether the server holds one is outstanding. The
   trigger in point 2 makes the reconcile _run_; this makes the destructive control _unreachable_
   while it is running. Neither alone is enough — the trigger without the gate leaves a race the
   User can win, and the gate without the trigger leaves a spinner nothing resolves.

5. **A failed background pass says nothing.** Both runners currently toast on error and set the
   flag, which is honest when the pass runs once and will not be retried. Once passes repeat, it is
   neither: a server down for a minute would toast on every focus about a failure that is about to
   be retried. A transient failure is silent and retried on the next trigger. A terminal one — the
   Session gone — stops the runner for good and says nothing, the rule `vaultPullTrigger` already
   applies for the same reason. The surviving toast is the one a User earned by answering a dialog.

## Considered Options

**Clearing the reconcile flag inside `removeVault`** is
[#628](https://github.com/mnaimfaizy/myorganizer/issues/628)'s own first suggestion and the smallest
possible change. It is rejected because it builds a second, private signal for an event the codebase
already has a canonical one for, and because it covers removal alone: an import or a
convergence-replacement reaches the same `absent` state by a different door, and each would have to
remember to join the list. A Local Vault Revision bump already covers all three and cannot be
forgotten by a path added later.

**Putting Vault Meta on the existing Vault Pull trigger**, which #596 raises, was rejected because it
reads the problem as one of scheduling when it is one of permission. The two convergences
deliberately share nothing (ADR 0057), a Vault Meta check must never gate Vault Blob merging, and
`VaultPullRunner` never prompts — joining it would mean either giving the pull pass the right to
interrupt or giving the meta check no way to ask.

**Gating the meta pass on Server Reachability** is the intuitive way to stop erroring passes, and
CONTEXT.md forecloses it: Server Reachability "is therefore shown and never gated on", being an
observation about one moment that says nothing about whether the next call lands. Recorded here
because it is the first thing a reader will reach for.

**Keeping the boolean and re-arming it from more places** preserves today's shape for a smaller
diff. It is rejected for the reason ADR 0058 gives about flags generally: the correctness of a flag
depends on every writer remembering it, and the failure is silent. It also cannot fix the swallowed
second change, because a boolean has no way to tell one wrapping from another.

## Consequences

A device that sits open all day now notices a passphrase change within a focus event of it
happening, and a User who removes their Local Vault is offered their real Vault back instead of a
fresh one. Both were the point.

The two asking runners stop being interchangeable. They were near-verbatim copies — same flag
composition, same mount-only effect keyed on `[owner]`, same comment about deferral — and read as one
pattern instantiated twice. They are now two runners with different triggers and different error
postures, and the resemblance that remains is incidental. A future reader tempted to factor them
back together should read point 2 first.

`VaultGate` changes behaviour, and eight page clients compose it. This is not a two-runner fix; it
reaches every Vault-backed page. The `absent` branch in particular currently flashes the create
offer during any first sign-in on a clean device, before the download completes — a pre-existing
defect this makes visible rather than introduces.

Reconcile gains a settled-at watermark it did not have, because a once-per-session pass never needed
one. It is the cost of the revision trigger and not an incidental detail: without it the trigger is
an infinite loop, and it is the first thing to check if reconcile ever appears to run away.

A refusal is a fourth thing held per User on a device, beside the Local Vault, the Sync Bookmarks,
and the Vault Meta Bookmark. It is removed with the Vault by the same `removeVault`, for the reason
ADR 0058 gives about a stale bookmark: a refusal about a Vault this device no longer holds is
meaningless. Whether it belongs inside the existing bookmark record or beside it is an
implementation question, but it strains that record's scope sentence — "what this device owes the
server" — which has now been widened once already for the Vault Meta Bookmark. A refusal is not
owed. If it goes in there, the record needs a truer name.

## Amendment: an Unclaimed Local Vault is a question, not an absence

Decision point 2 puts Vault Reconcile on mount, and decision point 4 withholds the create control
while "does the server hold a Vault" is outstanding. Between them sat a case neither named. A
device holding an Unclaimed Local Vault resolves _no_ Local Vault for the signed-in owner
([ADR 0061](0061-vault-claim-is-proven-by-evidence-not-by-unwrap.md) — the slot is never offered
without evidence), so reconcile read it as absent. With the server holding that owner's Vault
Meta, the mount-time pass downloaded the server's wrapping into the owned slot. The device then
held an owned Vault beside the unclaimed one, and Vault Claim Evidence — which had been about to
claim the unclaimed one silently — found an owned Vault and raised the replace offer instead:
"replace this device's vault with the other vault that is also yours", where the two are the same
Vault ([#673](https://github.com/mnaimfaizy/myorganizer/issues/673)).

This was not a rare ordering. Silent claim fires only on `server-meta-match`, which requires the
server to hold Vault Meta, which is exactly the condition under which the download runs. ADR 0061's
first evidence outcome was reachable only by a race the layout-mounted runner always won, and the
race had a worse tail: the claim hook reads `vaultStatus()` before its fetch, so a claim that read
`unclaimed` and landed after the download copied the unclaimed slot over Ciphertext reconcile had
just converged.

**The rule of decision point 4 applies one step earlier. Reconcile does not run for an owner whose
device holds an Unclaimed Local Vault until Vault Claim Evidence has settled.** An unclaimed slot is
an open question about what the device holds, and a pass that downloads while it is out answers it
by accident. Once it settles, each answer says what the pass does: `claimed` leaves an owned Vault
and an ordinary `both` pass; `refused-not-this-vault` means the server holds the owner's real Vault
and it is not this one, so the pass downloads it as before; `no-evidence` is a noop; a postponement
is waited on, because the pass could not have reached the server either.

For reconcile to see the answer, **Vault Claim Evidence moves out of `VaultGate` and into the Vault
Session**, asked once per owner and read by both the gate and the runner. Vault Absent Evidence
moves with it: it is the same shape, it was duplicated across the same eight gates, and leaving it
behind would have the gate reading ownership proof from context and server-holds-a-Vault proof
from a local hook with nothing to explain the split. Lifting changes what re-asks a postponement —
there is no gate re-render in the session — so both checks keep the `online` event they had and
add window focus, the trigger `VaultMetaConvergeRunner` already uses for a remote event with no
local signal. Only a postponement is re-asked. A lost Session is not: there is no Session to ask
with, and a new sign-in is a new owner and a fresh question, so `session-lost` is terminal for the
owner it was answered for. Neither trigger is a prompt, so there is nothing here for decision
point 1 to ration.

The reconcile runner therefore has three triggers: mount, a Local Vault Revision bump, and
evidence settling. On `claimed` the claim bumps the revision and the settlement arrives as well;
the in-flight guard and the settled-at watermark make the second a no-op. On a refusal or an
absence only the settlement arrives, and it is the one that starts the download or the noop.

**Folding the claim check into the reconcile primitive** was the alternative. It already fetches
the same Vault Meta, and it would have removed the ordering rather than managed it. Rejected because
`reconcileVaultWithServer` is "a loop and a pair of degenerate cases" by design
([ADR 0054](0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)), and a claim is a
decision about ownership that ADR 0061 keeps structurally read-only in its own module. The gate's
hook would also have kept running, and the two writers would have remained.

A consequence worth recording so nobody reads it as a bug: the server-meta `replace-offer` is now
close to unreachable. It needs an owned Vault that differs from the server's Vault Meta while the
unclaimed slot matches it, and that state raises reconcile's whole-Vault "not the one on the
server" question first. The recovery-key replace path is untouched — a key proves a second Vault
is the User's without the server saying anything.
