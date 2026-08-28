# Web Vault Agent Guide

## Scope

Browser vault implementation using WebCrypto and web storage/client sync helpers.

## Commands

- Test: `yarn nx test web-vault`.
- Lint: `yarn nx lint web-vault`.

## Do

- Keep plaintext only in client memory while unlocked.
- Store and sync encrypted blobs for every Vault Blob Type in `VAULT_BLOB_FIELDS` (`src/lib/vault/vaultBlobFields.ts`). That table is the list; do not restate it here.
- Fan out over the blob types by iterating `VAULT_BLOB_TYPES` and indexing `VAULT_BLOB_FIELDS`. Do not hand-enumerate members in an object literal, an if-chain, a union, or a run of `if` statements — `yarn enum:fanout:check` fails it ([ADR 0053](../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
- Converge a Vault Blob through `convergeVaultBlob` (`src/lib/vault/vaultConverge.ts`) — it is where a convergence decision belongs, and writing a second one is the mistake this rule exists to stop. Vault Push, Vault Pull and Vault Reconcile become entries into it rather than their own convergences; until #549, #552 and #554 wire them, `serverVaultSync.ts`'s conflict handlers and `vaultReconcile.ts` still decide for themselves, so do not read them as a second pattern to copy. How each type converges is pinned in `VAULT_BLOB_CONVERGE_STRATEGIES` beside `VAULT_BLOB_FIELDS`; add the strategy there, not a branch at a call site ([ADR 0054](../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)).
- Gate a merge on decrypting the server's copy, never on Vault Meta equality. A passphrase change rewraps the same Master Key, so meta differs while every Vault Blob stays readable.
- Validate ciphertext bundle shape and size before import.
- Reach a Local Vault through `createVaultHandle({ owner })` ([ADR 0047](../../docs/adr/0047-vault-access-is-obtained-through-an-owner-bound-handle.md)). Storage is one entry per User, keyed by user id, with the owner written into the record.

## Do Not

- Do not send decrypted vault data to backend APIs.
- Do not persist master keys, passphrases, or recovery keys in plaintext.
- Do not remove the unsuffixed `myorganizer_vault_v1` slot, and do not promote it to an owned record without a Master Key unwrap. It is an Unclaimed Local Vault: a failed unwrap must leave it byte-identical, and until a claim succeeds it is still where that Vault lives, so a write goes back to it.
- Creating a Vault is the one write that does not go back to it. `LocalVaultSlot.createNew` lands in that owner's own entry rather than following the read, because a User who declines an Unclaimed Local Vault and makes their own must leave the declined one exactly where it was. Routing creation through `write` instead would destroy it, which is the escape path in [#496](https://github.com/mnaimfaizy/MyOrganizer/issues/496).
