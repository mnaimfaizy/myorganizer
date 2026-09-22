# A recovered User is prompted once to set a passphrase they know

## Status

proposed

## Context

A User reaches recovery because they could not remember their passphrase. Unlocking with the
Recovery Key hands them into the app, and the passphrase they forgot is still the live one on
every device.

[#593](https://github.com/mnaimfaizy/myorganizer/issues/593) made a reset possible and kept it out
of the Vault Gate. The gate's recovery branch only unlocks. The Vault page's passphrase card,
when the session's Vault Unlock Secret is the Recovery Key, drops the current-passphrase field
and resets without it. That signal is client-only session state: it is never written into the
Local Vault, and a lock or a later passphrase unlock clears it (CONTEXT.md, "Vault Unlock
Secret").

Permitting that reset is not the same as asking for it. After the "Recovered" toast there is no
prompt. A User who never opens the Vault page keeps the forgotten passphrase live by doing
nothing. [#714](https://github.com/mnaimfaizy/myorganizer/issues/714) is the decision #593
refused to make. The grill on 2026-09-18 chose a prompt with an explicit skip.
[#826](https://github.com/mnaimfaizy/myorganizer/issues/826) implements the prompt; this ADR does
not.

## Decision

**After a Vault Unlock whose Vault Unlock Secret is the Recovery Key, the User is prompted once
to set a passphrase they know. Skipping is allowed. Entering the app is not conditional on
rotating.**

1. **Prompted, with an explicit skip.** The prompt carries the reset itself — the same reset the
   Vault card already performs, which does not ask for the forgotten passphrase — and a control
   that declines it. A notice that only points at the card, and a card the User may never open,
   are both weaker than this and were rejected. Requiring a new passphrase before the app will
   open was rejected too.

2. **The prompt is not inside the Vault Gate.** The gate stays an unlock. Putting the reset back
   on the recovery screen is how the original control became unreachable: it rendered while the
   Vault was locked and disappeared at the moment it could be pressed. The prompt is the first
   paint of the unlocked dashboard in that recovery-unlocked session, after the gate has handed
   the dashboard through.

3. **Once per recovery-unlocked session, and nowhere else.** Skip is in-memory. It is not written
   down, not sent to the server, and not a new persisted "remind me next time". There is no such
   concept. The prompt does not return on later navigation in that session. It returns only when
   a later Vault Unlock is again by Recovery Key. A lock clears the Vault Unlock Secret, so it
   clears the prompt with it. A passphrase unlock does not prompt.

4. **A completed reset also ends the prompt for that session.** Setting the passphrase is the
   thing the prompt was asking for, so it does not ask again on the next paint. Completing it
   does not by itself change the Vault Unlock Secret: that secret still says this session was
   unlocked by Recovery Key until a lock or a later passphrase unlock. The Vault card may
   therefore still offer a reset without the current passphrase for the rest of the session.
   That authorization is #593's, and this ADR does not narrow it.

5. **After a skip, the permit path stays.** The Vault page card remains available for the rest of
   that session. Skip means "not now", not "the forgotten passphrase is fine and we will not
   mention a reset again while this session is recovery-unlocked". The copy says what skip
   leaves true: the forgotten passphrase stays the live one on every device.

6. **It is asked before a Recovery Key Acknowledgment that is still owed, and it is not that
   Acknowledgment.** Creation's same-session Acknowledgment — the hard gate while the newly
   minted key is still in memory ([ADR 0069](0069-a-recovery-key-is-acknowledged-and-only-the-acknowledgment-is-stored.md))
   — is not this prompt. The User just chose the passphrase they are creating the Vault with.
   What can stack is the remount banner: a non-blocking reminder, once unlocked, that nobody is
   known to hold the Recovery Key. A User can recover into a Vault that still owes that banner.
   The passphrase prompt is resolved first, by setting or by skipping. The banner is shown only
   after that. They stay two questions. One dialog that asked both would hide which secret was
   actually unresolved.

7. **Web only.** This contract is the web app. Mobile recovery unlock is not decided here.

## Considered Options

**Merely permitted** is what shipped with #593, and it was rejected as the recorded choice. The
card is real, and it is also easy to miss. Leaving the decision unmade would have kept that as
the behaviour without anyone choosing it. The card stays; it is the way back after a skip, not
the whole contract.

**Told, without a form** was rejected. A dismissible notice that the passphrase is still the
forgotten one is honest and still sends the User to find the card. The prompt is the form.

**Required before entry** was rejected. It is the option most likely to strand someone: a User
who recovered on a device they are about to stop using, or who cannot safely choose and record a
new passphrase at that moment, would have no way in.
[ADR 0068](0068-a-locked-vault-blocks-exactly-the-operations-that-need-the-master-key.md) is the
closest precedent and points the other way. A credential check is not how a risk is answered, and
Users are told the truth rather than stopped. Blocking entry to force a rotation is a different
gate from the ones ADR 0068 rejects, and the reasoning still holds: the person whose passphrase
it is has to be able to leave. The risk — a forgotten passphrase remaining live — is said in the
prompt, including on the skip control. It is not used as a lock.

**A hard redirect to the Vault page, and nothing else** was rejected. It hides the reset inside
navigation and can be walked away from without an explicit skip, which is option 1 with extra
steps.

**Asking again on every navigation** was rejected. The Vault Unlock Secret does not outlive the
session, and a nag that did would be a new persisted concept. This ADR does not add one.

**One dialog with the Recovery Key Acknowledgment** was rejected. The two questions have
different facts and different ways out. Merging them would make a skip (or an "I already have
it") answer a question the User was not asked.

## Consequences

#826 builds the prompt. Until it does, recovery still only permits a reset. The tests for the
prompt have to drive it through the UI — set, and skip — because an unreachable recovery control
is how #593 lasted as long as it did.

Skipping leaves the forgotten passphrase live. That is the accepted cost of not stranding the
User, and the prompt has to say so. Nothing in this decision writes a reminder for the next
session.

The same-session Acknowledgment hard gate on creation is unchanged. The remount banner waits
until the passphrase prompt has been set or skipped, and only when that banner is actually owed.
