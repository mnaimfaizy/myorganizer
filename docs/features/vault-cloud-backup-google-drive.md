# Vault Cloud Backup — Google Drive Integration

End-to-end documentation for the **vault cloud backup** feature: how it works,
how to configure Google OAuth credentials for it, the relevant code surface,
and troubleshooting.

> **Scope.** This document covers the feature exposed at
> `/dashboard/account/vault` (the "Vault Settings" page). It is **separate**
> from the [YouTube integration](./google-youtube-oauth-setup.md) — they share
> Google Cloud as the OAuth provider but use different flows, scopes, and
> credentials.

## Table of contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Google Cloud Console setup](#google-cloud-console-setup)
- [Environment variables](#environment-variables)
- [Frontend integration points](#frontend-integration-points)
- [Backend integration points](#backend-integration-points)
- [Connection persistence and the silent-token flow](#connection-persistence-and-the-silent-token-flow)
- [Auto-backup scheduler](#auto-backup-scheduler)
- [Retention and pending-file cleanup](#retention-and-pending-file-cleanup)
- [Troubleshooting](#troubleshooting)
- [References](#references)

---

## Overview

Vault cloud backup lets a user upload an encrypted snapshot of their personal
vault to **their own Google Drive `appDataFolder`** (a per-app hidden folder
that only this app can read or write).

Key properties:

- **End-to-end encrypted.** The vault is encrypted on the client using the
  same envelope as `Export Vault`. Google Drive (and Google) sees only
  ciphertext.
- **Browser-only OAuth.** The browser obtains an access token directly from
  Google Identity Services (GIS) using the **implicit token flow** with the
  `drive.appdata` scope. The backend **never** receives the user's Google
  access token.
- **No server-side Drive calls.** Upload, list, download, and delete all
  happen from the browser to `googleapis.com`.
- **Audit log only on the backend.** The backend is told _that_ a backup
  succeeded/failed (size, blob types, schema version, source =
  `google-drive`), so the user can see "Last cloud backup at …" across
  devices via `GET /vault/backups/latest`.

### How is this different from "Vault Export / Import"?

| Capability       | Vault Export / Import                             | Vault Cloud Backup                                          |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Trigger          | Manual download / upload of a JSON file           | Manual "Back up now" button + optional daily/weekly/monthly |
| Storage          | User's local filesystem                           | User's Google Drive (`appDataFolder`)                       |
| Auth             | None beyond the app login                         | Google account (browser OAuth, scope `drive.appdata`)       |
| Encryption       | Client-side envelope (E2EE)                       | Same client-side envelope (E2EE)                            |
| Server knowledge | Backup audit row (size, blobTypes, schemaVersion) | Same audit row, but with `source = 'google-drive'`          |

### How is this different from the YouTube integration?

| Capability               | YouTube integration                                                                                                      | Vault cloud backup                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| OAuth flow               | **Server-side web app flow** (`code` exchanged on backend)                                                               | **Browser implicit token flow** (GIS in the page)     |
| Token storage            | Encrypted at rest in Postgres (backend has refresh token)                                                                | In-memory only (browser); re-acquired on user gesture |
| Scopes                   | `youtube.readonly`                                                                                                       | `drive.appdata`                                       |
| Required env on backend  | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `YOUTUBE_TOKEN_ENCRYPTION_KEY`, `YOUTUBE_CRON_SECRET` | _none — backend stores no Drive token_                |
| Required env on frontend | _none_                                                                                                                   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID`                        |

The two features can share a single OAuth client in Google Cloud Console (it
just needs both **Authorized redirect URIs** _and_ **Authorized JavaScript
origins** filled in), or they can use separate clients — see
[Google Cloud Console setup](#google-cloud-console-setup) below.

---

## Architecture

```
                         ┌──────────────────────────────────────────────┐
                         │  Browser (Next.js client)                    │
                         │                                              │
   user clicks ─────────▶│  CloudBackupCard                             │
   "Back up now"         │     │                                        │
                         │     ▼                                        │
                         │  useCloudBackup hook                         │
                         │     │                                        │
                         │     ▼                                        │
                         │  CloudBackupCoordinator                      │
                         │     ├──▶ encrypts vault (E2EE envelope)      │
                         │     │                                        │
                         │     ├──▶ GoogleDriveCloudBackupProvider      │
                         │     │       │                                │
                         │     │       │ POST /drive/v3/files           │
                         │     │       │ PATCH /upload/drive/v3/files   │
                         │     │       │ PATCH finalize metadata        │
                         │     │       ▼                                │
                         │     │   Google Drive (appDataFolder)         │
                         │     │   ciphertext only ✱                    │
                         │     │                                        │
                         │     └──▶ AuditReporter                       │
                         │            │ POST /vault/backups             │
                         │            ▼                                 │
                         └────────────┼─────────────────────────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────────────────────────┐
                         │  Backend (Express + Prisma)                  │
                         │                                              │
                         │  VaultBackupController (JWT-protected)       │
                         │     POST /vault/backups        ▶ audit row   │
                         │     GET  /vault/backups/latest  ◀ "last      │
                         │     GET  /vault/backups            backup"   │
                         │                                              │
                         │  Stores ONLY the audit row                   │
                         │  (event, source, status, size, blobTypes…)   │
                         └──────────────────────────────────────────────┘
```

✱ The backend never holds the user's Google access token, never proxies a
Drive call, and never sees the plaintext vault.

---

## Google Cloud Console setup

The browser flow uses Google Identity Services (GIS). GIS validates two
things on every token request:

1. The **OAuth Client ID** (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`).
2. The **JavaScript origin** of the page making the request.

> If you only set "Authorized redirect URIs" (the YouTube setup), GIS will
> reject the request with **`Error 400: redirect_uri_mismatch`** even though
> there is no redirect — the actual error is "origin not authorized".

### Step 1 — Pick (or create) the Cloud project

You can either:

- **Reuse the same Cloud project as YouTube.** Easiest for solo / personal
  setups. The single OAuth client gets both "Authorized redirect URIs"
  (YouTube) and "Authorized JavaScript origins" (Drive backup).
- **Create a separate project.** Recommended for production so the YouTube
  Data API quota and the Drive API quota stay isolated.

### Step 2 — Enable the Google Drive API

1. In the Cloud Console, go to **APIs & Services → Library**.
2. Search **Google Drive API** and click **Enable**.
3. _Do not_ also enable Drive Activity API or Drive Labels API; they aren't
   used.

### Step 3 — Configure the OAuth consent screen

If you already configured it for YouTube, you can reuse it. Otherwise:

1. **Google Auth platform → Branding** → fill app name, support email, dev
   contact.
2. **User type:** External (or Internal for Workspace orgs).
3. **Data Access → Add or Remove Scopes** → add:
   `https://www.googleapis.com/auth/drive.appdata`

   The `drive.appdata` scope is _**not**_ classed as a sensitive or
   restricted scope, which means:
   - No app verification is required to publish in production.
   - The "unverified app" warning still appears in **Testing** mode for
     external users.

4. **Audience → Test users:** while in Testing mode, add every Google
   account that needs to use cloud backup (your own dev account, QA users,
   etc.). External users not on this list will see `access_denied`.

### Step 4 — Create / edit the OAuth Client ID

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. **Application type:** Web application.
3. **Authorized JavaScript origins** — add the page origins where the cloud
   backup UI loads (no trailing slash, no path):

   | Environment | Origin                        |
   | ----------- | ----------------------------- |
   | Local dev   | `http://localhost:4200`       |
   | Staging     | `https://staging.example.com` |
   | Production  | `https://app.example.com`     |

4. **Authorized redirect URIs** — only needed if this same client is also
   used for YouTube; otherwise leave empty.

   | Used for | Redirect URI                                              |
   | -------- | --------------------------------------------------------- |
   | YouTube  | `http://localhost:4200/dashboard/youtube/callback` (etc.) |
   | Drive    | _(none — implicit flow has no redirect)_                  |

5. **Save.** Copy the **Client ID**. The Client Secret is _not_ needed for
   the Drive flow (it's a public OAuth client; Drive is browser-only).

### Step 5 — Verify the consent screen

Sign out of all Google accounts, then visit the dev app and click
**Connect Google Drive**. Confirm the popup shows:

- The correct app name.
- A **single** scope item: _"See, create, and delete its own configuration
  data in your Google Drive"_.

If you see additional scopes (`profile`, `email`, `youtube.readonly`, etc.)
the wrong client ID is wired up — check `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

---

## Environment variables

| Variable                       | Where used | Required for cloud backup | Notes                                        |
| ------------------------------ | ---------- | :-----------------------: | -------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Frontend   |          **Yes**          | Public OAuth client id (sent to the browser) |
| `GOOGLE_CLIENT_ID`             | Backend    |            No             | Used by the YouTube server-side flow         |
| `GOOGLE_CLIENT_SECRET`         | Backend    |            No             | YouTube only                                 |
| `GOOGLE_REDIRECT_URI`          | Backend    |            No             | YouTube only                                 |

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is consumed in
[libs/web/pages/vault-settings/src/page.tsx](../../libs/web/pages/vault-settings/src/page.tsx).
If it is empty (or the GIS script fails to load) the page renders a
disabled card with the message _"Cloud backup is not configured…"_ instead
of the connect controls.

For Next.js to pick up the variable, restart `corepack yarn start:myorganizer`
after editing `.env`. `NEXT_PUBLIC_*` values are inlined at build time.

> **Ops note.** In production, set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the
> Vercel/cPanel environment configuration **before** the production build
> step runs. Re-deploy after changing it.

---

## Frontend integration points

```
libs/web-vault/src/lib/cloud/
├── coordinator.ts          # CloudBackupCoordinator — orchestrates upload+audit
├── googleDriveProvider.ts  # GoogleDriveCloudBackupProvider — GIS + Drive calls
├── googleIdentity.types.ts # GIS / window.google typings
├── preferences.ts          # localStorage prefs (auto-backup interval, retention)
├── scheduler.ts            # Client-side poll + visibility/online listeners
└── types.ts                # Public CloudBackupProvider interface

libs/web-vault/src/lib/vault/auditReporter.ts
                            # POST /vault/backups (used by coordinator)

libs/web/pages/vault-settings/src/
├── hooks/
│   ├── useCloudBackup.ts          # connect / backupNow / restoreLatest / autoInterval
│   ├── useGoogleIdentityScript.ts # loads https://accounts.google.com/gsi/client
│   ├── useLatestBackup.ts         # latest backup of any source
│   └── useLatestCloudBackup.ts    # latest backup with source='google-drive'
└── page.tsx                       # VaultSettingsPage (renders CloudBackupCard etc.)

libs/web-vault-ui/src/lib/cloud/CloudBackupCard.tsx
                            # The visible card with all the buttons
```

The Next.js route wrapper at
[apps/myorganizer/src/app/dashboard/account/vault/page.tsx](../../apps/myorganizer/src/app/dashboard/account/vault/page.tsx)
is intentionally minimal — it just re-exports `VaultSettingsPage` from the
`@myorganizer/web-pages/vault-settings` library.

The page is reachable from:

- **Sidebar → "Vault Settings"** (added in
  [libs/web/pages/dashboard/src/components/app-sidebar.tsx](../../libs/web/pages/dashboard/src/components/app-sidebar.tsx)).
- **Avatar menu → Account → "Manage vault settings & cloud backup →"** link
  in [AccountPageClient](../../libs/web/pages/account/src/components/AccountPageClient.tsx).

---

## Backend integration points

The backend exposes three JWT-protected endpoints under `/api/v1/vault/backups`:

| Method | Path                                       | Purpose                                         |
| ------ | ------------------------------------------ | ----------------------------------------------- |
| POST   | `/vault/backups`                           | Append an audit row (called by `AuditReporter`) |
| GET    | `/vault/backups/latest?status=…&source=…`  | Fetch latest matching audit row (404 if none)   |
| GET    | `/vault/backups?cursor=…&limit=…&source=…` | Cursor-paginated list of audit rows             |

Schema highlights (Prisma model `VaultBackup`):

- `event` — `export | restore` (always `export` for cloud backup writes)
- `source` — `download | google-drive` (extend the union to add providers)
- `status` — `success | failure`
- `errorCode`, `schemaVersion`, `blobTypes[]`, `sizeBytes`, `createdAt`

`source = 'google-drive'` is allow-listed in
[apps/backend/src/services/vaultBackup/constants.ts](../../apps/backend/src/services/vaultBackup/constants.ts);
adding a new cloud provider means extending that allow-list, regenerating
the OpenAPI client (`yarn openapi:sync && yarn api:generate`), and updating
the relevant page hooks/UI.

---

## Connection persistence and the silent-token flow

Browsers block popup windows that aren't tied to a user gesture. That means
we **cannot** silently re-acquire a Google access token on page load.
Instead, the provider uses an **optimistic-connected** model:

1. After a successful `connect()`, the provider writes a flag to
   `localStorage`:

   ```
   key:   myorganizer.cloudBackup.googleDrive.connected
   value: "1"
   ```

2. On subsequent page loads, `getConnectionState()` reads the flag and
   returns `{ status: 'connected' }` without contacting Google. The UI
   shows **"Connected"**.

3. The first authenticated **user gesture** (clicking _Back up now_ or
   _Restore from cloud_) triggers `acquireToken({ interactive: false })`,
   which calls `requestAccessToken({ prompt: '' })`. Because this runs
   inside a click handler, the popup is allowed; if the user is still
   signed into the same Google account, GIS reuses the existing session
   and the popup self-closes within ~50 ms (no consent screen).

4. If the silent acquisition fails (the user revoked consent, signed out
   of Google, etc.), `runWithBusy` catches the error and refreshes
   connection state to `needs-reconnect`, surfacing a "Reconnect" prompt
   in the UI.

5. `disconnect()` revokes the token via `google.accounts.oauth2.revoke()`
   and clears the localStorage flag.

> **Implementation:**
> [libs/web-vault/src/lib/cloud/googleDriveProvider.ts](../../libs/web-vault/src/lib/cloud/googleDriveProvider.ts)
> — see `getConnectionState`, `connect`, `disconnect`, `acquireToken`,
> `readConnectedFlag`, and `writeConnectedFlag`.

---

## Auto-backup scheduler

When the user picks a non-`off` interval (`daily`, `weekly`, `monthly`), the
hook starts the client-side scheduler from
[libs/web-vault/src/lib/cloud/scheduler.ts](../../libs/web-vault/src/lib/cloud/scheduler.ts).

- Default poll: **15 minutes** while the tab is open.
- Also fires on `visibilitychange` (tab becomes visible) and `online`
  (network restored) events.
- Skip rules: `interval === 'off'`, not yet due, `canRunNow()` returned
  false (e.g. silent token would prompt), or a backup is in flight.
- Due-ness uses the **server-side last successful Google Drive backup**
  (`GET /vault/backups/latest?status=success&source=google-drive`), not
  any client clock — so multi-device users converge.
- The scheduler **never** triggers an interactive OAuth prompt. If
  `provider.canRunSilently()` returns false, it skips and the user must
  click _Back up now_ to reauthorize.

---

## Retention and pending-file cleanup

After every successful upload the coordinator calls `provider.pruneBackups`:

- Keeps the latest **N** completed files (default `CLOUD_BACKUP_DEFAULT_RETENTION = 10`).
- Deletes pending files older than `CLOUD_BACKUP_STALE_PENDING_MS` (24 h)
  to recover from interrupted uploads.
- Errors during prune are logged via `console.warn` and never block a
  successful backup.

Override defaults via `CloudBackupCoordinator` constructor options
(`retention`, `stalePendingMs`).

---

## Troubleshooting

| Symptom                                                              | Likely cause                                                                               | Fix                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Error 400: redirect_uri_mismatch` on connect popup                  | The page origin is not in **Authorized JavaScript origins** of the OAuth client.           | Add `http://localhost:4200` (and prod origins) under **Credentials → OAuth client → Authorized JavaScript origins**.                                            |
| `Drive request failed: 403 …Drive API has not been used in project…` | Google Drive API is not enabled in the GCP project owning the OAuth client.                | Enable **Google Drive API** in **APIs & Services → Library**.                                                                                                   |
| `Drive request failed: 403 Insufficient Permission`                  | The user closed the consent popup before granting `drive.appdata`.                         | Click **Disconnect**, then **Connect Google Drive** again, leaving the scope checkbox checked.                                                                  |
| `Drive request failed: 403 access_denied` / "App is blocked"         | Consent screen is in **Testing** and the user is not on the test-users list.               | Add the email to **OAuth consent → Audience → Test users**, or publish the app.                                                                                 |
| Cloud backup card shows _"Cloud backup is not configured"_           | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is empty at build time.                                     | Set the env var in `.env` (and the production deploy environment) and rebuild.                                                                                  |
| Brief popup flashes on every page load                               | Old build still calls `acquireToken({ interactive: false })` from `getConnectionState`.    | Pull latest `main`. Current code never re-acquires tokens outside a user gesture.                                                                               |
| `[GSI_LOGGER]: Failed to open popup window … Maybe blocked…`         | A token request is happening outside a user-gesture (e.g. scheduler called interactively). | Filed in code: scheduler uses `canRunSilently()` which only checks cached tokens. If you patched it, restore the user-gesture-only invariant.                   |
| `POST /vault/backups → 401`                                          | The app's JWT access token expired or was signed with a different secret.                  | Logout → login. If still failing, check that `ACCESS_JWT_SECRET` matches between the running backend and the token issuer.                                      |
| `GET /vault/backups/latest → 401`                                    | Same as above.                                                                             | Logout → login.                                                                                                                                                 |
| Connect button is disabled                                           | The GIS script (`https://accounts.google.com/gsi/client`) failed to load.                  | Check Network tab; common causes are content blockers, an offline state, or a strict CSP that omits `accounts.google.com`. Allowlist `*.gstatic.com` if needed. |

When debugging Drive errors specifically, the provider re-reads the response
body and includes Google's `error.message` field in the thrown `Error`. The
exact error payload is logged in DevTools under the failing `googleapis.com`
request — it is the most authoritative source.

---

## References

- Google Identity Services — [token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- Drive API — [`appDataFolder` reference](https://developers.google.com/drive/api/guides/appdata)
- Drive API — [files.create with appProperties](https://developers.google.com/drive/api/reference/rest/v3/files)
- OWASP — [OAuth 2.0 implicit flow guidance](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- Internal: [E2EE Vault plan](../internal/e2ee-vault-plan.md), [vault export/import UI plan](../internal/vault-export-import-ui.md)
- Sibling integration: [YouTube OAuth setup](./google-youtube-oauth-setup.md), [YouTube integration architecture](./youtube-integration.md)
