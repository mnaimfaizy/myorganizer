## Context

MyOrganizer's vault is end-to-end encrypted: master key is derived client-side from the user passphrase (or recovery code), blobs are encrypted in the browser, and the server (`EncryptedVault` + `EncryptedVaultBlob` Prisma models) only stores ciphertext keyed by user + blob type. Existing export/import logic lives in [libs/web-vault/src/lib/vault/vaultExportImport.ts](libs/web-vault/src/lib/vault/vaultExportImport.ts) with companion shapes/migration helpers in `vaultShapes.ts` and `vaultMigration.ts`. The current flow:

- Export serializes the decrypted vault into a JSON envelope and triggers a file download.
- Import reads a file, validates loosely, decrypts/re-encrypts, and writes blob-by-blob to local IndexedDB and then to the server via the existing vault sync endpoints.

Pain points observed during the audit phase of this change:

1. Validation is partial — schema version is read but not enforced against an allowlist; oversize files and unknown blob types pass through.
2. Errors collapse into generic "import failed" messages, hiding actionable causes (downgrade attempt, corrupt JSON, unsupported version, partial blob set).
3. Import is not atomic: a mid-flight failure can leave some blob types restored and others stale.
4. There is no audit signal anywhere — the user cannot answer "when did I last back up?".

Constraints:

- Server stores ciphertext metadata only. The new audit table must hold no plaintext, no ciphertext blobs, and no values that could fingerprint plaintext content (e.g., raw record counts are acceptable; per-record sizes are not exposed).
- Reuse the generated `@myorganizer/app-api-client`; no hand-rolled fetch.
- Frontend pages must follow the thin-wrapper + page-library pattern; `apps/myorganizer/src/app/**` stays minimal.

Stakeholders: vault end users (data integrity, peace of mind), support (diagnose import failures via `errorCode`), security review (E2EE invariant must hold).

## Goals / Non-Goals

**Goals:**

- Eliminate silent partial imports through a stage-then-commit transaction in the client vault.
- Provide explicit, classified error codes for export/import failures (corrupt-file, schema-version-unsupported, schema-version-downgrade, oversize, unknown-blob-type, decrypt-failed, replay-detected, empty-envelope).
- Persist a per-user audit log of vault backup/restore events so the UI can show "Last backup: <date> via <source>".
- Ship new TSOA endpoints under `/api/v1/vault/backups` and regenerate the API client.
- Add Jest coverage for all listed edge cases and a Playwright happy-path + failure-path e2e.

**Non-Goals:**

- No cloud-storage providers (Google Drive, Dropbox, etc.).
- No automatic/scheduled backups or background uploads.
- No changes to vault crypto, KDF, master-key wrapping, or blob types.
- No backup history list in the UI in this change (the GET-history endpoint ships, UI list deferred).
- No PII in audit metadata beyond the authenticated user's own ID.

## Decisions

### D1. Audit data model: one row per event, metadata only

`VaultBackupRecord` is **append-only** with these fields:

- `id` (cuid), `userId` (FK → User, cascade delete), `event` (`'export' | 'import'`), `source` (`'local-file' | 'google-drive'` — extensible string with allowlist validation), `status` (`'success' | 'failed'`), `errorCode` (nullable string), `schemaVersion` (Int), `blobTypes` (String[] — Postgres native array), `sizeBytes` (Int), `createdAt` (DateTime).

Alternatives considered:

- _One row per user with `lastBackupAt` upserts._ Rejected: loses history and replay/audit utility, and adding history later forces a second migration.
- _Storing free-form JSON instead of typed columns._ Rejected: harms queryability for "latest" and breaks Zod/TSOA typing.

### D2. Failed events are recorded too

Both successful and failed backup/restore events are written. Failed rows carry `status='failed'` and a non-null `errorCode` matching the new client error taxonomy (D5). This makes it possible to surface "Last successful backup" distinct from raw "Last attempt", and helps support triage. The "latest" endpoint accepts an optional `?status=success` filter; the UI uses `status=success` for the indicator.

### D3. New TSOA endpoints (auth-required)

Under `/api/v1/vault/backups`, owned by a new `VaultBackupController`:

- `POST   /api/v1/vault/backups` → body validated by Zod (`event`, `source`, `status`, `errorCode?`, `schemaVersion`, `blobTypes[]`, `sizeBytes`). Returns 201 with the created record.
- `GET    /api/v1/vault/backups/latest?status=success` → latest record for the authenticated user, optionally filtered by status. 404 if none.
- `GET    /api/v1/vault/backups?cursor=&limit=` → cursor-paginated history (default limit 20, max 100).

All endpoints scope by `req.user.id`; cross-user reads are impossible. Skill: `backend-api-contract-change`.

### D4. Atomic client-side import via stage-then-commit

`vaultExportImport.importVault()` is restructured into three phases:

1. **Parse & validate envelope** — Zod schema (`VaultExportEnvelopeV<N>`) validates structure, schema version, blob-type allowlist, and `sizeBytes` upper bound (e.g., 10 MiB).
2. **Decrypt-and-stage** — all blobs are decrypted into an in-memory `StagedVault` map. Any failure aborts before any persistence.
3. **Commit** — once staging is complete and validated, blobs are written to the local store inside a single IndexedDB transaction, then synced to the server. If the server sync fails after local commit, the local state is still consistent (the import is considered successful locally; sync retries are handled by existing `serverVaultSync`).

