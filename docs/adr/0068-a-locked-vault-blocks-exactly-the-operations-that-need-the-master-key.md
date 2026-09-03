# A locked Vault blocks exactly the operations that need the Master Key

## Status

accepted

## Context

The Vault page carries six cards. Two of them — change passphrase and rotate Recovery Key — consult
`useVaultDisabledState` and disable themselves while the Vault is locked, with copy saying why. The
other four — import, export, remove, and cloud backup — do not consult it at all.

[#625](https://github.com/mnaimfaizy/myorganizer/issues/625) read that asymmetry as a security defect
and proposed the obvious remedy: require the Vault to be unlocked before importing, or require the
Master Key to be entered as part of the confirmation. Filed as a security issue, it also recorded that
nothing pins which Vault states permit which operations, and that neither card has a spec.

The asymmetry is real and the remedy is wrong, for a reason CONTEXT.md already states:

> Unlock is a plaintext-access boundary, not a network one: a locked Vault can still send and receive
> its own Ciphertext, because moving bytes that are already encrypted needs no Master Key. What a lock
> withholds is the ability to read them.

None of the four ungated operations reads plaintext. Import writes Ciphertext and both wrappings.
Export emits Ciphertext. Removal deletes local Ciphertext. Cloud backup uploads Ciphertext. Requiring a
passphrase to authorise a non-plaintext operation asks one question to gate a different one, and it
buys less than it appears to: knowing the passphrase proves knowledge of a secret, not that the
operation is a good idea, and a User who unlocks in order to import is no better informed about what
import does.

Gating export in particular buys nothing at all. `VaultController` carries `@Security('jwt')` at the
class level, so anyone holding a live Session can already read the Vault Meta and every Vault Blob from
the server — exactly the bytes an export bundle contains. A gate on the button, with the endpoint open,
raises effort for someone with a browser console and nothing for anyone else.

What the four operations do risk is real, but it is destruction and not disclosure. Import and removal
destroy this device's Local Vault, and import replaces the wrappings that open it. That is what #625 is
right to be worried about, and it is not a question a credential check answers.

## Decision

**A locked Vault blocks exactly the operations that need the Master Key, and nothing else. What a
destructive operation owes the User is an accurate account of what it will destroy, not a credential.**

1. **The locked policy is derived, not chosen per card.** An operation that must unwrap or rewrap the
   Master Key cannot proceed while locked, because it genuinely cannot run. Everything else proceeds.
   Change passphrase and rotate Recovery Key are blocked; import, export, removal, and cloud backup are
   not. The two cards that already gate were gating correctly, and now do so for a stated reason rather
   than by convention.

2. **Every card consults the shared state, and the answers are pinned.** The policy lives in one
   `satisfies Record<…>` table ([ADR 0053](0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)),
   so a seventh card cannot be added without stating what it does while locked. The present defect is
   not that anyone decided wrongly — it is that there was nowhere to write the decision down, so six
   authors decided independently and four of them never noticed there was a decision to make.

3. **Signed out and no Local Vault disable everything, uniformly.** This is correctness, not security:
   there is nothing to export, remove, or back up. Export currently consults nothing and fails at
   runtime in these states, which is invisible until someone presses the button.

4. **Destruction is answered by disclosure and recoverability.** Against someone at an unattended device
   holding a live Session, no dialog helps — they will click through anything. What protects the User is
   that what was destroyed comes back: import leaves the server's copy intact
   ([ADR 0063](0063-a-restore-discards-the-evidence-it-holds-about-the-server.md) made it forget its Sync
   Bookmarks so an imported wrapping cannot be pushed over the real one), removal clears only this
   owner's local keys ([ADR 0033](0033-local-vaults-are-user-owned-and-never-silently-destroyed.md),
   [ADR 0058](0058-a-sync-bookmark-is-a-second-per-user-namespace-not-a-second-vault.md)), and in-session
   recovery is what [#645](https://github.com/mnaimfaizy/myorganizer/issues/645) and
   [#647](https://github.com/mnaimfaizy/myorganizer/issues/647) are building.

5. **A destructive confirmation states what is unrecoverable, derived at the moment it is shown.** A
   fixed warning has to be written for the worst case, so it cries wolf on the common one and trains
   people to click past the sentence that matters. Removal names the Vault Blob Types with Ciphertext
   this device has never sent — `hasUnsentChanges` is derived, per type, and answerable while locked.
   Import compares the bundle's Vault Meta against the current one and says which of three things is
   about to happen: nothing changes; the wrapping reverts to the one in use when the backup was made; or
   this is a different Vault, whose passphrase and Recovery Key replace the User's and which this device
   will hold in place of the one the server has.

6. **Warn, never block.** ADR 0033's principle is that a Vault is never _silently_ destroyed, not that
   it is never destroyed — it rejected clearing-on-logout because silence was the harm. Blocking would
   also be paternalistic about the User's own data and useless against the actor it would be aimed at.

7. **The Escape Copy stays in the removal dialog, demoted.** It answers "do you hold an independent
   copy", which is worth saying. It cannot answer "is this safe": an Escape Copy has no freshness
   obligation and being months old does not make it broken (CONTEXT.md), so a backup from March says
   nothing about Ciphertext saved yesterday. It is currently the only recoverability signal that dialog
   reasons from, which is the wrong one.

## Considered Options

**Requiring the Vault to be unlocked before importing** is #625's first proposal and the intuitive one.
It is rejected as a category error: unlock is a plaintext boundary, import touches no plaintext, and the
check would neither inform the User nor stop the actor it is aimed at. Recorded here because the
asymmetry that prompted it is genuine and a future reader will propose the same remedy again.

**Requiring the Master Key to be entered in the confirmation**, #625's second proposal, was rejected for
the same reason in a stronger form. It reads as a consent ritual, but what it actually tests is memory of
a secret. A User restoring their own backup passes it while still not knowing their Recovery Key is about
to change, and someone at an unattended unlocked device passes it too.

**Blocking a removal that would destroy unsent Ciphertext** was considered and rejected. It is the one
option that genuinely prevents loss, and it takes the decision away from the person whose data it is. The
User who wants their Vault off a shared machine right now has a good reason, and ADR 0033 already settled
that the harm to prevent is silence rather than destruction.

**Gating export while locked** was rejected as security by obscurity once the Session already grants the
same bytes through the API. If exported bundles are judged too easy to obtain, the endpoint is where that
is fixed, not the button.

## Consequences

The fix lands somewhere other than #625 proposed and is smaller than it implies. Four cards were never
wrong about `locked`; they were wrong about `signed-out` and `no-local-vault`, where the operation is
impossible rather than unauthorised. What was missing was the written rule, which is why the page drifted.

Two confirmations become asynchronous. `hasUnsentChanges` hashes Ciphertext and the import comparison
reads the bundle, so both dialogs either compute before opening or render a pending state. That is a real
change to how they work, not only to what they say.

Import's disclosure gains a dependency on the Vault Identity classification, so it sequences behind
[ADR 0067](0067-a-vault-blob-is-never-taken-across-a-vault-identity.md)'s work, or at least behind that
classification being reachable from the import path.

The dangerous import becomes legible rather than merely survivable. A device that has taken a different
Vault holds one identity while the server holds another, which under ADR 0067 is a refused take and a
visible standoff rather than silent divergence — most of what #625 wanted from a gate, arriving by a
different route.

This ADR claims 0068 while 0067 is still an open claim on its own pull request
([ADR 0042](0042-adr-numbers-are-claims-until-merged.md)). The gap is deliberate and legal.
