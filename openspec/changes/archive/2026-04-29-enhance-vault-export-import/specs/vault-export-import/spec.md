## ADDED Requirements

### Requirement: Validate vault export envelope on import

The system SHALL strictly validate every incoming vault export envelope before any decryption or persistence. Validation MUST cover JSON well-formedness, envelope schema version, blob type allowlist, and a maximum envelope size. Validation failures MUST raise a classified `VaultImportError` with a specific `code` and MUST NOT mutate any local or remote state.

#### Scenario: Reject corrupt JSON file

- **WHEN** the user selects a file that is not valid JSON
- **THEN** the import fails with `VaultImportError` code `corrupt-file` and no local or server state changes.

#### Scenario: Reject unsupported schema version

- **WHEN** the envelope `schemaVersion` is older than the minimum supported version and no migration path exists
- **THEN** the import fails with code `schema-version-unsupported`.

#### Scenario: Reject downgrade attempt

- **WHEN** the envelope `schemaVersion` is greater than the current code's supported version
- **THEN** the import fails with code `schema-version-downgrade`.

#### Scenario: Reject unknown blob type

- **WHEN** the envelope contains a blob type not in the current allowlist (`addresses`, `mobileNumbers`, `subscriptions`, `todos`)
- **THEN** the import fails with code `unknown-blob-type`.

#### Scenario: Reject oversize envelope

- **WHEN** the envelope size exceeds the configured maximum (default 10 MiB)
- **THEN** the import fails with code `oversize`.

#### Scenario: Reject empty envelope

- **WHEN** the envelope contains no blobs of any allowed type
- **THEN** the import fails with code `empty-envelope`.

### Requirement: Atomic import via stage-then-commit

The system SHALL import a vault envelope atomically with respect to the local vault store: all blobs are first decrypted into an in-memory staging area; only after every blob is staged successfully is the local store updated, and that update MUST occur in a single transaction. A failure in staging MUST leave the prior local vault state intact.

#### Scenario: Decrypt failure mid-import

- **WHEN** decryption fails for any blob during staging
- **THEN** no blob is written to the local store, the prior local vault remains intact, and the import fails with code `decrypt-failed`.

#### Scenario: Successful atomic commit

- **WHEN** all blobs decrypt and stage successfully
- **THEN** the local store is updated in a single transaction and the prior state is fully replaced by the imported state.

### Requirement: Forward-only schema migration on import

The system SHALL provide a migration registry that transforms older envelope versions into the current envelope shape on import. Migrations MUST be forward-only; downgrades MUST NOT be performed silently.

#### Scenario: Forward migration applied

- **WHEN** an envelope with an older but supported `schemaVersion` is imported
- **THEN** the registered migrations are applied in order to bring the envelope to the current version, then the import proceeds normally.

#### Scenario: No registered migration path

- **WHEN** an envelope has a `schemaVersion` for which no forward migration path is registered
- **THEN** the import fails with code `schema-version-unsupported`.

### Requirement: Replay detection on import

The system SHALL detect repeated imports of the same exported envelope by tracking the last N (default 10) imported `exportId` values per device. A replay MUST be reported and recorded as a failed import event.

#### Scenario: Detect replayed envelope

- **WHEN** the user imports an envelope whose `exportId` matches one already in the device's recent-import list
- **THEN** the import fails with code `replay-detected` and a failed audit record is reported.

### Requirement: Classified import errors and user-actionable messages

The system SHALL expose a `VaultImportError` class with a discriminated `code` field. The frontend SHALL map every code to a user-facing, localizable message that explains the cause and suggested next step.

#### Scenario: User sees actionable message

- **WHEN** an import fails with a classified `VaultImportError`
- **THEN** the UI displays a message specific to the `code` (not a generic "import failed") and offers an appropriate next action where applicable.

### Requirement: Report backup events to audit endpoint

The system SHALL report every export and import attempt — whether successful or failed — to the `POST /api/v1/vault/backups` endpoint with the appropriate `event`, `source`, `status`, optional `errorCode`, `schemaVersion`, `blobTypes`, and `sizeBytes`. Reporting failures MUST NOT block the user-visible result of the export or import operation.

#### Scenario: Successful export reports audit record

- **WHEN** the user completes a successful export
- **THEN** the client posts a `success`/`export` audit record before resolving the export action to the UI.

#### Scenario: Failed import reports audit record

- **WHEN** an import fails with a classified error
- **THEN** the client posts a `failed`/`import` audit record carrying the `errorCode`.

#### Scenario: Audit reporting failure does not block UX

- **WHEN** the audit endpoint is unreachable or returns an error
- **THEN** the underlying export or import result is unaffected and the audit failure is logged client-side without surfacing to the user as an export/import error.

### Requirement: Surface "Last backup" in vault settings

The frontend SHALL display the most recent successful backup in the vault settings page using `GET /api/v1/vault/backups/latest?status=success`. The display MUST include the timestamp and the source.

#### Scenario: User has prior successful backup

- **WHEN** the user opens vault settings and the latest endpoint returns a successful record
- **THEN** the UI shows "Last backup: <localized date> via <source>".

#### Scenario: User has no backups yet

- **WHEN** the latest endpoint returns 404
- **THEN** the UI shows "No backups recorded yet" without raising an error to the user.

#### Scenario: Latest endpoint unavailable

- **WHEN** the latest endpoint is unreachable
- **THEN** the UI gracefully shows "Last backup: unknown" and logs the failure client-side.
