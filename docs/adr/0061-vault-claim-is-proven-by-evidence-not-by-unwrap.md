# Vault Claim is proven by evidence, not by unwrap

## Status

accepted

## Context

[ADR 0047](0047-vault-access-is-obtained-through-an-owner-bound-handle.md) settled the shape of owner-bound Vault access and stated that a claim is proven by unlocking — that is, by successfully deriving the Master Key from a passphrase and unwrapping the ciphertext. That specific point does not hold in practice.

Key derivation uses the Vault's own salt (PBKDF2 with a per-Vault salt). Two people sharing a passphrase string therefore each derive the same Master Key independently, using only what they know. Either of them can unwrap the other's Vault, which means a successful unwrap proves only knowledge of a passphrase string — not ownership of the Vault.

This is what made a shared passphrase enough to open somebody else's Vault in the first place. The unwrap test alone cannot tell whose Vault this is.

Everything else in ADR 0047 stands: owner-bound handles, one entry per User, the owner written into the record, the unsuffixed slot left where it is.

## Decision

An Unclaimed Local Vault is reachable only on Vault Claim Evidence. A passphrase unwrap is never evidence on its own.

**Evidence outcomes:**

1. **Server Vault Meta matches**: The authenticated User can read their own Vault Meta from the server. Only that User could have written it, and it points to this Vault. This is the strongest evidence and requires nothing from the User — it decides the claim immediately.

2. **Recovery Key is offered**: A recovery key is minted per Vault and cannot collide across Users. Possession of it is definitive proof that the holder is the Vault's owner. This is the second line of evidence.

3. **Passphrase unwraps AND server Meta diverges:** The passphrase unwraps the Vault, AND the server's Vault Meta for the signed-in User differs from the Local Vault's meta. The divergence proves this device has moved the vault before (or has a different wrapping), which means this device is not an accidental lookalike or a guessed passphrase. This is evidence because it is coupled to this User's prior action. A passphrase alone cannot reach this evidence.

4. **Transport failure (no answer from server):** When the Claim Offer cannot reach the server to check Vault Meta, the check postpones rather than falling back to passphrase-only logic. Transport failure is not evidence — it is a retry condition. Falling back would allow a User who knows a shared passphrase to claim someone else's Vault if their network happens to fail at that moment.

## Scope Boundary

This decision closes the accidental path: a User on a device that holds plaintext or ciphertext, and a function that offers a Vault on passphrase alone. It does not defend against a User who can access the device's storage, read ciphertext directly, and guess or know a shared passphrase; nor against a Platform Admin with server access; nor against plaintext held on the device from prior sessions. These are out of scope for Vault Claim — they are persistence and privilege problems, not Vault access problems.

Overclaiming the scope — e.g., by trying to prevent a User with device storage access from accessing a Vault — would mean guessing at the capabilities of the device as a whole rather than the capabilities of a specific claim mechanism. That is worse than the original defect, because it replaces a known hole with an uncertain perimeter. Claim Evidence focuses on the Claim Offer and what it reveals to the wrong User without further access.

## Consequences

Vault Claim becomes a three-part check: does the server confirm this User's Vault exists here, does the Recovery Key match, or has this User rewrapped on this device before? Any of the three answers "yes, offer the claim." None of them require the User to enter anything — Recovery Key and passphrase unwrap are just checks made on what is already present.

The Claim Offer tells a User whether it can proceed, never whether a passphrase is "correct" in the abstract. This is important: offering the Claim Offer whether or not a Vault is present (so that it discloses nothing about what this device holds) means a User who enters a shared passphrase gets the same response as a User on a device holding nothing. The response says "I found evidence" or "I found no evidence yet" — not "the passphrase is wrong."

The server's Vault Meta is an input to the Claim check, not to the recovery check. A User unlocking an already-claimed Vault uses passphrase and Recovery Key like any other unlock; Vault Claim only uses it as supporting evidence that this device has seen this User's Vault before.

ADR 0047 decision (sections 1–3) remains in force: the handle is owner-bound at construction, page libraries never learn who the User is, and storage is one entry per User. Only the claim decision changes.

## Supersessions

This ADR narrows [ADR 0047](0047-vault-access-is-obtained-through-an-owner-bound-handle.md#decision), section 2 (where it stated "a claim is proven by unlocking"). Everything else in ADR 0047 stands.
