import { AuditReporter, noopAuditReporter } from '../vault/auditReporter';
import { ReplayTracker } from '../vault/replayTracker';
import { VaultStorageV1 } from '../vault/vault';
import {
  exportVault,
  importVault,
  ImportVaultResult,
} from '../vault/vaultExportImport';

import {
  CLOUD_BACKUP_DEFAULT_RETENTION,
  CLOUD_BACKUP_STALE_PENDING_MS,
} from './preferences';
import {
  CloudBackupConnectionState,
  CloudBackupFileMetadata,
  CloudBackupProvider,
  CloudBackupProviderId,
} from './types';

export interface CloudBackupCoordinatorOptions {
  provider: CloudBackupProvider;
  auditReporter?: AuditReporter;
  replayTracker?: ReplayTracker;
  retention?: number;
  stalePendingMs?: number;
}

export interface CloudBackupResult {
  fileId: string;
  metadata: CloudBackupFileMetadata;
  sizeBytes: number;
  exportId: string;
}

export interface CloudRestoreResult extends ImportVaultResult {
  metadata: CloudBackupFileMetadata;
}

/**
 * Orchestrates cloud backup and restore. The coordinator owns the integration
 * between the existing hardened export/import pipeline and a
 * `CloudBackupProvider` implementation. Callers (hooks/UI) only ever need
 * the coordinator and the provider; they should not call provider methods
 * directly for backup/restore flows.
 */
export class CloudBackupCoordinator {
  private readonly provider: CloudBackupProvider;
  private readonly reporter: AuditReporter;
  private readonly replayTracker?: ReplayTracker;
  private readonly retention: number;
  private readonly stalePendingMs: number;

  constructor(options: CloudBackupCoordinatorOptions) {
    this.provider = options.provider;
    this.reporter = options.auditReporter ?? noopAuditReporter;
    this.replayTracker = options.replayTracker;
    this.retention = options.retention ?? CLOUD_BACKUP_DEFAULT_RETENTION;
    this.stalePendingMs =
      options.stalePendingMs ?? CLOUD_BACKUP_STALE_PENDING_MS;
  }

  get providerId(): CloudBackupProviderId {
    return this.provider.id;
  }

  getConnectionState(): Promise<CloudBackupConnectionState> {
    return this.provider.getConnectionState();
  }

  connect(): Promise<CloudBackupConnectionState> {
    return this.provider.connect();
  }

  disconnect(): Promise<void> {
    return this.provider.disconnect();
  }

  /**
   * Export the current local vault, upload it through the provider, and
   * audit the result. The export step always reports its own audit record;
   * the upload step reports a provider-scoped audit record only on failure
   * because the export's success record already reflects the cloud source.
   */
  async backup(localVault: VaultStorageV1): Promise<CloudBackupResult> {
    const exported = await exportVault({
      localVault,
      source: 'google-drive',
      auditReporter: this.reporter,
    });

    try {
      const upload = await this.provider.uploadBackup({
        text: exported.text,
        exportId: exported.envelope.exportId,
        schemaVersion: exported.envelope.schemaVersion,
      });

      // Best-effort retention pruning. Failures here MUST NOT fail the
      // backup itself but should not be silently lost either.
      try {
        await this.provider.pruneBackups({
          keepCount: this.retention,
          stalePendingMs: this.stalePendingMs,
        });
      } catch (error) {
        console.warn('Cloud backup retention prune failed:', error);
      }

      return {
        fileId: upload.fileId,
        metadata: upload.metadata,
        sizeBytes: exported.sizeBytes,
        exportId: exported.envelope.exportId,
      };
    } catch (error) {
      // Upload failed AFTER a successful local export. Report a failed
      // export audit record for the provider-source so the latest
      // `source=google-drive` query reflects the failure.
      await this.reporter({
        event: 'export',
        source: 'google-drive',
        status: 'failed',
        errorCode: 'cloud-upload-failed',
        schemaVersion: exported.envelope.schemaVersion,
        blobTypes: [],
        sizeBytes: exported.sizeBytes,
      });
      throw error;
    }
  }

  /**
   * Download the latest completed cloud backup and pipe it through the
   * standard hardened import flow. Resolves to `null` when no completed
   * backup is available on the provider.
   */
  async restoreLatest(): Promise<CloudRestoreResult | null> {
    const downloaded = await this.provider.downloadLatestBackup();
    if (!downloaded) return null;

    const imported = await importVault({
      text: downloaded.text,
      source: 'google-drive',
      auditReporter: this.reporter,
      replayTracker: this.replayTracker,
    });

    return { ...imported, metadata: downloaded.metadata };
  }
}
