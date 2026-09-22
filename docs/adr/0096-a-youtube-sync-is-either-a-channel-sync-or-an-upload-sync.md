# A YouTube sync is either a Channel Sync or an Upload Sync

## Status

proposed

Supersedes [ADR 0080](0080-a-user-initiated-sync-is-tracked-in-place-not-queued.md). That record is left unchanged; this one replaces it.

## Context

ADR 0080 made a user-initiated sync one **Sync Run**: `PUT /youtube/subscriptions/sync` imported Followed Channels and then fetched Cached Uploads for every Enabled Channel, under one claim, one 15-minute cooldown, and progress derived from channel rows sharing that run's stamp. The cron worker already fetched uploads only. The button did not.

That coupling spends upload quota before the User has said which channels are worth it, and it puts channel selection and upload results on the same page. Issue #752 splits the attempt. The hosting facts ADR 0080 recorded have not changed: Namecheap Stellar Plus still cannot tick cron faster than five minutes, and there is still no spare cron slot for a run ledger or a recovery sweep.

## Decision

1. **Two attempts, not one.** A **Channel Sync** refreshes Followed Channels and does not fetch uploads. An **Upload Sync** refreshes Cached Uploads of Enabled Channels and does not import channels. `PUT /youtube/subscriptions/sync` is Channel Sync only — it must not keep a both-phases default. `PUT /youtube/uploads/sync` is the manual Upload Sync. The cron worker stays an unattended Upload Sync of Enabled Channels and is not turned off. Upload Sync reads `enabled` from the database; the request does not carry a channel list.

2. **At most one live attempt per User, either kind.** Channel Sync and Upload Sync share one mutex, claimed with the same optimistic `updateMany` ADR 0080 used. Losing the claim returns the live attempt's status; it is not an error. Disconnect keeps refusing while either kind is live (ADR 0092 decision 4). A Channel Sync in flight blocks an Upload Sync, the cron worker, and disconnect, and the reverse.

3. **Each attempt has its own cooldown, and its run TTL equals that cooldown.** Channel Sync is 5 minutes. Manual Upload Sync is 15 minutes. The equality is the same construction as ADR 0080 decision 3, applied per attempt: a longer TTL would re-enable the button while the attempt was still live, a shorter one would declare it dead while the button stayed locked. The cron worker is not subject to the manual Upload Sync cooldown. Channel Sync outcome is stored on its own columns so a channel refresh does not overwrite Upload Sync progress or freshness.

4. **Upload Sync progress stays derived at channel granularity. There is no run ledger and no intra-channel counter.** The cap remains 100 Cached Uploads per channel, but the UI does not count videos inside a channel. A Channel Sync has no per-channel progress; while it runs it is reported as its own status, not as zero uploads processed. Inline work and a client that fires the request and polls `GET /youtube/sync-status` are unchanged from ADR 0080 decision 1: the handler is not aborted when the tab closes, so leaving the page is still safe.

5. **Channel management is a permanent page, not a wizard.** Followed Channels, their enable toggles, and **Refresh channels** live at `/dashboard/youtube/channels`. `/dashboard/youtube` stays the watching surface and carries **Sync uploads** plus Upload Sync progress. A User whose channels are known and whose uploads were never pulled — or are stale — sees that emptiness honestly, with calls to action. Nothing auto-starts an Upload Sync, and nothing blocks the watching page until one has run.

## Considered options

- **One shared 15-minute cooldown.** Rejected. Channel Sync is a cheap `subscriptions.list` pass; making the User wait out an upload cooldown to correct the channel list spends none of the quota the split was meant to save.
- **An intra-channel progress bar, or the run ledger ADR 0080 rejected.** Rejected again, for the same reasons: the ledger would be a second record of the channel rows, and pruning it needs a cron slot that does not exist. Per-channel video counts cannot be derived from a timestamp equality.
- **A selection wizard on every visit, or turning the cron worker off** so Upload Sync happens only when the User asks. Rejected. Selection is durable state on the channel row (`enabled`); the cron worker already honours it. Forcing the wizard each visit, or stopping unattended refresh, changes a different product decision than the one #752 asked for.

## Consequences

- Partial Sync, Interrupted Sync, and Failing Channel are outcomes of an Upload Sync. A Channel Sync that dies mid-pagination is an interrupted channel refresh, not an Interrupted Sync of uploads.
- `YouTubeIntegration.lastManualRefreshAt` remains the manual Upload Sync cooldown stamp. Channel Sync gets its own stamp and status so the two attempts cannot clobber each other.
- `GET /youtube/sync-status` reports both attempts. The web client still does not wait on the `PUT`.

## Refs

Issue #752, ADR 0080, ADR 0092, issue #746
