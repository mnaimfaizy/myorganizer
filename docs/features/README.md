# Feature documentation

End-to-end developer documentation for individual product features.

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
  Web Application OAuth client. The same client can be reused for the Drive
  backup feature by adding **Authorized JavaScript origins** in addition to
  the redirect URIs.

- **Adding the Drive cloud backup feature to your environment?**
  Read [vault-cloud-backup-google-drive.md](./vault-cloud-backup-google-drive.md).
  Pay particular attention to the `Authorized JavaScript origins` step and
  to the `drive.appdata` scope.

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
