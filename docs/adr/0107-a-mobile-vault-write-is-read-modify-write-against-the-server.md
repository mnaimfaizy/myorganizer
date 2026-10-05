# A mobile vault write is read-modify-write against the server

Mobile can now edit a Vault Blob. It keeps no Local Vault, so an edit is
applied to the envelope it read from the server and pushed straight away,
under `If-Match` on the ETag it was read at. A 409 reads the newer copy,
decrypts it on device, merges it with the edit by the blob type's pinned
strategy, and sends again. A type pinned to `promptOnConflict` is refused
instead of merged. A push that fails puts the screen back to the last copy
the server confirmed and offers a retry. The edit is never persisted and
never queued.

## Status

accepted

## Context

PRD #544 made web converge per record (ADR 0054, ADR 0055) and left mobile
read-only: `pullDecryptedBlob` was the only vault call under `libs/mobile`,
and the mobile vault Agent Guide recorded that adding a write path or local
persistence "is a decision to record, not an implementation detail to fill
in" (ADR 0047). Issue #768 asks for that write path.

Three facts decided its shape:

- **Mobile has no Local Vault** (its storage adapter was removed in #543), so
  none of web's machinery transfers: no queue, no Sync Bookmark, no
  reconcile. What does transfer is the merge. The per-type merge functions
  and the envelope helpers were already in `vault-core` and reachable through
  its Portable Entry Point (ADR 0103). Only the table saying which strategy
  each type uses lived in `libs/web/vault`.
- **The server accepts a PUT with no `If-Match` and overwrites
  unconditionally.** A blob that did not exist at read time has no ETag to
  match, so a first write cannot be made conditional without a contract
  change (`If-None-Match: *`), which #768 put out of scope.
- **Mobile had no edit UI at all.** A push with no caller could not be
  verified end to end, so the Tasks screen gains the smallest set of edits
  that exercises every path: toggle done, add by title, delete.

## Decision

1. **One strategy pin, in `vault-core`.** `VAULT_BLOB_CONVERGE_STRATEGIES`
   moves to `libs/vault-core/src/lib/records/vaultBlobConverge.ts`, keyed by
   `vault-core`'s own copy of the five type names, because `vault-core`
   cannot import the generated `VaultBlobType`. The web pin in
   `vaultBlobFields.ts` re-exports it under
   `satisfies Record<VaultBlobType, VaultBlobConvergeStrategy>`, which ties the
   two unions together and keeps `yarn enum:fanout:check`'s pin where it was.
   Web and mobile therefore merge the same two copies the same way.
2. **An edit is a function of the envelope.** Record edits are the pure
   `putVaultRecord` and `deleteVaultRecord` in `vault-core`. A delete writes
   the Deletion Log entry rather than just removing the record. Otherwise a
   union-by-id merge brings the record back (ADR 0054). Both refuse a
   non-array payload, so Groceries cannot be edited record by record and have
   its catalog dropped.
3. **`pushVaultBlob` is the one place mobile decides convergence.** It sends
   the edited envelope with `If-Match`. On 409 it pulls, merges by the pinned
   strategy, and sends again, up to three PUTs. A push that holds no ETag
   pulls first, so a blob another device created since this one's 404 is
   merged into, not overwritten. The remaining window between that pull and
   the PUT is accepted until the contract carries `If-None-Match: *`.

   > **Superseded in part by [ADR 0121](0121-a-mobile-vault-pull-converges-the-unsent-edit-it-is-handed.md).** `pullVaultBlob` converges too, through the same `converge` in the same module. A reload no longer drops an edit whose push failed; it merges and sends it.

4. **`promptOnConflict` fails closed on mobile.** No mobile screen writes
   Groceries yet, so there is nothing to build a prompt for. The branch throws
   `VaultBlobConflictError`, and the screen offers Reload. It never keeps
   either side on the User's behalf. The same error ends a push whose server
   copy kept moving under every retry.

   > **Superseded in part by [ADR 0113](0113-groceries-converges-by-nested-record-and-a-destroyed-parent-stays-absent.md).** Groceries is no longer pinned to `promptOnConflict`, so this branch does not apply to it. The branch still fails closed for any Vault Blob Type that is.

   > **Superseded in part by [ADR 0121](0121-a-mobile-vault-pull-converges-the-unsent-edit-it-is-handed.md).** After a push whose server copy kept moving under every retry, Reload no longer shows the server's copy without the edit: it merges the edit and sends it. A type pinned to `promptOnConflict` still keeps neither side.

5. **Offline blocks; nothing is held.** A failed push reverts the screen to
   the last server-confirmed copy and says why: a conflict, the network, or
   anything else. Retry re-applies the same edit function to the current
   copy. A typed task title stays in its field until the push lands. The
   edit lives only in memory and never outlives the screen, which keeps ADR
   0047's rule that mobile does not persist vault data.

   > **Superseded in part by [ADR 0121](0121-a-mobile-vault-pull-converges-the-unsent-edit-it-is-handed.md).** The heading overstates it: the screen holds the failed edit in memory, which is what Retry resends. A reload now sends it too, merged with the server's copy as the edit first produced it, and a screen can discard it. It is still never persisted and never outlives the screen.

## Consequences

- A mobile edit reaches the server as Ciphertext only. Plaintext and the
  Master Key stay on device, and web sees the edit on its next Vault Pull.
- An Escape Copy, export and web convergence are unchanged. Web's
  `convergeVaultBlob` reads the moved table and the shared
  `toVaultBlobEnvelope` without changing behaviour.
- Web's task writes still save bare records and so drop a Deletion Log that
  mobile wrote. That gap predates this decision: web never writes deletions.
  It matters only if a stale device later merges back a record that mobile
  deleted, and it is tracked as a follow-up.
- The mobile write path has no unit tests. `libs/mobile` has no Jest lane, and
  the testing skill forbids writing the first mobile test before that
  toolchain is decided. The pure halves (`vault-core`'s table and edit
  helpers) are covered there instead.
