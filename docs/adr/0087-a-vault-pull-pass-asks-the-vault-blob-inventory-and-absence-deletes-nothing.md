# A Vault Pull Pass asks the Vault Blob Inventory, and absence from it deletes nothing

## Status

accepted

## Context

A Vault Pull Pass issues one conditional `GET /vault/blob/{type}` per Vault Blob Type, all five, in
series, on every mount and every window `focus`
([#616](https://github.com/mnaimfaizy/myorganizer/issues/616)). A type this device has never pushed
has no Sync Bookmark, so no `If-None-Match` goes up and the request cannot be answered `304`. For a
User who has never used three of the five types, three `404`s arrive on every pass — permanent red rows
in exactly the place a real failure would show up the same way.

The obvious fix is to skip types this device holds no blob for. It is wrong: a type the User created on
another device also has no local blob here, and skipping it would end discovery of that type silently —
data that simply never arrives, with no test to catch it. The device cannot tell "nothing anywhere"
from "nothing here yet", and nothing in the protocol lets it: `VaultMetaV1` carries no per-type
inventory and no list endpoint exists. The five-way fan-out is not an oversight; under the current
contract it is the only way to ask the question at all.

## Decision

**A Vault Pull Pass first reads the Vault Blob Inventory, and asks about a Vault Blob Type only when
the inventory says its Ciphertext differs from this device's Sync Bookmark.**

1. **The inventory is its own endpoint, not a field in Vault Meta.** `GET /vault/blobs` returns
   `{ blobs: [{ type, etag, updatedAt }] }`. Vault Meta is what a Vault needs to be _opened_; a list of
   which Ciphertext exists is a fact about its _contents_, and putting it there would also make every
   blob push a second write that must land or leave the inventory lying.
2. **It returns identities, not just names.** Names alone would recover the `404`s and still cost five
   round trips. With each type's etag, a type whose etag matches its Sync Bookmark is not asked about at
   all; a type with no bookmark here is asked about, which is how a type created elsewhere is
   discovered.
3. **The inventory is itself conditional.** Its ETag is derived from the member etags with the same
   canonical hashing the per-blob ETag uses, so it changes exactly when some blob changed. The steady
   state of a pass is one `304`.
4. **It needs no unlock** ([ADR 0068](0068-a-locked-vault-blocks-exactly-the-operations-that-need-the-master-key.md)).
   It describes Ciphertext and contains none.
5. **Absence from the inventory means nothing to pull, never something to delete.** No route deletes a
   single Vault Blob; one leaves only when the whole Vault does, which is handled elsewhere. Reading a
   missing type as a deletion would buy nothing and would turn a stale or partial response into local
   data loss — the same shape as the keep-server reconcile that destroyed grocery Ciphertext
   ([#512](https://github.com/mnaimfaizy/myorganizer/issues/512)).
6. **A failed inventory read fails the pass; there is no fallback to the five-way fan-out.** Every type
   is recorded as unanswered and the next pass retries. A fallback that runs only when something is
   already wrong is a path nothing exercises, and it would silently restore the behaviour this ADR
   removes, so a broken inventory would never be noticed. The endpoint therefore ships before the
   client that depends on it.
7. **`404` stays the answer for an absent blob.** Once the pass asks only about types the inventory
   named, a `404` is a genuine race rather than the normal case, which is what `404` is for; changing it
   to `204` would break the client's existing `404`-versus-`401`/`403` distinction for nothing.
8. **The per-type reads stay serial.** After the inventory the typical pass reads nothing further, and
   the case that reads several — a device returning after a long absence — is not latency-bound. The
   pass fetches Vault Meta at most once, lazily; parallel reads would race that.

Any rule over which types to ask about reaches the pinned `VAULT_BLOB_FIELDS` table rather than
enumerating members ([ADR 0053](0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).

## Considered Options

- **Skip types with no local blob.** Rejected: ends discovery of types created on other devices.
- **An inventory field in Vault Meta.** Rejected: mixes a contents fact into the wrapping document and
  adds a second write to every push.
- **`204` for an absent blob; parallel per-type reads** (#616 options 2 and 3). Superseded: with the
  inventory neither buys enough to justify its cost.

## Consequences

- A pass costs one request in the steady state instead of five, and a User who has never used a type
  never generates a `404` for it.
- The Vault Blob Inventory is an API Contract change and goes through the `backend-api-contract-change`
  Skill and `yarn openapi:sync`. No Prisma change: `@@unique([userId, type])` already serves it.
- The double pass reported in #616 — two trigger instances, or a devtools `focus` more than 500ms after
  the first — is not answered by this ADR. It stops mattering, since a duplicate pass now costs one
  `304`.
