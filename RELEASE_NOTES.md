# Release v0.4.0

Date: 2026-08-18

## Changes since v0.3.0

Compare: https://github.com/mnaimfaizy/myorganizer/compare/v0.3.0...v0.4.0

> **License change.** This release adopts the **Elastic License 2.0** (#365). MyOrganizer was
> previously distributed under different terms — review [`LICENSE`](LICENSE) before upgrading,
> redistributing, or offering this software as a hosted service.

## Highlights

The focused YouTube watching experience (#264) is the headline of this release: a channel-first
directory, an in-session queue, Shorts kept deliberately separate from long-form video, and daily
guardrails designed to stop the watching session before it turns into a doomscroll.

## Added

### Focused YouTube watching

- **Channel-first directory** replaces the old view-mode toggle. Browse by channel, with
  privacy-enhanced in-app playback so watching no longer hands YouTube a full tracking profile.
- **In-session queue rail** with keyboard navigation, per-video duration estimates, and a running
  total so you can see what committing to the queue actually costs you.
- **Shorts, isolated by design.** Shorts are classified by runtime and kept out of the long-form
  feed. A **Daily Budget** meter tracks Shorts watched, and a **Hard Stop** ends the session when
  the budget is spent.
- **Watched state** is tracked on synced videos, with sync freshness and cooldown indicators that
  tell you when the list you are looking at is stale or a sync has failed.
- **Digest deep-linking** — links in the weekly digest email and the subscription list now open the
  channel directly in the focused directory.
- Digest delivery now runs as its own resumable worker, so a partial failure resumes instead of
  restarting the whole send.

### Elsewhere

- Visual regression testing via Chromatic UI Tests in CI, with a Storybook story library covering
  the UI primitives and vault components.

## Fixed

### Security

- **`deepmerge-ts` stack exhaustion** — pinned to 8.0.1 to patch
  [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), where deeply nested
  input could exhaust the stack.
- **`nanoid` denial of service** — updated to 3.3.18, resolving the outstanding DoS advisories
  (#283, #328).
- **Agent tooling secret exposure** — security hooks now run under Claude Code, and secret file
  reads are guarded (#298).

### Accessibility

- The channel selector now announces as the tab set it already behaved like, with correct
  `tablist` / `tab` / `tabpanel` semantics and orientation.
- Each queue rail has its own heading id, so the two layouts no longer emit duplicate ids.
- Channel list arrow keys follow the layout: up/down on desktop, left/right on mobile.

### Behaviour

- **Auth token lifetimes no longer drift** on refresh, and previously unreachable error codes now
  surface to the client (#325).
- Per-video player state is cleared on an in-place Shorts swap — playback status and duration no
  longer leak from the previous video.
- Only one player can be active across surfaces at a time.
- The Shorts budget meters from the Play press rather than the embed alone, so it stays accurate
  when the embed is blocked or unresponsive.
- The weekly digest no longer claims a digest period when the video window is empty.
- Corrected timezone handling in the subscription date picker (#243).

## Changed

- **Elastic License 2.0** adopted repository-wide (#365). See the notice above.
- **Production deploys are documented as approval-gated, and tags are receipts**
  ([ADR 0028](docs/adr/0028-production-deploys-are-approval-gated-and-tags-are-receipts.md)). The
  ship decision is the required-reviewer approval on the `production` environment, not the dispatch
  that queues the run. A `vX.Y.Z` tag now means "this version is live in production."
- YouTube metadata privacy wording is surfaced on the playback surface itself, rather than buried
  in settings.
- The README is now a front door that links to `TECH_STACK.md`, `package.json`, and `.env.example`
  instead of restating them, with a drift guard in CI (#326).

## Internal

Agent governance and harness consolidation (ADR 0020), tiered quality gates (ADR 0012), component
hygiene enforcement (ADR 0027), the markdown allowlist (ADR 0023), PR Surface Labels (ADR 0025),
graphify knowledge-graph fixes, sandcastle dispatch modes, and the `PrAuthor` sub-agent. None of
this changes application behaviour.
