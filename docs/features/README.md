# Feature documentation

End-to-end developer documentation for individual product features.

## Features Index

| Feature        | Status | Vault-backed | Docs                                                                                                                         |
| -------------- | ------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Tasks          | ✅     | Yes          | —                                                                                                                            |
| Subscriptions  | ✅     | Yes          | —                                                                                                                            |
| Addresses      | ✅     | Yes          | —                                                                                                                            |
| Groceries      | ✅     | Yes          | [groceries.md](./groceries.md)                                                                                               |
| Mobile Numbers | ✅     | Yes          | —                                                                                                                            |
| Vault          | ✅     | Yes          | [vault-cloud-backup-google-drive.md](./vault-cloud-backup-google-drive.md), [escape-copy-reader.md](./escape-copy-reader.md) |
| YouTube        | ✅     | No           | [youtube-integration.md](./youtube-integration.md)                                                                           |

## Google integrations

MyOrganizer integrates with two distinct Google APIs. They share Google Cloud
as the OAuth provider but use very different flows, scopes, and credentials.

| Integration                                                               | Flow                           | Where token lives                                | Required env (browser)         | Required env (backend)                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [Vault cloud backup → Google Drive](./vault-cloud-backup-google-drive.md) | Browser implicit (GIS)         | In-memory in the browser; localStorage flag only | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | _none_                                                                                                                   |
| [YouTube subscriptions](./youtube-integration.md)                         | Server-side authorization code | Encrypted (AES-256-GCM) in Postgres              | _none_                         | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `YOUTUBE_TOKEN_ENCRYPTION_KEY`, `YOUTUBE_CRON_SECRET` |

### Where to start

- **Setting up Google Cloud Console for the first time?**
  Read [google-youtube-oauth-setup.md](./google-youtube-oauth-setup.md) — it
  walks through project creation, the OAuth consent screen, and creating a
  Web Application OAuth client. Development and staging may reuse that
  Testing-project client for Drive backup by adding **Authorized JavaScript
  origins** in addition to the redirect URIs. Production Drive uses its
  **own** Cloud project ([ADR 0091](../adr/0091-a-google-cloud-project-is-split-by-verification-not-by-environment.md));
  do not put `drive.appdata` on the YouTube production consent screen.

- **Adding the Drive cloud backup feature to your environment?**
  Read [vault-cloud-backup-google-drive.md](./vault-cloud-backup-google-drive.md).
  Pay particular attention to the `Authorized JavaScript origins` step, the
  `drive.appdata` scope, and the sticky production client id.

- **Working on YouTube sync, OAuth, or the cron?**
  Read [youtube-integration.md](./youtube-integration.md) for architecture,
  data flow, quotas, and DB models.

## Conventions

- Docs live in `docs/features/` and are linked from
  [`README.md`](../../README.md#documentation).
- Feature docs use ASCII diagrams or Mermaid blocks; tables for env vars and
  troubleshooting; and link to the relevant source files (workspace-relative
  paths) so readers can jump straight into the code.
- Cross-link sibling features instead of duplicating their content.
