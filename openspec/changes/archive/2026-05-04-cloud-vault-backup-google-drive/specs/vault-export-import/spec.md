## ADDED Requirements

### Requirement: Restore cloud-sourced backups through the existing import pipeline

The system SHALL process a cloud-downloaded vault backup through the same validation, migration, replay-detection, and atomic commit flow used for local-file imports. No cloud restore path may bypass those checks or introduce a provider-specific vault format.

#### Scenario: Successful cloud restore uses the standard import flow

- **WHEN** a user restores a completed Google Drive backup
- **THEN** the system validates the downloaded envelope, applies the normal vault migration path if needed, stages the restore in memory, and commits it atomically to local vault storage

#### Scenario: Corrupt cloud backup fails without mutating local state

- **WHEN** a downloaded Google Drive backup is corrupt, unsupported, or otherwise fails the existing import validation rules
- **THEN** the system raises the same classified import error used for local-file imports and leaves the prior local vault state unchanged
