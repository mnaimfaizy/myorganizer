# Admin Page Agent Guide

## Scope

Platform Admin console page library for the `/admin` shell, AdminGuard, User directory/detail (identity fields + lifecycle actions), and Admin Audit Log browse UI.

## Do

- Keep admin chrome separate from the personal dashboard (no vault unlock UI).
- Use `PlatformAdminApi` for directory, lifecycle mutations, and audit log list endpoints.
- Preserve the import path `@myorganizer/web-pages/admin`.
- Treat directory and audit fields as identity/audit metadata only.
- Surface lifecycle API success and error feedback (including last-admin rejection on demote).

## Do Not

- Do not nest admin under `/dashboard` or reuse dashboard sidebar/vault chrome.
- Do not call removed legacy `/user` CRUD APIs.
- Do not display, fetch, or imply Vault plaintext or YouTube operational data.
- Do not add impersonation or admin-set password flows.
