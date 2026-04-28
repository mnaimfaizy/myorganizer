## 1. Audit current export/import code paths

- [x] 1.1 Review `libs/vault-core/src/lib/{interfaces,types}.ts` and document the existing envelope shape and version constants.
- [x] 1.2 Review `libs/web-vault/src/lib/vault/vaultExportImport.ts`, `vaultMigration.ts`, and `vaultShapes.ts`; list concrete validation gaps and partial-state paths in a short note in `design.md`'s open questions if any are discovered during implementation.
- [x] 1.3 Confirm current envelope `schemaVersion` constant and the set of supported blob types (`addresses`, `mobileNumbers`, `subscriptions`, `todos`).

## 2. Backend: Prisma model and migration

- [x] 2.1 Add `VaultBackupRecord` model to `apps/backend/src/prisma/schema/vault.prisma` with fields: `id`, `userId`, `event` (String), `source` (String), `status` (String), `errorCode` (String?), `schemaVersion` (Int), `blobTypes` (String[]), `sizeBytes` (Int), `createdAt` (DateTime @default(now())), with `@@index([userId, createdAt])` and `onDelete: Cascade` from User.
- [x] 2.2 Add the inverse relation field on `User` in `apps/backend/src/prisma/schema/user.prisma`.
- [x] 2.3 Run `npx prisma migrate dev --name add_vault_backup_record` and commit the generated migration.
- [x] 2.4 Run `npx prisma generate` and verify Prisma client types compile.

## 3. Backend: TSOA endpoints

- [x] 3.1 Create `apps/backend/src/services/VaultBackupService.ts` with methods `recordEvent`, `getLatest({ userId, status? })`, and `listHistory({ userId, cursor?, limit })`.
- [x] 3.2 Create `apps/backend/src/controllers/VaultBackupController.ts` with TSOA decorators for `POST /vault/backups`, `GET /vault/backups/latest`, and `GET /vault/backups`. Apply auth middleware and Zod validation for request bodies/queries.
- [x] 3.3 Define the allowlist for `source` (`local-file`) and `event` (`export`, `import`) and `status` (`success`, `failed`) in a shared constants module under `apps/backend/src/services/`.
- [x] 3.4 Wire per-user rate limit on `POST /vault/backups` using existing rate-limit middleware.
- [x] 3.5 Add Jest integration tests `VaultBackupController.int.test.ts` covering: 201 on valid record, 401 unauth, 422 invalid source/limit, 404 latest empty, success/failed record creation, cross-user isolation, and rate-limit 429.

## 4. Backend: contract regeneration

- [x] 4.1 Run `yarn api-docs:generate` to regenerate TSOA Swagger.
- [x] 4.2 Run `yarn openapi:sync` and commit the updated spec under `libs/api-specs`.
- [x] 4.3 Run `yarn api:generate` to regenerate `libs/app-api-client`; commit regenerated client.
- [x] 4.4 Run `yarn openapi:check` and confirm clean.

## 5. Vault-core: envelope schema, errors, migration registry

- [x] 5.1 Add a Zod schema `VaultExportEnvelopeSchema` in `libs/vault-core/src/lib/` covering `schemaVersion`, `exportId` (uuid v4), `blobs` (record keyed by allowlisted blob type), and constraints (max size, non-empty).
- [x] 5.2 Add a `VaultImportError` class with discriminated `code` field (`corrupt-file`, `schema-version-unsupported`, `schema-version-downgrade`, `oversize`, `unknown-blob-type`, `decrypt-failed`, `replay-detected`, `empty-envelope`, `network-failed`).
- [x] 5.3 Add a forward-only migration registry (`migrations: Record<number, (env) => env>`) and a `migrateEnvelope(envelope, currentVersion)` helper that throws `schema-version-downgrade` when `envelope.schemaVersion > currentVersion` and `schema-version-unsupported` when no path exists.
- [x] 5.4 Export the schema, error class, and migration helper from `libs/vault-core/src/index.ts`.
- [x] 5.5 Add Jest unit tests covering: forward migration applied, unsupported version, downgrade rejection, oversize, unknown blob type, empty envelope, corrupt JSON.

