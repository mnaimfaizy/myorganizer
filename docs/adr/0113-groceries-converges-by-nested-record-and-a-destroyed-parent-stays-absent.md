# Groceries converges by nested record, and a destroyed parent stays absent

## Status

accepted

Supersedes the Groceries sentence in [ADR 0054](0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md) and the Groceries example in decision 4 of [ADR 0107](0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md). The rest of both stands. Tracked as [#769](https://github.com/mnaimfaizy/myorganizer/issues/769).

## Context

ADR 0054 converges a Vault Blob by record and records absence in a Deletion Log. It left Groceries on `promptOnConflict` permanently, because a Groceries Vault Blob is a nested payload of Catalog Items, Grocery Lists, and List Lines, and bulk mutations were judged to merge badly. Two devices editing different lists or lines therefore still prompt, and the side the User does not pick is discarded.

The nested records already carry `id` and `updatedAt`. Deletes are hard removals, so a stale device puts a removed line back. There is no Groceries Deletion Log. Mobile shares the strategy pin and fails closed on `promptOnConflict`, because no mobile screen writes Groceries and there is nothing to prompt (ADR 0107).

## Decision

1. **Three records, not one blob and not one bulk action.** A Catalog Item, a Grocery List, and a List Line each merge on their own. Records are unioned by `id`. The newer `updatedAt` wins the whole record. A tie keeps the local record, as it does for every other Vault Blob Type. Uncheck All and Remove Checked From List are many List Line writes, not one winner that covers the list. Merging fields inside a List Line is rejected: a check on one device and an amount edit on the other resolve to whichever line is newer, even though that drops the older field. A field merge would also invent a combination neither device saved.

2. **A line edit is not a rename.** The Grocery List's name follows the list's `updatedAt`, and that timestamp moves only when the name changes. Adding, checking, unchecking, or removing a List Line does not move it. Lines on the list still merge by their own `updatedAt`. Lines only this device has keep their order. Lines only the other device has are appended after them, which is the order rule `mergeRecordsById` already uses. Copies that diverged before this change can still lose one rename, because a line edit used to stamp the list.

3. **A destroyed parent stays absent.** Delete Grocery List records the list absent. That absence covers every List Line on it, including a line edited or added later on a device that has not seen the deletion, and a later rename of the list does not restore it. Delete From Catalog records the Catalog Item absent. That absence covers every List Line that referenced it, including a later edit of that same Catalog Item. A new Catalog Item with the same name is a different record and stays. Both are exceptions to the usual Deletion Log rule that a record changed after its deletion survives. Delete List Line is not an exception: a later edit of that same line beats the deletion and the line returns.

4. **Ciphertext that does not decrypt still prompts.** Nothing in this decision merges a Groceries Vault Blob this device cannot open. That refusal is unchanged from ADR 0054.

5. **One pin, both clients.** Web and mobile converge Groceries the same way. This decision does not add a mobile Groceries editor. ADR 0107's fail-closed branch remains for any Vault Blob Type still pinned to `promptOnConflict`. Groceries is no longer that type.

## Consequences

Groceries joins the envelope and the Deletion Log. A normalizer must accept both the bare `{ catalog, lists }` payload and the envelope. Parent absence is applied after the per-id merge, because tombstones of the lines that existed at deletion time do not cover a line created later on a stale device.

`putVaultRecord` and `deleteVaultRecord` keep refusing a non-array payload (ADR 0107 decision 2). Groceries is nested, so its merge is not those two functions, and a flatten that dropped the catalog would be a return of the failure those functions refuse.

The tests that lock Groceries to `promptOnConflict` are wrong after this decision and have to move with the pin. The two-context convergence spec that covers Tasks does not cover Groceries until it is extended.

Deletion Log garbage collection and a mobile Groceries editor stay out of scope.
