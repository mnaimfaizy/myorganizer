## ADDED Requirements

### Requirement: Persist vault backup audit records

The system SHALL persist a metadata-only audit record for every vault export or import event initiated by an authenticated user. Records MUST contain only: event type (`export` or `import`), source (`local-file`, `google-drive`, or another allowlisted source), status (`success` or `failed`), optional error code, schema version, list of blob types involved, total envelope size in bytes, and creation timestamp. Records MUST NOT contain plaintext, ciphertext blobs, record counts, or any value derived from blob contents.

#### Scenario: Record successful local-file export

- **WHEN** an authenticated user completes a successful local-file export of their vault
- **THEN** the system creates a `VaultBackupRecord` with `event='export'`, `source='local-file'`, `status='success'`, `errorCode=null`, the current `schemaVersion`, the `blobTypes` included, and the envelope `sizeBytes`

#### Scenario: Record successful Google Drive backup

- **WHEN** an authenticated user completes a successful Google Drive backup of their vault
- **THEN** the system creates a `VaultBackupRecord` with `event='export'`, `source='google-drive'`, `status='success'`, `errorCode=null`, the current `schemaVersion`, the `blobTypes` included, and the envelope `sizeBytes`

#### Scenario: Record successful Google Drive restore

- **WHEN** an authenticated user completes a successful restore from Google Drive
- **THEN** the system creates a `VaultBackupRecord` with `event='import'`, `source='google-drive'`, `status='success'`, `errorCode=null`, the envelope's `schemaVersion`, the imported `blobTypes`, and the envelope `sizeBytes`

#### Scenario: Record failed cloud backup

- **WHEN** an authenticated user attempts a Google Drive backup that fails for a classified reason
- **THEN** the system creates a `VaultBackupRecord` with `event='export'`, `source='google-drive'`, `status='failed'`, and a non-null `errorCode` matching the backup error taxonomy

#### Scenario: Reject record from unauthenticated request

- **WHEN** an unauthenticated request calls `POST /api/v1/vault/backups`
- **THEN** the system responds with HTTP 401 and does not create a record.

#### Scenario: Reject record with disallowed source

- **WHEN** a request body contains a `source` value not in the allowlist
- **THEN** the system responds with HTTP 422 and does not create a record.

### Requirement: Expose latest backup record per user

The system SHALL provide an endpoint that returns the most recent `VaultBackupRecord` for the authenticated user, optionally filtered by `status` and `source`. The endpoint MUST scope strictly by the authenticated user and MUST NOT expose other users' records.

#### Scenario: Latest successful Google Drive backup exists

- **WHEN** an authenticated user requests `GET /api/v1/vault/backups/latest?status=success&source=google-drive` and at least one successful Google Drive record exists for that user
- **THEN** the system returns HTTP 200 with that record ordered by most recent `createdAt`

#### Scenario: No records match the filters

- **WHEN** an authenticated user requests `GET /api/v1/vault/backups/latest?status=success&source=google-drive` and no matching record exists for that user
- **THEN** the system returns HTTP 404

#### Scenario: Cross-user isolation

- **WHEN** user A requests `GET /api/v1/vault/backups/latest`
- **THEN** the response only ever contains records owned by user A and never exposes user B's records

### Requirement: Expose paged backup history per user

The system SHALL provide a cursor-paginated history endpoint scoped to the authenticated user. Default page size is 20; maximum page size is 100. The endpoint SHALL support an optional allowlisted `source` filter.

#### Scenario: Fetch first page of Google Drive history

- **WHEN** an authenticated user requests `GET /api/v1/vault/backups?source=google-drive`
- **THEN** the system returns HTTP 200 with up to 20 Google Drive records ordered by `createdAt` descending, plus a `nextCursor` if more records exist

#### Scenario: Reject oversize page request

- **WHEN** a request specifies `limit` greater than 100
- **THEN** the system responds with HTTP 422

#### Scenario: Reject disallowed source filter

- **WHEN** a request specifies a `source` filter outside the allowlist
- **THEN** the system responds with HTTP 422

### Requirement: Rate-limit backup record writes

The system SHALL rate-limit `POST /api/v1/vault/backups` per authenticated user to prevent audit-table flooding from repeated failed imports.

#### Scenario: Excessive write attempts

- **WHEN** an authenticated user exceeds the configured per-user rate limit on `POST /api/v1/vault/backups`
- **THEN** the system responds with HTTP 429 and does not create a record.

### Requirement: Cascade delete with user

`VaultBackupRecord` rows SHALL be deleted when the owning user account is deleted.

#### Scenario: User deletion

- **WHEN** a user account is deleted
- **THEN** all `VaultBackupRecord` rows referencing that user are removed (Prisma `onDelete: Cascade`).
