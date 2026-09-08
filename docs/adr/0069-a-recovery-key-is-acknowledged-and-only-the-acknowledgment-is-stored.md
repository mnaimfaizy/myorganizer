# A Recovery Key is acknowledged, and only the Acknowledgment is stored

## Status

accepted

## Context

A Recovery Key is minted per Vault, shown once, kept by the User, and stored nowhere the product
can reach (CONTEXT.md, "Recovery Key"). Creation cannot mint before it writes the way Recovery Key
Rotation does — the wrapping has to exist to be shown — so the User's confirmation that they have
recorded it is creation's version of the same guarantee, moved after the write because it has to be
(CONTEXT.md, "Recovery Key Acknowledgment").

Issue [#667](https://github.com/mnaimfaizy/myorganizer/issues/667) split `VaultGate`'s `vaultStatus`
from the showing-the-key phase and held that phase in component state. A remount therefore knew
nothing: the key was gone, and so was any record that nobody had confirmed holding it. The grill
that produced #667 treated persistence as a separate product capability
([#668](https://github.com/mnaimfaizy/myorganizer/issues/668)), because nobody is blocked by its
absence and because the trade-off it records is only true once a durable record exists.

The naive persistences all collapse something the product has already decided. Storing the key in
`localStorage` would put a credential that opens the Vault next to the ciphertext it opens.
Storing it in `sessionStorage` is still plaintext at rest for the life of the tab. Keying a
boolean by owner alone would still be true after a claim, an import, a replacement or a rotation
moved the wrapping, and would need a hand-maintained list of clear-points that rot — the same
defect a Vault Meta Refusal closed by storing `{ metaHash, change }` rather than a flag
([ADR 0066](0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md)). Hard-gating
the remount is a dead end: the card cannot re-show a key it no longer holds.

## Decision

**A Recovery Key Acknowledgment is persisted as the absence of one: which wrapping is awaiting
confirmation, and never the key that opens it.**

1. **The record is a fingerprint, not a flag.** One durable per-User `localStorage` entry, keyed
   `myorganizer_recovery_key_acknowledgment_v1:<owner>`, holds a SHA-256 of that owner's
   `masterKeyWrappedWithRecoveryKey`. The comparison is derived the way a Vault Meta Refusal is:
   hash the wrapping this device now holds and ask whether it is the one recorded as unacknowledged.
   A wrapping that is not it is a different question, so a claim, an import, a replacement or a
   rotation retires the reminder with the wrapping. There is no session-scoped half: an owed
   Acknowledgment is not something a User dismisses until the tab closes.

2. **The key is never stored.** Consequence, accepted deliberately: on a remount the product knows
   an Acknowledgment is owed and cannot re-show the key. A Vault whose Acknowledgment was never
   given is not broken; it is a Vault whose Recovery Key nobody is known to hold. The way out is
   Recovery Key Rotation, which the passphrase alone authorizes.

3. **The hard-gate is same-session only.** Fresh mint still blocks until "I saved it", because the
   key is still in memory. After a remount the reminder is a non-blocking banner: fact-only and
   unclearable on the unlock screen (the User has no way to rotate from a locked session), and the
   same fact plus Rotate and an "I already have it" escape — confirmed, because it is a claim the
   product cannot verify — once unlocked.

4. **Removal is belt-and-braces.** `removeVault` clears the record alongside the Sync Bookmarks and
   Vault Meta Refusals. The fingerprint already makes a leftover about a gone wrapping inert; clearing
   it is consistency with its neighbours, not a third kind of retirement.

## Considered Options

**Persisting the Recovery Key in `localStorage`** was rejected because it collapses the threat
model CONTEXT.md states: whoever holds the key holds the Vault, and the product stores it nowhere
it can reach. A reminder that required the key to be at rest would be a reminder that made the key
unnecessary.

**Persisting the Recovery Key in `sessionStorage`** was rejected for the same reason in a weaker
form. It is still plaintext at rest for as long as the tab lives, and it still teaches the product
to reach a credential it is not allowed to keep.

**Keying the record by owner alone** was rejected because a boolean cannot tell one wrapping from
another. Every path that moves `masterKeyWrappedWithRecoveryKey` would then need an explicit
clear, and a missed one would accuse a Vault whose Recovery Key the User does hold. The fingerprint
is what makes that list unnecessary.

**Hard-gating the remount** was rejected because the card cannot show the key. Blocking unlock
until the User produces a secret the product just threw away is a dead end; offering rotation from
an already-unlocked session is the path CONTEXT.md already names.

## Consequences

`initialize` records the fingerprint after the write lands. `VaultGate` keeps the minted key in
component state for the same-session hard-gate and otherwise derives the reminder from the handle.
Losing a record, or failing to read one, costs a reminder that is not shown — never a Vault that
will not unlock, and never ciphertext. That is the direction this record is allowed to be wrong in,
the same direction ADR 0058 chose for a Sync Bookmark and ADR 0066 chose for a Vault Meta Refusal.

The Local Vault Revision now bumps on Recovery Key Rotation, which it previously did not. Ciphertext
readers do not need that bump; Acknowledgment readers do, or a banner that was true before the
rotation would stay on screen until the next remount. An extra reconcile pass after rotation is
idle work (no blob moved) and is accepted so the reminder and the wrapping cannot disagree.

ADR number 0067 was named in [#668](https://github.com/mnaimfaizy/myorganizer/issues/668) before
[ADR 0067](0067-a-vault-blob-is-never-taken-across-a-vault-identity.md) and
[ADR 0068](0068-a-locked-vault-blocks-exactly-the-operations-that-need-the-master-key.md) merged.
The number here is a claim until this file merges
([ADR 0042](0042-adr-numbers-are-claims-until-merged.md)).