## 6. Web-vault: hardened export/import

- [x] 6.1 Refactor `libs/web-vault/src/lib/vault/vaultExportImport.ts` into `exportVault()` and `importVault()` using stage-then-commit semantics (parse → validate → decrypt-and-stage → atomic local commit → server sync).
- [x] 6.2 Generate and embed a fresh `exportId` (uuid v4) on every export.
- [x] 6.3 Implement a replay tracker (last 10 imported `exportId`s) backed by IndexedDB; raise `replay-detected` on match.
- [x] 6.4 Implement an `auditReporter` that posts to `vaultBackups.record(...)` via the generated API client; failures are logged but do not propagate to the user.
- [x] 6.5 Wire export and import call sites to invoke `auditReporter` for both success and failed events with correct `event`/`status`/`errorCode`.
- [x] 6.6 Update `libs/web-vault/src/lib/vault/vaultExportImport.test.ts` with the full edge-case matrix from the spec: corrupt file, wrong schema version, downgrade, partial blob set, oversize file, replay, empty vault, decrypt failure, atomic rollback assertion.

## 7. Web-vault-ui: error message map and "Last backup" card

- [x] 7.1 Add a code-to-message map covering every `VaultImportError` code with localized, actionable text.
- [x] 7.2 Build a `LastBackupCard` component that renders `Last backup: <date> via <source>`, `No backups recorded yet`, or `Last backup: unknown`.
- [x] 7.3 Add a Storybook story for `LastBackupCard` covering all three states.
- [x] 7.4 Add unit tests for the error message map and the card.

## 8. Frontend page library: `vault-settings`

- [x] 8.1 Generate a new React page library `libs/web/pages/vault-settings` with Jest enabled and import path `@myorganizer/web-pages/vault-settings`.
- [x] 8.2 Implement the page composition: existing export/import controls + `LastBackupCard` fed by `appApiClient.vaultBackups.latest({ status: 'success' })`.
- [x] 8.3 Add or update the thin Next.js route wrapper at `apps/myorganizer/src/app/account/vault/page.tsx` to import and render the new page library.
- [x] 8.4 Add Jest tests for the page covering the three latest-record states.

## 9. End-to-end test

- [x] 9.1 Add a Playwright spec `apps/myorganizer-e2e/src/<vault>/vault-export-import.spec.ts` for the happy path: log in → export → reset vault → import → verify "Last backup: <today> via local-file" appears.
- [x] 9.2 Add a failure-path test: import a corrupt file → verify user-facing error message and that local vault state is unchanged.

## 10. Quality gates

- [x] 10.1 `yarn nx lint backend myorganizer vault-core web-vault web-vault-ui web-pages-vault-settings` passes.
- [x] 10.2 `yarn nx test backend vault-core web-vault web-vault-ui web-pages-vault-settings` passes.
- [x] 10.3 `yarn nx e2e myorganizer-e2e` passes locally.
- [x] 10.4 `yarn openapi:check` is clean.
- [x] 10.5 `yarn format:write` applied; commit using Conventional Commits (`feat:`, `test:`, etc.).

## 11. Verification checklist

- [x] 11.1 Backend builds: `yarn build:backend`.
- [x] 11.2 Frontend builds: `yarn build:myorganizer`.
- [x] 11.3 Manual smoke: log in, export vault, observe `Last backup: <date> via local-file` in vault settings; re-import the same file and observe `replay-detected` error message.
- [x] 11.4 Confirm no plaintext or ciphertext blob bodies are persisted in `VaultBackupRecord` (inspect a written row).
- [x] 11.5 Confirm Prisma migration is committed and reversible.
