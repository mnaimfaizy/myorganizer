# YouTube disconnect preserves Watched by default

## Status

accepted

## Context

Disconnecting YouTube used to revoke at Google, then delete Cached Uploads (including Watched), Followed Channels, notification settings, and the integration in one click with no confirmation. Reconnecting restores YouTube-sourced metadata, but Watched is the User's own mark — it does not come back. Sync Runs became observable in ADR 0080, so disconnecting while a run is live can delete the integration row the run is still writing to. Issue #746 grilled whether a confirm dialog alone was enough.

## Decision

1. **Confirm first.** Disconnect requires a destructive confirm that names at least Followed Channels, Cached Uploads, notification/digest settings, and OAuth tokens. An unchecked checkbox offers “Also delete my Watched marks.”
2. **Preserve Watched by default via a Watched Ledger** keyed `(userId, videoId)`. On disconnect (unless the wipe checkbox is set), currently Watched video ids are written to the ledger inside the same DB transaction that deletes local YouTube rows. On reconnect, after Cached Uploads are synced, matching ledger rows are reapplied as Watched and then removed. Unused ledger rows expire after **30 days**, aligned with disabled-channel retention.
3. **One transaction for local work.** Ledger write (or wipe) plus deletes of videos, subscriptions, notification settings, digest deliveries, and the integration run in one `$transaction`. Google token revocation stays **outside** the transaction: local disconnect always completes; a revoke failure is surfaced to the User with a link to Google account permissions.
4. **Refuse while a Sync Run is live.** Disconnect returns a clear conflict until no run is live (the User finishes or cancels sync), using the same live predicate as ADR 0080's claim.

## Consequences

- Soft-disconnect that keeps Cached Upload rows without a ledger is rejected; the ledger is the retention seam.
- Data-privacy and connect-prompt copy must describe preserve-by-default, optional wipe, and the 30-day ledger TTL — not “disconnect deletes all metadata” alone.
- Digest delivery ledger rows are deleted on disconnect in the same transaction.

## Refs

Issue #746, ADR 0080, ADR 0016
