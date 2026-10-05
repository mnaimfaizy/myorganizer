# A mobile Vault Pull converges the unsent edit it is handed

## Status

accepted

## Context

A Vault Pull merges an arriving Vault Blob against what the device already holds, so it cannot discard a local edit the server has not seen (`CONTEXT.md`). Issue #896 asked for that on mobile, through the per-record merge that #164 moved behind `@myorganizer/vault-core/portable`.

The issue was written as if mobile held a Local Vault. It does not ([ADR 0107](0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md)), and adding one is still a decision nobody has made ([ADR 0047](0047-vault-access-is-obtained-through-an-owner-bound-handle.md)). Measured against what mobile does hold:

- A copy the server confirmed. Merging it with a newer server copy yields the server copy, so there is nothing to protect.
- An Unconfirmed Edit whose Vault Push is in flight. `useVaultBlob` runs one request at a time, so no read can land on top of it.
- An Unconfirmed Edit whose Vault Push failed. The screen reverted, and the hook kept the edit so Retry could resend it. `reload` dropped it. That was the one local edit a mobile read could discard.

`pushVaultBlob` already merged a newer server copy on a 409, so the merge itself was never missing on mobile. What was missing was a read that honoured the edit.

## Decision

1. **`pullVaultBlob` is the mobile Vault Pull.** It reads the server's copy and, when handed an unsent envelope, merges the two per record by `VAULT_BLOB_CONVERGE_STRATEGIES`. It writes nothing. `readVaultBlob` stays a plain read for callers that hold no edit.
2. **Mobile still has one merge and one strategy lookup.** The pull and the push call the same private `converge` in `libs/mobile/feat/vault/src/sync.ts`. ADR 0107 item 3 named `pushVaultBlob` as the one place mobile decides convergence; this ADR widens that to the two entries of that module and nothing else.
3. **`useVaultBlob.reload` pulls, then sends.** With a failed edit in hand it re-applies the edit to the copy it was made on, pulls, shows the server's copy, and pushes the merge under the ETag just read. A failed send puts the screen back on the server's copy and keeps the edit, as a failed `apply` does. A failed read leaves the edit and its error where they were.
4. **`promptOnConflict` still fails closed.** A pull of a type pinned to it carries no edit; the hook reports `conflict` and the edit has to be made again. No type is pinned to it today.
5. **Nothing is persisted.** The edit lives in the hook's memory and ends with the screen, exactly as before. This is not a Local Vault.

## Considered Options

- **A persisted mobile Local Vault with a web-shaped pull.** Rejected here. It is the offline decision ADR 0107 deferred, with a storage adapter, a Sync Bookmark, and a migration behind it. It is not a way to stop a reload dropping one edit.
- **Tests only, on the push path.** Rejected. `pushVaultBlob` did merge, but `reload` would still have discarded the failed edit, which is the behaviour the issue names.
- **Re-apply the edit to the arriving copy instead of merging.** Rejected. An edit function re-run on a copy where another device deleted the record either resurrects it or throws. The merge lets the Deletion Log decide.

## Consequences

- An edit that failed offline is sent by the next pull-to-refresh as well as by Retry.
- After a `conflict`, Reload shows the latest copy with the edit merged into it, rather than without it. The notice copy is unchanged.
- A record the edit changed is removed by the pull when another device deleted it at or after that change, and kept when the change is newer.
- The hook's reload wiring has no test: `mobile-feat-vault` has no renderer. `pullVaultBlob` carries the merge behaviour and is tested in `sync.test.ts`.
