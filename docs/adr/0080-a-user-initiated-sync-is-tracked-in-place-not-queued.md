# A user-initiated sync is tracked in place, not queued

## Status

accepted

## Context

`PUT /subscriptions/sync` is the only Sync Run a User can start themselves. It has always run
inline: the handler paginates `subscriptions.list`, resolves each Followed Channel's uploads
playlist, then loops every Enabled Channel doing a playlist page, a video-details batch and a
transaction. At roughly a second per channel a large account holds the connection for minutes, and
the browser awaits the whole thing behind one spinner. Issue #193 asks for visible progress,
per-channel failure feedback, and an elapsed or estimated-completion indicator.

The repository already contains a background-sync architecture. `YouTubeSyncWorkerService` runs
bounded, resumable passes over every connected account under a named lease, driven by cPanel HTTP
cron. It was built for a different problem — sweeping all Users on a schedule — and it is the
obvious thing to reach for here. It is the wrong thing to reach for.

The hosting constraint is what decides it. Production is Namecheap Stellar Plus: cron intervals no
shorter than five minutes, at most five jobs, two already spent on sync and digest. A Sync Run
placed on a queue that cron drains cannot start sooner than the next tick. A button that shows
nothing for five to fifteen minutes is a worse experience than the spinner it replaces, so the
queue buys progress reporting by destroying the responsiveness the progress was meant to convey.

Detaching the work from the request instead — answering `202` and letting the run continue in the
Node process after the response — removes the wait without the cron latency. It also removes the
only thing keeping the run observable. Passenger is free to recycle an idle process, and a run with
no request attached to it leaves nothing that can notice: the status stays `running` forever. That
hazard has to be repaired by a recovery sweep, which is a second mechanism, on the cron budget,
solving a problem the first mechanism introduced.

What makes inline work acceptable is a fact about Express that the current design does not exploit:
the handler is not aborted when the client disconnects. The `googleapis` calls and the Prisma
writes are not tied to the response object, so a Sync Run reaches its end and records its outcome
whether or not the tab is still open. Everything issue #193 asks for follows from letting the
client stop waiting for a response it does not need.

## Decision

1. **The work stays inline in the request; the client stops awaiting the response.** The frontend
   fires the `PUT` and immediately polls `GET /sync-status`, which becomes the single source of
   truth. The `PUT` keeps its existing response shape, so a caller that does wait still receives
   the outcome and the contract does not break — but a gateway timeout on a connection nobody is
   reading is now cosmetic rather than the User's entire experience. Polling starts on mount as
   well as on click, so leaving the page and returning rejoins a Sync Run in flight.

   A consequence worth stating plainly, because the UI previously claimed the opposite: navigating
   away is safe. The warning issue #193 asks for — keep the page open, do not refresh — describes
   the design being replaced, and shipping it would teach Users something false about their own
   app.

2. **Progress is derived from Enabled Channel rows sharing a run stamp. There is no run ledger.**
   The loop already stamps `YouTubeIntegration.lastSyncAttemptAt` once and writes that same
   timestamp to each `YouTubeSubscription.lastSyncedAt` as its channel completes, so the completed
   count is already a fact in the schema. What is missing is failure: a channel that failed is
   indistinguishable from one not yet reached. Two nullable columns on `YouTubeSubscription` —
   `lastSyncAttemptAt` and `lastSyncError` — close that gap, and totals, processed, succeeded,
   failed, and the Failing Channel list all read off the channel rows.

   A dedicated progress or run-history table was considered and rejected. It would be a second
   record of something the channel rows already state, free to disagree with them — claiming forty
   channels synced while thirty-eight have fresh uploads — and there is no reconciliation bug
   available to write when the number the UI shows _is_ the number of channels that synced. It
   would also need pruning, and there is no cron slot to prune it with. The per-channel columns
   have independent value besides: a Failing Channel that has failed every Sync Run for a week is
   durable state about the channel, which a run-scoped ledger discards.

   The cost is that discovery is not a count. Nothing increments while `subscriptions.list`
   paginates, so that phase is reported as its own status rather than as zero progress.

3. **The run TTL is the manual-refresh cooldown, deliberately.** A Sync Run whose process died
   leaves `running` behind with nothing alive to clear it. `getSyncStatus` therefore reports a run
   older than the TTL as an Interrupted Sync, server-side, so every reader agrees — the polling
   loop, a cold page load, and a second browser tab. Reusing the cooldown constant is not thrift.
   If the TTL were longer, the Retry control would re-enable while the API still claimed a run was
   live, and pressing it would race; if it were shorter, the run would be declared dead while Retry
   was still locked and the User could do nothing. Setting them equal makes "declared dead" and
   "may retry" the same instant by construction. The two numbers must not drift apart.

   An Interrupted Sync keeps its last known counts and carries `syncInterrupted`, distinct from
   `syncFailed`. They have different remedies and different truths: a failure means the work was
   rejected, an interruption means nobody knows, and the surviving counts show channels that did
   complete.

4. **One Sync Run per User at a time, claimed atomically where the triggers converge.** Manual
   refresh, the cron worker, and the digest service all call
   `YouTubeSyncService.syncVideosForUserWithStatus`. Two runs for one User write the same channel
   rows with different stamps, so the derived processed count falls as the later run overwrites
   channels the earlier one finished — the progress bar runs backwards. The unconditional write of
   `running` becomes an optimistic `updateMany`, the idiom the manual cooldown already uses:

   ```ts
   where: {
     userId,
     OR: [
       { lastSyncStatus: { notIn: ['running', 'discovering'] } },
       { lastSyncAttemptAt: { lt: new Date(now - RUN_TTL_MS) } },
     ],
   }
   ```

   The TTL disjunct is what keeps the claim recoverable: without it, a run stranded by a restart
   would make that User permanently unsyncable by every path. Losing the claim is not an error —
   the method returns the live run's status, the client polls it, and pressing Sync during a
   background run shows that run rather than refusing the User.

## Consequences

- Progress reporting costs one additive, nullable migration and no new endpoint, table, cron job,
  or process. `GET /sync-status` grows a nullable `progress` block, computed only while a run is
  live or was the most recent one, so the cheap mount fetch stays cheap.
- The polling loop's termination condition is provably reachable, because decision 3 guarantees the
  status leaves `running` within the TTL. No client-side safety timer is needed, and a client that
  invented one would disagree with the server.
- The guard in decision 4 covers the digest service, which also syncs and which nothing previously
  counted as a racer.
- A Sync Run still cannot survive a process restart, and the honest report of that is an Interrupted
  Sync rather than a resumption. Making user-initiated runs genuinely durable means the queue this
  ADR rejects, and would need the cron budget to change first.
- Decisions 1 and 2 are adopted together or not at all. Deriving progress without inverting the
  client leaves counts nobody reads; inverting the client without the per-channel columns leaves a
  polling loop with nothing to report but a spinner.
