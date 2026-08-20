# Local Vaults are User-owned and never silently destroyed

## Status

accepted

## Context

A Vault has always been strictly User-owned on the server — `EncryptedVault.userId` is `@unique`, cascading on User delete. On the client it was not owned by anyone: the browser held a single `myorganizer_vault_v1` localStorage slot with no owner recorded in the record shape, and nothing ever cleared it. Any User signing in on that browser inherited whatever Vault was already there.

That asymmetry produced issue #318. A second User registering on a browser where someone had already signed in inherited the first User's Local Vault, had that User's Ciphertext uploaded into their own server-side Vault, was shown a "Vault migrated" toast, and was then asked for a passphrase they had never set — never reaching the new-Vault and recovery-key flow at all. It was both a cross-account write path and a dead end for the new User.

## Decision

A Vault is owned by a User on every surface it appears on. A device may hold several Local Vaults, at most one per User who has signed in there, and never adopts one on a User's behalf.

1. **Local Vaults are scoped per User.** Storage is keyed by user id; loading a Vault requires knowing whose it is.
2. **Legacy unowned Vaults are claimed by unlock.** A pre-existing `myorganizer_vault_v1` has no owner field, so ownership cannot be read from it. It is offered to a signing-in User who has no Local Vault of their own, and becomes theirs only if the Master Key unwrap succeeds. A failed unwrap is proof it belongs to someone else, and it stays unowned.
3. **Logout keeps the Local Vault.** Removal is an explicit action in vault settings. Automatic discard happens only against a confirmed server copy of the same Ciphertext.

## Considered Options

**Clearing the Local Vault on logout** was the obvious reading of #318 and is rejected deliberately, because a future reader will suggest it again. Once Vaults are User-scoped, clearing is not needed for correctness — a second User cannot reach the first User's Local Vault, which is keyed to them and unlockable only by their passphrase. What clearing would add is silent destruction of any Vault whose contents were never uploaded, during the most routine action in the app, in a system where the server holds only Ciphertext and cannot help anyone recover. The costs are not comparable: keeping leaves encrypted bytes in localStorage, clearing wrongly loses user data permanently.

**Adopting a legacy Vault on first sign-in** was rejected for the same reason in smaller form. It is correct for the single-User browser that covers nearly every install, but it reproduces #318 whenever the next User to sign in is not the owner — converting a permanent bug into a one-time race, and closing the reported case without fixing it.

## Consequences

Several Users' Ciphertext may sit in one browser at once. Each stays encrypted under its own Master Key and is useless without that User's passphrase, so this is a storage-footprint cost on shared machines, not a confidentiality one — and it is the cost deliberately accepted in exchange for never destroying unsynced data.

The one-time Phase-1→Phase-2 migration is retired rather than rescoped. No Phase-1 Vaults remain in production, and its framing had become misleading: it told brand-new Users their Vault had been "migrated". It is replaced by a per-User reconcile on sign-in, in which "no server Vault yet" is an ordinary first sync rather than a migration event.
