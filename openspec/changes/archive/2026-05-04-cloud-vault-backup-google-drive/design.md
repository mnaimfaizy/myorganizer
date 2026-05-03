## Context

MyOrganizer already has a vault backup audit surface and a hardened export/import pipeline. The current vault settings page in `libs/web/pages/vault-settings` renders `LastBackupCard`, `ExportVaultCard`, and `ImportVaultCard`; `libs/web-vault` already provides `exportVault()` and `importVault()` with schema validation, migration, replay detection, and audit reporting. The remaining gap is off-device backup automation: users can export encrypted bundles locally, but there is no cloud target, no restore-from-cloud path, and no scheduler.

Google Drive `appDataFolder` is a good first provider because it limits access to app-private storage and avoids broader Drive permissions. Current Google guidance for browser apps also matters: a pure browser flow should use Google Identity Services token acquisition with short-lived access tokens, not a stored refresh token. That aligns with MyOrganizer's E2EE posture and the preferred client-side scheduler.

Relevant workflow constraints:

- `vault-feature-workflow`: reuse the existing vault export/import path and keep plaintext in the browser only.
- `frontend-page-library-workflow`: extend the existing vault settings page library; keep `apps/myorganizer/src/app/dashboard/account/vault/page.tsx` thin.
- `backend-api-contract-change`: make only additive controller/service contract changes and regenerate OpenAPI + the generated client.
- `playwright-e2e-workflow`: mock Google flows and keep tests deterministic.
- `auth-session-workflow`: do not change MyOrganizer session cookies or move app refresh tokens into JavaScript storage.
- `prisma-migration-workflow`: intentionally not triggered in this design because no new Prisma model or migration is needed.

## Goals / Non-Goals

**Goals:**

- Let a user connect Google Drive with the `drive.appdata` scope only, back up their encrypted vault manually, restore the latest cloud backup in-browser, and disconnect the provider.
- Add a provider abstraction in `libs/web-vault` so future providers can plug into the same backup coordinator without reworking export/import.
- Support automatic backups on a per-device basis when the app is open and the selected interval is due.
- Record every successful or failed cloud backup/restore attempt in `VaultBackupRecord` with `source='google-drive'`.
- Keep all vault data handling ciphertext-only outside the browser and reuse the generated API client for audit-record interactions.

**Non-Goals:**

- No multi-device sync semantics, server-side backup execution, or background jobs that run while the user is offline.
- No server-side storage of vault ciphertext or Google Drive file contents.
- No new vault blob types, crypto changes, or schema-version changes to the vault envelope itself.
- No providers beyond Google Drive in this change.

## Decisions

### D1. Use browser-only Google OAuth tokens with GIS Token Model

The Google Drive integration will use the Google Identity Services browser token model with scope `https://www.googleapis.com/auth/drive.appdata`. Tokens stay in browser memory only; MyOrganizer will not store Google access tokens or refresh tokens in the database.

Why:

- Current Google guidance for browser apps does not provide long-lived refresh tokens to a pure SPA in the supported token flow.
- Browser-only tokens preserve the E2EE trust model better than server-side credential storage.
- The feature only needs manual operations and while-open scheduling, not offline automation.

Alternatives considered:

- Server-side encrypted refresh tokens plus backend cron: rejected for this change because it increases backend trust, requires new OAuth endpoints and Prisma storage, and is unnecessary for a while-open scheduler.
- Persisting provider tokens in localStorage/sessionStorage: rejected because JavaScript-accessible long-lived tokens materially increase XSS risk.

### D2. Keep cloud backup and restore fully client-side

Cloud backup will call `exportVault({ source: 'google-drive' })`, upload the returned JSON text to Drive, and report the resulting audit record through the existing backup API. Cloud restore will download the latest retained backup from Drive into the browser and pass the text to `importVault({ source: 'google-drive' })`.

Why:

