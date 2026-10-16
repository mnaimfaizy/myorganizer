# Account Page Agent Guide

## Scope

Dashboard account settings page for preferred country and currency. Also owns the
cross-source `useLatestBackup` hook and renders the last-backup summary card, since
this page is its only consumer — the consolidated vault page (`/dashboard/vault`)
deliberately does not render it. Also hosts User Deletion (Escape Copy offered first
via `@myorganiser/web-vault-ui`'s `useExportVault`) and the public `/account-deleted`
confirmation page.

## Do

- Keep preferences non-sensitive and usable by vault-backed views.
- Preserve the import path `@myorganiser/web-pages/account`.
- Link to `/dashboard/vault` for export, import, and cloud backup — this page does
  not duplicate those cards. The one exception is the Escape Copy that User
  Deletion offers before it deletes, through `useExportVault` from
  `@myorganiser/web-vault-ui`, not a copy of the export card.

## Do Not

- Do not store these display preferences inside encrypted vault blobs unless product requirements change.
