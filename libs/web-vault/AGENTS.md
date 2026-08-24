# Web Vault Agent Guide

## Scope

Browser vault implementation using WebCrypto and web storage/client sync helpers.

## Commands

- Test: `yarn nx test web-vault`.
- Lint: `yarn nx lint web-vault`.

## Do

- Keep plaintext only in client memory while unlocked.
- Store and sync encrypted blobs for `addresses`, `groceries`, `mobileNumbers`, `subscriptions`, and `tasks`.
- Validate ciphertext bundle shape and size before import.
- Reach a Local Vault through `createVaultHandle({ owner })` ([ADR 0047](../../docs/adr/0047-vault-access-is-obtained-through-an-owner-bound-handle.md)). Storage is one entry per User, keyed by user id, with the owner written into the record.

## Do Not

- Do not send decrypted vault data to backend APIs.
- Do not persist master keys, passphrases, or recovery keys in plaintext.
- Do not remove the unsuffixed `myorganizer_vault_v1` slot, and do not promote it to an owned record without a Master Key unwrap. It is an Unclaimed Local Vault: a failed unwrap must leave it byte-identical, and until a claim succeeds it is still where that Vault lives, so a write goes back to it.
- Creating a Vault is the one write that does not go back to it. `LocalVaultSlot.createNew` lands in that owner's own entry rather than following the read, because a User who declines an Unclaimed Local Vault and makes their own must leave the declined one exactly where it was. Routing creation through `write` instead would destroy it, which is the escape path in [#496](https://github.com/mnaimfaizy/MyOrganizer/issues/496).
