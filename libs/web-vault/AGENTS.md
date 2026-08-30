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
- Converge a Vault Blob through `convergeVaultBlob` (`src/lib/vault/vaultConverge.ts`) — it is where a convergence decision belongs, and writing a second one is the mistake this rule exists to stop. Every caller is wired: the sync sink drains through it (`vaultSyncQueue.ts`), the pull check does (`vaultPullCheck.ts`, scheduled by `vaultPullTrigger.ts`), and so does the sign-in pass (`vaultReconcile.ts`, which is a loop over the blob types and nothing more). How each type converges is pinned in `VAULT_BLOB_CONVERGE_STRATEGIES` beside `VAULT_BLOB_FIELDS`; add the strategy there, not a branch at a call site ([ADR 0054](../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)).
- Check for what changed elsewhere through `createVaultPullTrigger` (`src/lib/vault/vaultPullTrigger.ts`) — it debounces the mount/focus triggers and stops for good the first time a check finds the Session gone (401/403). Each Vault Blob Type is checked with a conditional GET carrying its Sync Bookmark's ETag as `If-None-Match`; a 304 costs no work and touches nothing local.
- Gate a merge on decrypting the server's copy, never on Vault Meta equality. A passphrase change rewraps the same Master Key, so meta differs while every Vault Blob stays readable.
- Converge a Vault Meta through `convergeVaultMeta` (`src/lib/vault/vaultMetaConverge.ts`), and nowhere near a Vault Blob decision. It takes `getVaultMeta` and nothing else, so it structurally cannot push a local wrapping over the server's and undo a passphrase change made elsewhere; adoption comes back as a next Local Vault for the caller to save. Adopting a remote wrapping is the one move that can brick a Local Vault and it never happens without an explicit answer ([ADR 0057](../../docs/adr/0057-vault-meta-converges-separately-and-never-silently.md)).
- Push a local wrapping through `settleVaultMeta` / `changePassphraseWithCurrent` / `resetPassphraseAfterRecovery` (`src/lib/vault/vaultMetaPush.ts`), never by calling `putServerVaultMetaEtagAware` at a new call site. A push is allowed on one condition and it is not "this device holds the Master Key" — the retry runs at session start against a locked Vault. It is that the server still holds the Vault Meta this device last agreed on, which the Vault Meta Bookmark is what proves. A moved server is refused and left for `convergeVaultMeta` to ask about at session start, never merged and never prompted mid-flow ([ADR 0060](../../docs/adr/0060-a-device-may-push-a-wrapping-it-wrote-over-a-server-it-can-prove-has-not-moved.md)).
- Name a passphrase change by what authorizes it. `changePassphrase` verifies the current passphrase and `resetPassphrase` does not, because a User who has just unlocked with a recovery key cannot supply the one they forgot. They are two methods rather than one with an optional field: a check that can be skipped by leaving a property out is not a check ([ADR 0053](../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
- Validate a passphrase through `passphrasePolicy.ts` (`passphraseSchema`, `newPassphraseSchema`, `changePassphraseSchema`), never with a length check written at the call site. The rule was restated inline at each site that collected one, which is how three places came to own the same rule with nothing making them agree.
- Pass `onConflict` explicitly wherever `putServerVaultMetaEtagAware` is called. Its default raises a `window.confirm` from inside the library, which is the shape ADR 0057 was written against.
- Settle a Vault Meta before asking about one. A wrapping this device changed and could not push looks exactly like one changed elsewhere, so converging first tells a User their own change came from another device and offers them a button that reverts it.
- Validate ciphertext bundle shape and size before import.
- Reach a Local Vault through `createVaultHandle({ owner })` ([ADR 0047](../../docs/adr/0047-vault-access-is-obtained-through-an-owner-bound-handle.md)). Storage is one entry per User, keyed by user id, with the owner written into the record.
- Synchronise a save by giving the handle a `syncSink` (`createVaultSyncQueue`), never by pushing at a write call site. The handle is the only way to reach a Local Vault, so it is the only place a write cannot get past — a push added beside a call site is a push the next call site will not have.

## Do Not

- Do not send decrypted vault data to backend APIs.
- Do not persist master keys, passphrases, or recovery keys in plaintext.
- Do not remove the unsuffixed `myorganizer_vault_v1` slot, and do not promote it to an owned record without a Master Key unwrap. It is an Unclaimed Local Vault: a failed unwrap must leave it byte-identical, and until a claim succeeds it is still where that Vault lives, so a write goes back to it.
- Creating a Vault is the one write that does not go back to it. `LocalVaultSlot.createNew` lands in that owner's own entry rather than following the read, because a User who declines an Unclaimed Local Vault and makes their own must leave the declined one exactly where it was. Routing creation through `write` instead would destroy it, which is the escape path in [#496](https://github.com/mnaimfaizy/MyOrganizer/issues/496).
