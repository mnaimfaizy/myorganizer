# Vault Page Agent Guide

## Scope

Consolidated dashboard vault page (`/dashboard/vault`): cloud backup, export, and import cards. Not a vault blob CRUD page, and not the cross-source last-backup summary — that card stays on the account page only.

## Do

- Export and import ciphertext plus metadata only.
- Validate bundle version, shape, and size before persistence.
- Use the normal vault unlock flow after import.
- Keep cloud backup on the browser Google Identity Services implicit flow; tokens stay in memory.
- Treat Drive `appDataFolder` snapshots as ciphertext plus metadata only.
- Feature behaviour for humans lives in `docs/features/vault-cloud-backup-google-drive.md`.

## Do Not

- Do not display, log, or upload decrypted vault contents.
- Do not reuse YouTube OAuth, scopes, or backend token storage for Drive backup.
- Do not render the cross-source last-backup summary card here — it belongs to the account page.
