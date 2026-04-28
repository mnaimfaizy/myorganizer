## Why

Vault export/import today is a "fire and forget" client-side flow with no server-side audit trail and uneven validation/error handling across `libs/web-vault` and `libs/vault-core`. Users have no way to confirm whether (and when) they last backed up their encrypted vault, and a corrupt or partially-applied import can leave the local vault in a half-restored state. Surfacing a "Last backup" indicator and tightening import atomicity reduces data-loss anxiety without weakening E2EE guarantees.

## What Changes

- Audit and harden the existing export/import code paths in `libs/web-vault` and `libs/vault-core`:
  - Strict Zod validation of the backup envelope (schema version, blob types allowlist, sizes).
  - Clear, user-actionable error messages distinct from generic crypto failures.
  - Schema-version forward-migration path; reject (and explain) downgrade attempts.
  - Atomic import: stage decrypted blobs, validate the full set, then commit; never leave a partial state.
- Add a server-side audit trail of vault backup/restore events (metadata only, no ciphertext or plaintext blobs).
- New Prisma model `VaultBackupRecord` and migration.
- New TSOA endpoints under `/api/v1/vault/backups` (POST record, GET latest, GET paged history).
- Record both successful and failed events; capture `event` (`export` | `import`), `source`, `status`, and `errorCode`.
- Frontend: surface "Last backup: <date> via <source>" in the vault settings page (new page library `libs/web/pages/vault-settings`) using the regenerated `@myorganizer/app-api-client`.
- Tests: Jest unit coverage for new service and edge cases (corrupt file, wrong schema version, partial blob set, oversize file, replay, empty vault, version downgrade); Playwright e2e for export → reset → import happy path and one failure path.

Non-goals:

- No cloud provider integration (Google Drive, etc.) — covered separately.
- No scheduled or automatic backups.
- No changes to vault crypto, KDF, or existing blob types.
- No backup history list in the UI yet (backend endpoint ships; UI deferred).

## Capabilities

### New Capabilities

- `vault-backup-audit`: Server-side metadata audit trail of vault export/import events (Prisma model, REST endpoints, validation, retention).
- `vault-export-import`: Hardened client-side vault export/import flow (envelope validation, atomic restore, schema-version migration, structured error reporting, "Last backup" UI indicator).

### Modified Capabilities

<!-- None — no existing specs/<name>/spec.md to modify. -->

## Impact

- **Backend**: New Prisma model `VaultBackupRecord` + migration; new TSOA controller/service under `apps/backend/src/controllers` and `apps/backend/src/services`; OpenAPI regeneration; updated vault router.
- **Generated API client**: `libs/app-api-client` regenerated via `yarn openapi:sync && yarn api:generate`.
- **Vault libs**: `libs/vault-core` (envelope schema, migration, atomic apply) and `libs/web-vault` (export/import orchestration, error mapping, audit-record reporting).
- **Frontend**: New `libs/web/pages/vault-settings` page library; thin route wrapper at `apps/myorganizer/src/app/account/vault/page.tsx` (or existing settings route) that renders it.
- **Tests**: New Jest specs for vault-core, web-vault, backend service; Playwright e2e covering export → reset → import.
- **E2EE invariant preserved**: Server stores only metadata (counts, sizes, blob type names, schema version, status) — never backup contents.
- **Auth**: Endpoints require authenticated session; reuse existing JWT middleware. No new auth flows.