- It reuses the existing validated, stage-then-commit pipeline in `libs/web-vault`.
- The server still never sees vault ciphertext bodies from the cloud provider.
- Restore on a fresh device remains compatible with the existing unlock flow: import first, then unlock with the user's vault key.

Alternatives considered:

- Backend proxying Drive downloads/uploads: rejected because it would put cloud file contents in server transit and adds no benefit for this scope.

### D3. Introduce a provider abstraction in `libs/web-vault`

Add a `CloudBackupProvider` interface in `libs/web-vault` with provider-facing operations only:

- `getConnectionState()`
- `connect()`
- `disconnect()`
- `uploadBackup()`
- `downloadLatestBackup()`
- `pruneBackups()`

`GoogleDriveCloudBackupProvider` will implement the interface using GIS token acquisition plus direct Drive REST calls from the browser. A `CloudBackupCoordinator` in `libs/web-vault` will orchestrate export/import, audit reporting, retention, scheduler checks, and provider errors.

Why:

- It keeps provider-specific OAuth and Drive REST details out of the page library.
- It lets future providers attach to the same coordinator and UI contracts.

Alternatives considered:

- Putting Google logic directly in the vault settings page: rejected because it breaks page-library boundaries and would make future providers invasive.

### D4. Use finalized backup files plus retention rotation in `appDataFolder`

Each backup will be stored as a single JSON file in `appDataFolder`, named with timestamp plus `exportId`, and tagged with app properties such as `kind=myorganizer-vault-backup`, `status=pending|complete`, `schemaVersion`, and `exportId`. Upload flow:

1. Create/upload file with `status='pending'`.
2. After upload succeeds, patch metadata to `status='complete'`.
3. Prune oldest completed backups over the retention limit.
4. Opportunistically clean up stale pending files older than a configured threshold.

Restore only considers files with `status='complete'`.

Retention policy: keep the last `N` completed backups, with `N=10` by default and exposed as a config constant rather than a user-facing control in this change.

Why:

- It protects restore from partial uploads and gives deterministic recovery behavior.
- It preserves older good backups if a new upload fails midway.

Alternatives considered:

- Single rolling file: rejected because it removes recovery points and makes interrupted uploads riskier.
- Ignoring partial uploads without explicit finalization: rejected because Drive requests can fail ambiguously and stale objects would be hard to distinguish from valid backups.

### D5. Schedule backups on the client, using audit history as the due-time source of truth

Automatic backup will be a client-side scheduler that runs only when the app is open. It will live in `libs/web-vault` and be activated by the vault settings page or a lightweight app-level mount point. The scheduler will check due-ness from the latest successful `google-drive` `VaultBackupRecord`, not from a browser clock entry alone.

Trigger conditions:

- app becomes visible
- app comes online
- user opens vault settings
- periodic timer while the session is active

If the interval (`daily | weekly | monthly`) has elapsed and auto-backup is enabled on this device, the coordinator attempts a backup. If GIS cannot supply a token silently, the scheduler marks the provider as needing reconnect and stops; it never opens a popup without user interaction.

Why:

- It matches the requested preference for client-side scheduling.
- Using `VaultBackupRecord` as the timestamp source avoids drift and reflects the last successful cloud backup across devices.

Alternatives considered:

- Backend cron: rejected because the chosen OAuth model has no server-held Drive credentials and because this feature is backup, not server-managed sync.

### D6. Treat settings as per-device local preferences

The provider connection state, auto-backup toggle, and interval are stored in browser-local preference storage managed by `libs/web-vault`. They are not synced across devices in this change. A fresh device can still restore by connecting Google Drive and downloading the latest retained backup, but it must opt into scheduling separately.

Why:

- Tokens are browser-local by design.
- This avoids adding user-settings backend storage for a feature that cannot run cross-device unless the device is also connected to Google.

Alternatives considered:

- Persisting the interval server-side: rejected for now because it creates a misleading expectation of cross-device scheduling while provider authorization remains local.

