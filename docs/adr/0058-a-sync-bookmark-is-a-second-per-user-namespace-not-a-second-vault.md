# A Sync Bookmark is a second per-User namespace, not a second Vault

## Status

accepted

## Context

[ADR 0033](0033-local-vaults-are-user-owned-and-never-silently-destroyed.md) proved one thing about
the Local Vault: removing it touches exactly one key, `myorganizer_vault_v1:${owner}`, so Explicit
Local Vault removal can never destroy a Vault it was not asked to remove. That proof was about a
single storage key per User.

Sync Bookmarks ([#547](https://github.com/mnaimfaizy/myorganizer/issues/547)) add a second per-User
storage namespace beside it — `myorganizer_sync_bookmarks_v1:${owner}` — recording, per Vault Blob
Type, the hash of the Ciphertext a device last pushed successfully and the ETag the server returned
for it. Whether a Vault Blob has unsent changes is derived by comparing current Ciphertext to that
record, never read from a stored flag: a flag can be forgotten after a crash between a local save
and the write that would have set it, and nothing would then know the edit is stranded. A bookmark
that only advances on confirmed success cannot go stale in that direction.

ADR 0033's single-key proof does not automatically extend to a second key. A removal path that
forgets the second key leaks another User's bookmarks past sign-out; a removal path that clears the
wrong owner's key destroys a Vault it was never asked to touch. The proof has to be redone, not
assumed.

## Decision

**Sync Bookmarks are keyed by owner, exactly like the Local Vault.** Same composition —
`${prefix}:${owner}` — so isolation is the same one-key argument ADR 0033 already made: an operation
addressed at one owner's key structurally cannot reach another's.

**Explicit Local Vault removal removes both keys for that owner, and only that owner.**
`VaultHandle.removeVault()` calls Local Vault removal and Sync Bookmark removal in the same
operation, each parameterized by the same bound owner. Two one-key removals composed together are
still a proof about one owner, not a new claim that needs a shared implementation to hold.

**The "never silently destroyed" write guard does not carry across.** `writeOwnedLocalVault`
refuses to overwrite an entry that does not already validate as the calling owner's, because the
bytes it would discard are a User's only unsynced copy of their data. A Sync Bookmark is not that: it
is a pointer to Ciphertext that already exists elsewhere (this device's own Local Vault, and the
server it was pushed to), not the data itself. Losing or overwriting one costs at most one redundant
push the next time dirtiness is derived — never a User's data. Sync Bookmark storage therefore
overwrites a mis-keyed or corrupted entry rather than refusing, which is a narrower guarantee than
ADR 0033's on purpose, not an oversight of it.

**Hashing needs no Master Key.** A Sync Bookmark hashes `{ iv, ciphertext }` — the Local Vault's
already-encrypted `EncryptedBlob`, not the plaintext it was made from. Deriving dirtiness is
therefore available while the Vault is locked, the same way a locked Vault can still push and pull
its own Ciphertext (see CONTEXT.md's "Vault Unlock" entry).

## Consequences

A device now holds two per-User localStorage entries instead of one. Removing a User's Local Vault
without removing their Sync Bookmarks would leave a bookmark pointing at Ciphertext that no longer
exists on this device — harmless (the next save simply looks unsent again) but stale, so the two are
removed together rather than left to drift apart.

A future Vault Blob Type only needs a home in the existing Pinned Table
(`VAULT_BLOB_FIELDS`, [ADR 0053](0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md))
to be covered here too — Sync Bookmark storage is keyed by the same `VaultRecordType` union, not a
second hand-maintained list.
