# YouTube Integration Feature

## Overview

Allow users to securely link their YouTube account via OAuth 2.0, sync selected channel subscriptions, browse cached videos with sorting/searching/view modes, and receive periodic email notifications for new uploads.

## Architecture

### Data Flow

```
User ──OAuth 2.0──▶ Google  ──tokens──▶  Backend (encrypted at rest in DB)

  cPanel cron ──flock──▶ /cron/sync        cPanel cron ──flock──▶ /cron/digest
         │                                        │
         ▼                                        ▼
  Sync worker (lease: youtube-sync)        Digest worker (lease: youtube-digest)
  Refresh Cached Uploads                   New-only weekly mail
  (YouTube Data API)                       (EmailService + delivery ledger)
         │                                        │
         └────────────────┬───────────────────────┘
                          ▼
                     PostgreSQL
                  (cached metadata)
                          │
                          ▼
              Frontend Dashboard (DB queries only)
```

The two workers are deliberately independent. They hold separate database
leases, keep separate cursors, and run on separate cron entries, so a YouTube
quota stall or one slow account in sync can no longer swallow a week of digest
mail — which is exactly what the previous combined `sync-and-notify` job did.

Each endpoint processes one bounded slice of the User list per call and records
a resume cursor, so neither job has to finish inside a single cron tick.

### YouTube Data API v3 — Quota & Limits

| Endpoint             | Cost (units) | Notes                                                            |
| -------------------- | ------------ | ---------------------------------------------------------------- |
| `subscriptions.list` | 1            | Fetches user's subscribed channels (50 per page)                 |
| `playlistItems.list` | 1            | Fetches videos from a channel's "Uploads" playlist (50 per page) |
| `videos.list`        | 1            | Batch-fetch video details (up to 50 IDs per call)                |
| `search.list`        | **100**      | **Avoid** — extremely expensive                                  |

- **Default daily quota**: 10,000 units per project.
- **Strategy**: Use `playlistItems.list` (1 unit) to get upload IDs, then `videos.list` (1 unit, 50 IDs) for metadata. Never use `search.list`.
- **Estimated cost per user sync**: ~2-5 units per channel (1 page of playlist items + 1 batch video details). A user with 50 channels costs ~100-250 units.
- **Quota increase**: Can be requested via the Google Cloud Console if the user base grows.

### Security

#### OAuth 2.0 (Server-Side Web App Flow)

1. Backend generates a Google OAuth consent URL with scope `https://www.googleapis.com/auth/youtube.readonly`.
2. User authorizes in the browser; Google redirects back with an authorization code.
3. Backend exchanges the code for access + refresh tokens.
4. Tokens are **encrypted at rest** using AES-256-GCM with a server-side secret (`YOUTUBE_TOKEN_ENCRYPTION_KEY` env var) before storing in the database.
5. This is **separate from the E2EE Vault** — the server must be able to decrypt tokens to run background syncs when the user is offline.

#### Token Lifecycle

- Access tokens expire after ~1 hour; the `googleapis` library auto-refreshes using the stored refresh token.
- If a refresh token is revoked by the user via Google settings, the next sync attempt marks the integration as `disconnected` and notifies the user.

#### API Key for Cron Endpoint

- The `/api/v1/youtube/cron/sync` and `/api/v1/youtube/cron/digest` endpoints are protected by an `X-Cron-Secret` header validated against the `YOUTUBE_CRON_SECRET` env var.
- No JWT required — these endpoints are for server-to-server (cPanel cron) use only.

### Environment Variables (new)