### D7. Make additive backend contract changes only

No new Prisma model is required. `VaultBackupRecord` stays unchanged. The backend changes are limited to `apps/backend` controller/service constants and DTO validation so the existing audit endpoints understand cloud-source filters:

- `POST /api/v1/vault/backups`: allow `source='google-drive'`.
- `GET /api/v1/vault/backups/latest`: add optional `source` filter so the UI can ask for the latest successful Google Drive backup instead of the latest backup of any source.
- `GET /api/v1/vault/backups`: add optional `source` filter for future debugging/history views.

Required regen steps:

- `yarn openapi:sync`
- `yarn api:generate`
- `yarn openapi:check`

Why:

- The UI needs cloud-specific “last backup” semantics.
- Keeping the contract additive avoids a migration and keeps the change narrowly scoped.

Alternatives considered:

- Adding separate cloud-backup audit endpoints: rejected because the existing backup audit resource already owns this metadata.

### D8. Extend the existing vault settings page library instead of creating a new route

The current route wrapper already points to `@myorganizer/web-pages/vault-settings`. That page library will add a `CloudBackupCard` alongside the existing `LastBackupCard`, `ExportVaultCard`, and `ImportVaultCard`. `libs/web-vault-ui` will host presentational pieces such as provider status, schedule controls, backup/restore actions, and reconnect messaging; `libs/web-vault` will own the hooks and coordinator.

Touched Nx surfaces:

- `libs/web-vault`: provider interface, Google Drive implementation, scheduler, browser-local settings, coordinator, tests.
- `libs/web-vault-ui`: cloud backup card(s), connect/disconnect controls, schedule form, tests.
- `libs/web/pages/vault-settings`: compose the new UI and switch latest-backup queries to `source='google-drive'`.
- `apps/backend`: source enum/filter updates in constants, controller, service, tests.
- `libs/api-specs` and `libs/app-api-client`: regenerated outputs after contract update.
- `apps/myorganizer-e2e`: mocked Google Drive connect/backup/restore/disconnect coverage.

## Risks / Trade-offs

- Token expires or silent renewal fails while the app is open → reacquire via GIS when possible; otherwise mark the provider disconnected and require the next user gesture to reconnect.
- Auto-backup preferences are per-device, not synced → document this in the UI and rely on backend audit history only for due-time calculation, not for device authorization.
- A newer local-file export could hide the most recent cloud backup if the UI uses the wrong query → add backend `source` filtering and make the vault settings page request `status=success&source=google-drive`.
- Interrupted uploads can leave orphaned Drive files → only restore completed files and clean stale pending files opportunistically.
- Popup blockers or background tabs can block OAuth prompts → connect and restore start from explicit user gestures; the scheduler never triggers an interactive OAuth prompt.

## Migration Plan

1. Update `VaultBackupSource` and backup-query filters in `apps/backend`, then regenerate OpenAPI and `@myorganizer/app-api-client`.
2. Implement `CloudBackupProvider`, `GoogleDriveCloudBackupProvider`, the backup coordinator, and local preference storage in `libs/web-vault`.
3. Extend `libs/web-vault-ui` and `libs/web/pages/vault-settings` with connect/disconnect, manual backup, restore, last-cloud-backup display, and auto-backup controls.
4. Add Jest coverage for provider logic, interval math, access-token renewal handling, and partial-upload recovery.
5. Add mocked Playwright coverage for connect, manual backup, automatic trigger, restore, and disconnect.
6. Validate with `yarn openapi:check`, targeted Jest runs, and Playwright e2e.

Rollback is straightforward because the backend change is additive and there is no Prisma migration. Reverting the frontend removes the feature; reverting the backend narrows the allowed source/filter contract back to local-file only.

## Open Questions

- None blocking for implementation. Future follow-up can decide whether per-device schedule preferences should later sync through a non-sensitive user settings API once multiple providers exist.
