## Why

Vault users can export encrypted backups locally, but they cannot keep an off-device copy current without repeated manual effort. Adding opt-in encrypted cloud backups addresses device-loss recovery, gives users a reliable last-backup signal, and extends the existing vault backup audit work without weakening the ciphertext-only server model.

## What Changes

- Add opt-in cloud vault backup support with a provider abstraction and a first Google Drive implementation limited to `appDataFolder`.
- Add vault settings controls to connect or disconnect Google Drive, trigger manual backup or restore, configure automatic backup cadence, and show the latest successful cloud backup metadata.
- Add backup scheduling, retention, restore, and failure-recovery behavior for encrypted cloud backups while keeping all plaintext and decrypted vault material in the browser only.
- Extend backup audit recording so every successful or failed Google Drive backup or restore writes a `VaultBackupRecord` with `source='google-drive'`.
- Add backend and generated-client support for provider auth and encrypted credential handling where required, plus unit and Playwright coverage for the new flow.

## Capabilities

### New Capabilities

- `cloud-vault-backup`: Connect a personal cloud provider, upload encrypted vault backups, restore them client-side, and schedule automatic backups without introducing server-side ciphertext storage.

### Modified Capabilities

- `vault-backup-audit`: Extend backup audit requirements to record Google Drive backup and restore attempts, expose latest successful cloud backup metadata, and preserve metadata-only logging.
- `vault-export-import`: Extend vault restore requirements so cloud restores reuse the existing validated import pipeline without changing vault crypto or allowing plaintext to leave the browser.

## Impact

- Backend: OAuth/provider endpoints or token persistence, provider-facing services, `VaultBackupRecord` reuse, possible Prisma storage for encrypted provider credentials, OpenAPI sync, and generated API client regeneration.
- Frontend: Vault settings page-library updates, `libs/web-vault` provider and scheduler logic, restore UI, and Google Drive connect/disconnect flow.
- Security/Auth: New OAuth 2.0 flow, token refresh handling, and explicit E2EE guarantees that only ciphertext leaves the client.
- Testing: New Jest coverage for provider behavior, scheduling math, token refresh, partial-upload recovery, and mocked Playwright flows for connect, backup, restore, automatic trigger, and disconnect.

## Non-goals

- Adding providers beyond Google Drive in this change.
- Changing vault cryptography, blob types, or turning backup into multi-device sync.
- Storing vault plaintext or backup ciphertext on MyOrganizer servers.
