# A restore discards the evidence it holds about the server

## Status

accepted

The decision is made; the code does not do this yet. The defect it corrects is filed as
[#617](https://github.com/mnaimfaizy/myorganizer/issues/617), and this ADR is the reasoning that
issue implements.

## Context

A Sync Bookmark records what this device and the server last agreed on for one Vault Blob Type: the
hash of the Ciphertext this device successfully pushed, and the ETag the server returned for it.
[ADR 0058](0058-a-sync-bookmark-is-a-second-per-user-namespace-not-a-second-vault.md) established
why that is safe to rely on — a bookmark advances only on confirmed success, so "it cannot go stale
in that direction". Whether a Vault Blob has unsent changes is then derived by hashing, never read
from a stored flag, because a flag can be forgotten across a crash and nothing would know an edit
was stranded.

That argument holds for every writer ADR 0058 had in view. All of them move one Vault Blob Type at
a time, forward.

Restore does not. `importVault` commits a whole restored bundle through `handle.saveVault()`, a
single atomic replacement of the entire Local Vault, and it deliberately does not report to the
sync sink — `saveVault` is also how convergence writes the server's Ciphertext back after taking
it, so reporting there would feed the sink its own output. Nothing in the import path touches Sync
Bookmarks at all.

The consequence is a state ADR 0058 does not describe. After restoring an Escape Copy from Drive or
a file, the Local Vault holds older Ciphertext while the bookmarks still hold the hash and ETag of
the newer Ciphertext this device pushed before the restore. `hasUnsentChanges` hashes what is there
now, finds it differs from the bookmark, and reports every restored type as unsent. `lastPushedEtag`
returns the bookmark's ETag, which the server still matches because the server has not moved. So
`convergeVaultBlob` takes the conditional-send branch, the `If-Match` precondition passes, and the
restored older Ciphertext is written over current server state without a conflict, a prompt, or a
merge — after which the bookmark advances to the new ETag and nothing records that anything went
backwards.

The guard built to prevent exactly this does not fire, and it is not broken. A Sync Bookmark is
evidence about the _server's_ copy, and that evidence is still perfectly accurate: the server really
has not moved. What moved is the device's own data, and a bookmark says nothing about that. ADR
0058's "cannot go stale in that direction" is true and describes a different direction than the one
a whole-vault replacement travels in.

This is the shape of [#512](https://github.com/mnaimfaizy/myorganizer/issues/512) again — a
whole-vault operation meeting a per-record engine — arriving through a path #512's fix did not
cover.

## Decision

**A restore clears the Sync Bookmark for every Vault Blob Type it writes.** Evidence about
Ciphertext that has just been discarded is not evidence about anything, and it is dropped rather
than carried.

Nothing new has to be built to make that safe, which is the point of choosing it. `convergeVaultBlob`
already handles an absent bookmark correctly and says why in its own comment: a device holding no
evidence about the server's copy must go and look before pushing, so it fetches the server's blob
and routes through `decideConflict`, which asks the User. Clearing the bookmark does not add a
special case for restore; it puts restore into the case that already exists for a device that has
never pushed.

**A restore is confirmed explicitly before it runs.** Whole-vault replacement from a copy of
unknown age is not an action to discover you have taken.

## Considered options

**Converging the Escape Copy per record, rather than replacing.** This sounds more principled than
it is. Convergence reconciles two live replicas that are both trying to be current. An Escape Copy
is deliberately not live — under
[ADR 0062](0062-the-drive-escape-hatch-holds-no-token-we-could-lose.md) it may be months old by
design — and merging a months-old snapshot record by record would resurrect records deleted since,
which is the failure the Deletion Log
([#546](https://github.com/mnaimfaizy/myorganizer/issues/546)) exists to prevent. Convergence is the
wrong instrument for a snapshot precisely because it is the right one for a replica.

**Making restore offline-only**, available solely through the standalone reader
([ADR 0064](0064-an-escape-copy-is-opened-by-a-tool-that-needs-nothing-of-ours.md)). This removes
the hazard by removing the feature. Restoring after losing a device is an ordinary, non-escape use
and deserves to work in the product.

**Reporting `saveVault` to the sync sink.** It would mark the restored types and send them, which
is the bug, not the fix. The existing non-reporting is correct and stays.

## Consequences

The first reconcile after a restore will ask rather than decide, for every restored Vault Blob Type
that diverges. That is more prompting than before, and it is the correct amount: each prompt marks
a place where a User's older copy and their current server copy genuinely disagree and only they
can say which they meant.

A restore therefore becomes slower and louder. Both are wanted.
