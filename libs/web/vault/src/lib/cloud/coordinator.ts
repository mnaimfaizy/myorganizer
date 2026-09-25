import {
  AuditReporter,
  AuditReporterInput,
  noopAuditReporter,
} from '../vault/auditReporter';
import { ReplayTracker } from '../vault/replayTracker';
import { VaultStorageV1 } from '../vault/localVaultStorage';
import type { VaultHandle } from '../vault/vaultHandle';
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
  UploadBackupResult,
} from './types';

/** One Escape Copy as downloaded from a provider, not yet imported. */
export interface CloudEscapeCopy {
  text: string;
  metadata: CloudBackupFileMetadata;
}

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

  canRunWithoutPrompt(): boolean {
    return this.provider.canRunWithoutPrompt();
  }

  connect(): Promise<CloudBackupConnectionState> {
    return this.provider.connect();
  }

  disconnect(): Promise<void> {
    return this.provider.disconnect();
  }

  /**
   * Export the current local vault, upload it through the provider, and
   * audit the result.
   *
   * The export's success record is held back until the provider has
   * confirmed the upload complete: an Escape Copy exists only once the
   * storage holding it has confirmed it whole (CONTEXT.md: Escape Copy), and
   * the newest `export / success` record is what the vault page reports as
   * its age. An export failure is reported at once; an upload failure reports
   * a failed record instead of the held success.
   */
  async backup(localVault: VaultStorageV1): Promise<CloudBackupResult> {
    const held: { success: AuditReporterInput | null } = { success: null };
    const exported = await exportVault({
      localVault,
      source: this.provider.id,
      auditReporter: async (input) => {
        if (input.status === 'success') {
          held.success = input;
          return;
        }
        await this.reporter(input);
      },
    });

    let upload: UploadBackupResult;
    try {
      upload = await this.provider.uploadBackup({
        text: exported.text,
        exportId: exported.envelope.exportId,
        schemaVersion: exported.envelope.schemaVersion,
      });
    } catch (error) {
      // No Escape Copy was confirmed, so the held success is dropped and
      // the failure is recorded in its place.
      await this.reporter({
        event: 'export',
        source: this.provider.id,
        status: 'failed',
        errorCode: 'cloud-upload-failed',
        schemaVersion: exported.envelope.schemaVersion,
        blobTypes: [],
        sizeBytes: exported.sizeBytes,
      });
      throw error;
    }

    if (held.success) await this.reporter(held.success);

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
  }

  /**
   * Download the newest completed Escape Copy without writing anything.
   * Resolves to `null` when the provider holds none.
   *
   * Restore is split in two so the User confirms the exact bytes that will be
   * imported (ADR 0063): fetch, show what the copy is and what it changes,
   * then hand the same copy to {@link restoreCopy}.
   */
  async fetchLatestCopy(): Promise<CloudEscapeCopy | null> {
    return await this.provider.downloadLatestBackup();
  }

  /**
   * Replace the Local Vault with a copy obtained from {@link fetchLatestCopy},
   * through the standard hardened import flow. Call only after the User has
   * confirmed the restore.
   */
  async restoreCopy(
    copy: CloudEscapeCopy,
    handle: VaultHandle,
  ): Promise<CloudRestoreResult> {
    const imported = await importVault({
      text: copy.text,
      handle,
      source: this.provider.id,
      auditReporter: this.reporter,
      replayTracker: this.replayTracker,
    });

    return { ...imported, metadata: copy.metadata };
  }
}
