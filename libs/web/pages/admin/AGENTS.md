# Admin Page Agent Guide

## Scope

Platform Admin console page library for the `/admin` shell, AdminGuard, and User directory (identity fields only).

## Do

- Keep admin chrome separate from the personal dashboard (no vault unlock UI).
- Use `PlatformAdminApi` list/get endpoints for directory data.
- Preserve the import path `@myorganizer/web-pages/admin`.
- Treat directory fields as identity metadata only.

## Do Not

- Do not nest admin under `/dashboard` or reuse dashboard sidebar/vault chrome.
- Do not call removed legacy `/user` CRUD APIs.
- Do not display, fetch, or imply Vault plaintext or YouTube operational data.
- Do not add mutation action buttons until the lifecycle UI slice lands.
