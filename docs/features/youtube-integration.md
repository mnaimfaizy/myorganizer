# YouTube Integration Feature

## Overview

Allow users to securely link their YouTube account via OAuth 2.0, sync selected channel subscriptions, browse cached videos with sorting/searching/view modes, and receive periodic email notifications for new uploads.

## Architecture

### Data Flow

```
User ──OAuth 2.0──▶ Google  ──tokens──▶  Backend (encrypted at rest in DB)
                                              │
                 cPanel cron (daily) ────▶ /api/v1/youtube/cron/sync-and-notify
                                              │
                                    ┌─────────┴──────────┐
                                    ▼                     ▼
                            Sync new videos         Send email digests
                          (YouTube Data API)       (existing EmailService)
                                    │
                                    ▼
                              PostgreSQL
                           (cached metadata)
                                    │
                                    ▼
                        Frontend Dashboard (DB queries only)
```

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

- The `/api/v1/youtube/cron/sync-and-notify` endpoint is protected by an `X-Cron-Secret` header validated against the `YOUTUBE_CRON_SECRET` env var.
- No JWT required — this endpoint is for server-to-server (cPanel cron) use only.

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

| Column           | Type                          | Notes            |
| ---------------- | ----------------------------- | ---------------- |
| `id`             | `String @id @default(cuid())` |                  |
| `userId`         | `String @unique`              | FK → User        |
| `intervalDays`   | `Int @default(7)`             | 2-15 days        |
| `lastNotifiedAt` | `DateTime?`                   | Last digest sent |
| `enabled`        | `Boolean @default(true)`      |                  |
| `createdAt`      | `DateTime`                    |                  |
| `updatedAt`      | `DateTime`                    |                  |

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
| `GET`    | `/notification-settings` | Returns user's notification preferences                                                       |
| `PATCH`  | `/notification-settings` | Updates interval (2-15 days) and enabled flag                                                 |
| `POST`   | `/cron/sync-and-notify`  | **Cron-only** (X-Cron-Secret). Syncs all users and sends due notifications                    |

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

- Notification interval slider/select (2-15 days).
- Enable/disable YouTube notifications toggle.

## cPanel Cron Configuration

Add a daily cron job (e.g., at 02:00 server time):

```bash
curl -s -X POST https://api.example.com/api/v1/youtube/cron/sync-and-notify \
  -H "X-Cron-Secret: $YOUTUBE_CRON_SECRET" \
  -H "Content-Type: application/json"
```

## Testing Strategy

### Backend Unit Tests

- `YouTubeTokenEncryption.spec.ts` — encrypt/decrypt round-trip, invalid key handling.
- `YouTubeSyncService.spec.ts` — mock `googleapis`, verify DB writes, quota-efficient fetching.
- `YouTubeNotificationService.spec.ts` — mock DB queries, verify email dispatch logic.
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
