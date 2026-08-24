# Vault access is obtained through an owner-bound handle

## Status

accepted

## Context

[ADR 0033](0033-local-vaults-are-user-owned-and-never-silently-destroyed.md) settled that a Vault is owned by a User on every surface it appears on. It says nothing about how code obtains one, and the code answered that question badly: `libs/web-vault` exposed plain module functions — `loadVault()`, `saveVault()`, `loadDecryptedData()`, `saveEncryptedData()` — that read a single device-wide `myorganizer_vault_v1` storage slot. None of them took an owner, and none of them could, because nothing in the vault libraries knew who the signed-in User was.

That is not a detail of the bug in #318; it is the bug. A function that resolves a Vault without being told whose it is will resolve someone else's, and every caller is one refactor away from doing so. Making ownership a convention that reviewers enforce is what produced a cross-account write path in the first place.

The scale matters to the decision. `loadDecryptedData` and `saveEncryptedData` alone have 117 call sites across eight page libraries and the dashboard widgets, and every other exported vault function calls `loadVault()` internally. Whatever shape ownership takes, it is paid for 117 times.

## Decision

Vault access is obtained, not invoked. A caller acquires a handle bound to one owner and one unlocked Master Key, and calls methods on it. There is no unbound vault function to call.

1. **The handle is owner-bound at construction.** It is created in `VaultSessionProvider`, which sits inside the dashboard layout — below the auth guard, above every vault-consuming page — and is the one place that resolves identity. When the owner changes or becomes undefined, the provider clears the Master Key and locks the Vault.

2. **Page libraries never learn who the User is.** They receive the handle and call `vault.loadDecryptedData({ type, defaultValue })`. A tasks page has no business holding a user id, and under this shape it does not.

3. **Storage is one entry per User, keyed by user id,** with the owner also written into the record. The key is the index; the field is the assertion, so a mis-keyed or hand-edited entry is detectable rather than silently trusted. A claimed Vault is rewritten into the current record version so that no reader carries a claimed-or-created branch forever.

4. **The pre-existing unsuffixed slot is left where it is** as an Unclaimed Local Vault, and is resolved only by Vault Claim.

## Considered Options

**Threading a `userId` parameter through every exported function** is the obvious reading of "a callerless load must not be possible" and is rejected because it does not actually make one impossible. Nothing stops the next contributor from adding a function without the parameter, and the compiler would not care. It also forces 117 call sites — and every page component behind them — to obtain an identity they otherwise have no reason to hold, pushing knowledge of Users into libraries whose entire job is rendering tasks and addresses.

**A module-level active owner** set once at sign-in is rejected for the reason it is tempting: it is the smallest diff. It swaps an ambient Vault for an ambient owner and keeps the property that caused #318 — a global whose correctness depends on something having been set earlier, somewhere else, in the right order. The bug moves rather than closing.

**Storing all Users' Vaults in one keyed record** was rejected on the failure mode rather than the ergonomics. Independent entries mean one User's write cannot corrupt another's; a shared blob means every save rewrites everyone's ciphertext, and a single bad write loses all of it at once. Where the server holds only ciphertext and cannot help anyone recover, that asymmetry decides it.

## Consequences

The vault libraries gain a dependency on the auth library. This is a real coupling and it is the correct one: a Vault cannot be resolved without an owner, so the code that resolves Vaults must be able to learn who that is.

Vault access no longer looks like the rest of the repository, where modules export plain functions. That inconsistency is deliberate and is the reason this ADR exists. A future reader who "simplifies" the handle back into module functions reintroduces #318, and should find this document before doing so.

Reaching this shape requires a migration window in which the old module functions survive as a thin shim delegating to the handle. During that window a callerless load remains possible, so the invariant this ADR asserts is true only once the shim is deleted. The deletion is therefore not optional or deferrable — a half-migrated codebase reads as fixed and is not.

Mobile is unaffected. It never persists a Local Vault: it fetches vault meta from the server, derives the Master Key, and unwraps in memory. Its `VAULT_STORAGE_KEY` constant has no consumers, tracked separately in #485.