Alternative considered: per-blob streaming commit. Rejected — exactly the partial-state bug we are fixing.

### D5. Error taxonomy and classified `VaultImportError`

A new `VaultImportError` class in `libs/vault-core` with discriminated `code` field:

- `corrupt-file`, `schema-version-unsupported`, `schema-version-downgrade`, `oversize`, `unknown-blob-type`, `decrypt-failed`, `replay-detected`, `empty-envelope`, `network-failed`.

Each code maps to a localized user-facing message in `libs/web-vault-ui` and is forwarded to the audit endpoint as `errorCode`.

### D6. Schema-version migration & downgrade rejection

`vaultMigration.ts` gains a `migrate(envelope, fromVersion, toVersion)` function with an explicit version registry. Only forward migrations are registered. A downgrade (envelope version > current code version) is rejected with `schema-version-downgrade` rather than silently dropping fields.

### D7. Replay detection

Each export embeds a random `exportId` (uuid v4) in the envelope. The client tracks the last 10 imported `exportId`s in IndexedDB. Re-importing the same envelope returns `replay-detected` (still recorded as a failed import event for visibility).

### D8. Frontend page placement

Add a new page library `libs/web/pages/vault-settings/` (path alias `@myorganizer/web-pages/vault-settings`). The thin route wrapper at `apps/myorganizer/src/app/account/vault/page.tsx` (or, if `account/vault` already exists, the existing wrapper) re-exports it. The "Last backup" card calls `appApiClient.vaultBackups.latest({ status: 'success' })` server-action-side or in a client component depending on the existing page pattern. Skill: `frontend-page-library-workflow`.

### D9. Generated client regeneration

After backend changes, run `yarn openapi:sync && yarn api:generate`. CI's `yarn openapi:check` is the gate. Skill: `backend-api-contract-change`.

### D10. Touched Nx libs/apps

- `apps/backend` — Prisma schema, migration, controller, service, route registration, integration test.
- `libs/api-specs` and `libs/app-api-client` — regenerated outputs.
- `libs/vault-core` — envelope Zod schema, `VaultImportError`, migration registry.
- `libs/web-vault` — refactored `vaultExportImport.ts`, replay tracker, audit reporter.
- `libs/web-vault-ui` — error message map, "Last backup" card component.
- `libs/web/pages/vault-settings` — new page library.
- `apps/myorganizer/src/app/...` — thin wrapper.
- `apps/myorganizer-e2e` — new Playwright spec.

## Risks / Trade-offs

- **Risk:** Audit metadata leaks information about plaintext (e.g., per-blob counts).
  **Mitigation:** Persist only `blobTypes` (the well-known string set), `sizeBytes` (envelope size, already observable to a passive network attacker), and `schemaVersion`. No record counts, no decrypted lengths, no titles.
- **Risk:** Atomic commit increases peak memory for very large vaults.
  **Mitigation:** Enforce envelope `sizeBytes` cap (10 MiB default, configurable). Document the cap in the error message for `oversize`.
- **Risk:** Replay window of 10 IDs is too small / too large.
  **Mitigation:** Configurable; default 10 covers ordinary user behavior. Tracked client-side only — server cannot enforce replay without seeing plaintext envelopes.
- **Risk:** Failed events flooding the audit table (e.g., user repeatedly drops a corrupt file).
  **Mitigation:** Rate-limit `POST /vault/backups` per user (existing `express-rate-limit` middleware extended) and add a Prisma `@@index([userId, createdAt])` for fast pagination.
- **Risk:** Migration regenerated client changes break consumers.
  **Mitigation:** Run `yarn openapi:check` in CI; consumers should derive types from method return types rather than versioned aliases (existing repo guidance).

## Migration Plan

1. Land Prisma schema change + migration `add_vault_backup_record` (additive; no backfill needed — historical events are simply unknown and the UI shows "No backups recorded yet").
2. Land backend controller/service/route + integration tests.
3. Run `yarn openapi:sync && yarn api:generate`; commit regenerated client.
4. Land `libs/vault-core` and `libs/web-vault` refactors with full unit coverage; old export files remain importable (envelope versions covered by migration registry).
5. Land `libs/web/pages/vault-settings` and the route wrapper.
6. Land Playwright e2e covering happy + one failure path.
7. Deploy backend before frontend so the audit endpoint is live when the UI calls it. Frontend gracefully degrades to "Last backup: unknown" if `latest` returns 404 or the endpoint is unavailable (caught and logged via Winston-equivalent client logger; not surfaced as an error).

Rollback: revert frontend first, then backend. Prisma rollback is `prisma migrate resolve` + a reverse migration that drops `VaultBackupRecord` (data loss is acceptable — it is metadata only).

## Open Questions

- None blocking. Future work: surfacing the paged history list in the UI, and adding per-event signing so a user could verify "this was me" cross-device.
