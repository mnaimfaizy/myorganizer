# Vault Settings Page Agent Guide

## Scope

Dashboard vault settings page for ciphertext export/import cards and Google Drive cloud backup (`/dashboard/account/vault`). Not a vault blob CRUD page. The `useCloudBackup`, `useGoogleIdentityScript`, and `useLatestCloudBackup` hooks live in `@myorganizer/web-pages/vault`; this page imports them from there rather than holding a second copy. Only the cross-source `useLatestBackup` hook (for `LastBackupCard`) stays local.

## Do

- Keep cloud backup on the browser Google Identity Services implicit flow; tokens stay in memory.
- Treat Drive `appDataFolder` snapshots as ciphertext plus metadata only.
- Preserve the import path `@myorganizer/web-pages/vault-settings`.
- Feature behaviour for humans lives in `docs/features/vault-cloud-backup-google-drive.md`.

## Do Not

- Do not reuse YouTube OAuth, scopes, or backend token storage for Drive backup.
- Do not display, log, or upload decrypted vault contents.
