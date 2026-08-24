# Account Page Agent Guide

## Scope

Dashboard account settings page for preferred country and currency. Also owns the
cross-source `useLatestBackup` hook and renders the last-backup summary card, since
this page is its only consumer — the consolidated vault page (`/dashboard/vault`)
deliberately does not render it.

## Do

- Keep preferences non-sensitive and usable by vault-backed views.
- Preserve the import path `@myorganizer/web-pages/account`.
- Link to `/dashboard/vault` for export, import, and cloud backup — this page does
  not duplicate those cards.

## Do Not

- Do not store these display preferences inside encrypted vault blobs unless product requirements change.
