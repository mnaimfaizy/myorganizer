import {
  RecordVaultBackupRequest,
  VaultBackupBlobType,
  VaultBackupEvent,
  VaultBackupSource,
  VaultBackupStatus,
  VaultBackupsApi,
} from '@myorganizer/app-api-client';

import { createVaultBackupsApi } from '../apiClient';

export type AuditReporterInput = {
  event: VaultBackupEvent;
  source: VaultBackupSource;
  status: VaultBackupStatus;
  errorCode?: string | null;
  schemaVersion: number;
  blobTypes: VaultBackupBlobType[];
  sizeBytes: number;
};

export type AuditReporter = (input: AuditReporterInput) => Promise<void>;

export interface CreateDefaultAuditReporterOptions {
  /**
   * When `true`, errors from `POST /vault/backups` are re-thrown so the
   * caller (typically the UI export/import handler) can react — for example
   * by aborting the download.
   *
   * Default `false` keeps the spec-default non-blocking behaviour: failures
   * are caught and logged via `console.warn`.
   */
  strict?: boolean;
}

/**
 * Default audit reporter: posts a `RecordVaultBackupRequest` to
 * `POST /vault/backups`.
 *
 * - With `strict: false` (default), failures are swallowed and logged.
 * - With `strict: true`, failures are re-thrown so the caller can block
 *   user-facing side effects (e.g. file download) until the audit succeeds.
 */
export function createDefaultAuditReporter(
  apiFactory: () => VaultBackupsApi = createVaultBackupsApi,
  options: CreateDefaultAuditReporterOptions = {},
): AuditReporter {
  const { strict = false } = options;
  return async (input) => {
    const body: RecordVaultBackupRequest = {
      event: input.event,
      source: input.source,
      status: input.status,
      errorCode: input.errorCode ?? null,
      schemaVersion: input.schemaVersion,
      blobTypes: input.blobTypes,
      sizeBytes: input.sizeBytes,
    };
    try {
      const api = apiFactory();
      await api.recordBackup({ recordVaultBackupRequest: body });
    } catch (error) {
      if (strict) {
        throw error;
      }
      console.warn('Vault audit report failed (non-blocking):', error);
    }
  };
}

/** No-op reporter for tests or callers that want to disable audit. */
export const noopAuditReporter: AuditReporter = async () => {
  // no-op
};