| Variable                       | Purpose                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`             | Google OAuth 2.0 client ID                                                  |
| `GOOGLE_CLIENT_SECRET`         | Google OAuth 2.0 client secret                                              |
| `GOOGLE_REDIRECT_URI`          | OAuth callback URL (e.g. `https://api.example.com/api/v1/youtube/callback`) |
| `YOUTUBE_TOKEN_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM token encryption                            |
| `YOUTUBE_CRON_SECRET`          | Shared secret for authenticating cPanel cron requests                       |

## Database Models

### `YouTubeIntegration`

Stores the user's OAuth connection to YouTube.

| Column                    | Type                          | Notes                                    |
| ------------------------- | ----------------------------- | ---------------------------------------- |
| `id`                      | `String @id @default(cuid())` |                                          |
| `userId`                  | `String @unique`              | FK → User                                |
| `encrypted_access_token`  | `String`                      | AES-256-GCM encrypted                    |
| `encrypted_refresh_token` | `String`                      | AES-256-GCM encrypted                    |
| `token_iv`                | `String`                      | Initialization vector for AES            |
| `token_auth_tag`          | `String`                      | GCM auth tag                             |
| `status`                  | `String`                      | `connected` / `disconnected` / `revoked` |
| `createdAt`               | `DateTime`                    |                                          |
| `updatedAt`               | `DateTime`                    |                                          |

### `YouTubeSubscription`

Stores channels the user has chosen to sync.

| Column              | Type                          | Notes                            |
| ------------------- | ----------------------------- | -------------------------------- |
| `id`                | `String @id @default(cuid())` |                                  |
| `userId`            | `String`                      | FK → User                        |
| `channelId`         | `String`                      | YouTube channel ID               |
| `channelTitle`      | `String`                      | Display name                     |
| `channelThumbnail`  | `String?`                     | URL to channel avatar            |
| `uploadsPlaylistId` | `String`                      | The channel's "Uploads" playlist |
| `enabled`           | `Boolean @default(true)`      | User can toggle sync on/off      |
| `lastSyncedAt`      | `DateTime?`                   |                                  |
| `createdAt`         | `DateTime`                    |                                  |
| `updatedAt`         | `DateTime`                    |                                  |

### `YouTubeVideo`

Cached video metadata from synced channels.

| Column        | Type                          | Notes                   |
| ------------- | ----------------------------- | ----------------------- |
| `id`          | `String @id @default(cuid())` |                         |
| `userId`      | `String`                      | FK → User               |
| `videoId`     | `String`                      | YouTube video ID        |
| `channelId`   | `String`                      | Which channel posted it |
| `title`       | `String`                      | Video title             |
| `thumbnail`   | `String?`                     | Thumbnail URL           |
| `publishedAt` | `DateTime`                    | Upload date             |
| `createdAt`   | `DateTime`                    |                         |

### `YouTubeNotificationSettings` (fields on User or separate)

| Column             | Type                          | Notes                                             |
| ------------------ | ----------------------------- | ------------------------------------------------- |
| `id`               | `String @id @default(cuid())` |                                                   |
| `userId`           | `String @unique`              | FK → User                                         |
| `intervalDays`     | `Int @default(7)`             | Legacy; not in the API contract, nothing reads it |
| `lastNotifiedAt`   | `DateTime?`                   | Last successful digest send; the window start     |
| `enabled`          | `Boolean @default(false)`     | Opt-in                                            |
| `optedInAt`        | `DateTime?`                   | Window start before the first send                |
| `preferredWeekday` | `Int @default(1)`             | 0 = Sunday .. 6 = Saturday, local                 |
| `timeZone`         | `String?`                     | IANA; null means UTC                              |
| `unsubscribeToken` | `String? @unique`             | Secret in every digest's unsubscribe link         |
| `createdAt`        | `DateTime`                    |                                                   |
| `updatedAt`        | `DateTime`                    |                                                   |

## API Endpoints

All under `/api/v1/youtube`, JWT-secured unless noted.

| Method   | Path                     | Description                                                                                   |
| -------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| `GET`    | `/auth-url`              | Returns Google OAuth consent URL                                                              |
| `POST`   | `/callback`              | OAuth callback — exchanges `{ code }` JSON body for tokens (JWT-authenticated)                |
| `GET`    | `/status`                | Returns integration status (`connected`/`disconnected`)                                       |
| `DELETE` | `/disconnect`            | Revokes tokens and removes integration                                                        |
| `GET`    | `/subscriptions`         | Lists all user's YouTube channel subscriptions                                                |
| `PUT`    | `/subscriptions/sync`    | Fetches fresh subscriptions from YouTube                                                      |
| `PATCH`  | `/subscriptions/:id`     | Toggle a subscription enabled/disabled                                                        |
| `GET`    | `/videos`                | Returns cached videos with query params: `sort` (latest/oldest/az), `search`, `page`, `limit` |
| `GET`    | `/notification-settings` | Returns digest preferences: opt-in flag, preferred weekday, time zone                         |
| `PATCH`  | `/notification-settings` | Updates opt-in flag, `preferredWeekday` (0-6), and IANA `timeZone`                            |

| `POST` | `/digest/unsubscribe` | **Public**. Turns the digest off from the token carried by every digest email |
| `POST` | `/cron/sync` | **Cron-only** (X-Cron-Secret). One bounded pass of the metadata sync worker |
| `POST` | `/cron/digest` | **Cron-only** (X-Cron-Secret). One bounded pass of the weekly digest worker |

`POST /cron/sync-and-notify` was replaced by the two separate cron endpoints
above. Existing deployments must update their cron entries — see below.

## Weekly digest

- **Opt-in.** `YouTubeNotificationSettings.enabled` defaults to `false`, and
  connecting an account no longer switches it on. The migration also cleared
  the flag for rows created under the old opt-out default.
- **New only.** Eligible items are Cached Uploads from Enabled Channels that
  are still New (`watched = false`) and published after the window start.
  Watched uploads never appear.
- **Window** runs from the last successful send, falling back to `optedInAt`,
  then to when the account was connected — so opting in never back-fills every
  upload the account has ever seen.
- **Long-form only.** Shorts are excluded: they live behind the Shorts Daily
  Budget on their own page, and the digest's per-item link is the long-form
  channel page.
- **Cap** of 25 items per email.
- **No interval knob.** The legacy `intervalDays` column remains on the row but
  is gone from the API contract and the UI — the digest is weekly and fires on
  `preferredWeekday`, so an interval control would do nothing.
- **Empty weeks skip.** No mail is sent, and `lastNotifiedAt` does not advance,
  so the next send still covers the whole gap.
- **Preferred weekday** is evaluated against the User's own calendar using
  their stored IANA `timeZone` (null means UTC).
- **Idempotent ledger.** `YouTubeDigestDelivery` is unique on
  `(userId, periodKey)` where `periodKey` is the local ISO week, e.g.
  `2026-W33`. The row is claimed _before_ the mail reaches SMTP, so a worker
  that dies mid-send leaves a claimed row that no later pass re-sends: losing
  one week's digest is the deliberate trade against mailing it twice.
- **Unsubscribe** link in every email, backed by a stable per-User token, and
  every content link points back into MyOrganizer rather than youtube.com.

## Frontend Views

### YouTube Dashboard (`/dashboard/youtube`)

#### Subscription Manager

- List of synced channels with toggle switches.
- "Sync Subscriptions" button to pull latest from YouTube.
- "Disconnect YouTube" button.

#### Video Feed — Grid View (default)

- Unified list of all videos from enabled subscriptions.
- Sorting: Latest (default), Oldest, A-Z by title.
- Search bar filters the cached list by video title (client-side or server query).
- Responsive grid of video cards (thumbnail + title + channel name + date).

#### Video Feed — Carousel View

- Channels listed alphabetically.
- Each channel shows a horizontal carousel of videos (latest → oldest).
- Clicking a video opens it on YouTube in a new tab.

### Settings Page (existing account page extension)

- Weekly digest opt-in toggle.
- Preferred weekday select (Sunday-Saturday), evaluated in the browser's time zone.

## cPanel Cron Configuration

Use `tools/scripts/youtube-cron.sh`, which wraps the call in a non-blocking
`flock` so a tick that finds the previous one still running exits quietly
instead of queueing up behind it and pinning the shared host's process cap.

```bash
*/15 * * * * YOUTUBE_API_BASE_URL=https://api.example.com/api/v1 YOUTUBE_CRON_SECRET=... /home/user/app/tools/scripts/youtube-cron.sh sync
*/30 * * * * YOUTUBE_API_BASE_URL=https://api.example.com/api/v1 YOUTUBE_CRON_SECRET=... /home/user/app/tools/scripts/youtube-cron.sh digest
```

Both endpoints are safe to call more often than the work needs: each pass is
bounded, resumes from its stored cursor, and no-ops while another pass holds
the lease. Namecheap Stellar Plus allows intervals of ≥ 5 minutes and at most
5 jobs, so two entries at 15 and 30 minutes stay well inside the budget.

Migrating from the old combined job: replace the single
`/cron/sync-and-notify` entry with the two above. Leaving the old entry in
place will simply 404.

## Testing Strategy

### Backend Unit Tests

- `YouTubeTokenEncryption.spec.ts` — encrypt/decrypt round-trip, invalid key handling.
- `YouTubeSyncService.spec.ts` — mock `googleapis`, verify DB writes, quota-efficient fetching.
- `YouTubeDigestService.spec.ts` — New-only eligibility, empty-week skip, ledger idempotency, worker separation from sync.
- `YouTubeSyncWorkerService.spec.ts` — lease acquisition, cursor resumption, revoked-token handling.
- `WorkerLeaseService.spec.ts` — acquire/steal-expired/release, cursor persistence.
- `localCalendar.spec.ts` — local weekday and ISO week key across time zones.
- `YouTubeController.spec.ts` — mock services, test endpoint responses and auth checks.

### Frontend Unit Tests

- `YouTubeDashboard.spec.tsx` — renders grid/carousel views with mocked data.
- `SubscriptionManager.spec.tsx` — toggle interactions, sync button.
- `VideoCard.spec.tsx` — renders video metadata correctly.
- `NotificationSettings.spec.tsx` — interval validation (2-15 range), save.

### E2E Tests

- OAuth flow (mocked Google redirect).
- Dashboard renders with subscriptions and videos.
- View toggle between Grid and Carousel.
- Settings interval update persists.

## Implementation Phases

1. **Phase 1 — Database & Schema**: Add Prisma models, run migration.
2. **Phase 2 — Backend Services**: Token encryption, YouTube API service, sync service, notification service.
3. **Phase 3 — Backend Controller**: TSOA endpoints, cron webhook.
4. **Phase 4 — Frontend Library**: Create `@myorganizer/web-pages/youtube`, build dashboard components.
5. **Phase 5 — Settings Integration**: Extend account settings page.
6. **Phase 6 — Testing**: Unit tests + E2E scaffolding.
