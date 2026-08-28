# A Vault Blob converges by record, and absence is recorded

## Status

accepted

## Context

A Vault Blob is the unit the server stores and the client synchronises: one Ciphertext per Vault
Blob Type, holding every record of that type together. `tasks` is not one Task, it is all of them.

That granularity decides the convergence model on its own. Under per-blob last-write-wins, a Task
added on a laptop and a different Task added on a phone are two writes to the same Vault Blob, so
one of them is not conflicted — it is destroyed. That is the ordinary two-device case, not a race,
and it is the case
[#513](https://github.com/mnaimfaizy/myorganizer/issues/513) exists to fix. A model whose
first-order behaviour is losing the User's data is not a smaller version of the right answer.

Merging cannot happen on the server, which holds `{version, iv, ciphertext}` and no key. It happens
on a client that already holds the Master Key, while unlocked.

## Decision

**Vault Blobs converge by record.** Records are unioned by `id`; two versions of one `id` are
resolved by `updatedAt`.

**The precondition for merging is decryptability, established empirically** — the remote blob is
decrypted with the in-memory Master Key, and success is the proof that both sides are the same
Vault. Meta equality is _not_ the gate, in either direction. `changePassphrase` rewraps the same
Master Key under a new passphrase: Vault Meta differs while every Vault Blob stays readable. Gating
on meta equality would fire a destructive whole-vault prompt on the most routine security action
the product offers, and answering it would revert the passphrase change. A failed decryption means
a genuinely different Master Key — a re-`initialize` — and degrades to a prompt, never to
keep-local.

**Vault Meta converges separately, and is never replaced silently.** Adopting a remote wrapping
that wraps a different Master Key would leave local Vault Blobs encrypted under a key nothing on
the device can unwrap, and a remote wrapping cannot be verified without the passphrase it was
derived from. Divergence raises a prompt about the _passphrase_, not about the data.

**Absence is recorded.** Deletes are hard deletes — `tasks.filter(t => t.id !== id)` — so a union
by `id` reinstates every deleted record, and reinstates it on every device as soon as the stale one
pushes. Merge by id cannot express absence: absence and never-existed are the same bytes. Each
Vault Blob therefore carries a Deletion Log of `id` to timestamp alongside its records, and a
record loses to a deletion newer than its `updatedAt`.

The Deletion Log lives in the blob envelope, not as a `deletedAt` field on `Task` and
`AddressRecord`. Deletion-for-sync is not a domain fact — a Task does not know it was deleted, it
does not exist — and a field on the record type pushes the concern into every Zod schema, form,
list, and count widget, each of which must then remember to filter. "Forgot to filter deleted"
ships looking correct and surfaces as ghost rows in one widget.

**Which strategy applies to which type is a pinned table**, satisfying
`Record<VaultBlobType, …>` beside `VAULT_BLOB_FIELDS`, per
[ADR 0053](0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md). `promptOnConflict` is
a permanent strategy, not a stopgap: `groceries` is a nested payload of catalog, lists, and lines
whose bulk mutations merge badly, and `todos` is a legacy read source nothing writes.

## Consequences

The blob payload shape changes from a bare array to an envelope, so every normalizer must accept
both. The normalizers already carry this kind of legacy handling (`migrateFromTodos`, the legacy
`{id, todo}` branch).

Export and import are unaffected. `VaultExportV1` carries `EncryptedBlobV1` Ciphertext, so the
Deletion Log rides inside it opaquely.

Deletion Log entries are retained indefinitely. Bounded retention would cap growth but reintroduce
resurrection for any device offline longer than the window — trading a speculative size problem for
a real correctness cliff. Garbage collection is deferred until the size pressure is measured rather
than imagined.

A seventh Vault Blob Type fails to compile until somebody decides how it converges.
