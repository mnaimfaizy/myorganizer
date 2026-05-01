/**
 * Cloud backup provider abstraction.
 *
 * Providers handle off-device storage of encrypted vault export bundles.
 * Plaintext and decrypted vault material MUST stay in the browser; providers
 * receive only the JSON-serialized export envelope text produced by
 * `exportVault({ source: '<provider>' })`.
 */

export type CloudBackupProviderId = 'google-drive';

export type CloudBackupConnectionState =
  | { status: 'disconnected' }
  | { status: 'connected'; account?: { email?: string; displayName?: string } }
  | { status: 'needs-reconnect'; reason?: string };

export type CloudBackupAutoInterval = 'off' | 'daily' | 'weekly' | 'monthly';

export interface CloudBackupFileMetadata {
  /** Provider-native file id. */
  id: string;
  /** Human-readable name including timestamp + exportId. */
  name: string;
  /** ISO timestamp from the provider for created/modified time. */
  createdAt: string;
  /** Logical export id stored in app properties. */
  exportId: string;
  /** Schema version reported by the export envelope. */
  schemaVersion: number;
  /** Status flag stored in app properties. */
  status: 'pending' | 'complete';
  /** File size in bytes. */
  sizeBytes: number;
}

export interface UploadBackupInput {
  /** Pretty-printed JSON envelope text to upload. */
  text: string;
  /** Logical export id to embed in metadata. */
  exportId: string;
  /** Schema version to embed in metadata. */
  schemaVersion: number;
}

export interface UploadBackupResult {
  fileId: string;
  /** Final committed metadata (status='complete'). */
  metadata: CloudBackupFileMetadata;
}

export interface CloudBackupProvider {
  readonly id: CloudBackupProviderId;

  /** Returns the current local connection state for this provider. */
  getConnectionState(): Promise<CloudBackupConnectionState>;

  /**
   * Initiate user-driven connect flow. MUST only be called from a user
   * gesture so popup blockers do not interfere. Resolves to the new state.
   */
  connect(): Promise<CloudBackupConnectionState>;

  /**
   * Disconnect the provider. SHOULD attempt to revoke remote tokens but
   * MUST always clear local provider state.
   */
  disconnect(): Promise<void>;

  /**
   * Upload an encrypted backup blob, finalizing only after upload succeeds.
   * Implementations MUST upload as `pending`, then transition to `complete`.
   */
  uploadBackup(input: UploadBackupInput): Promise<UploadBackupResult>;

  /**
   * Download the latest completed backup as text. Returns `null` when no
   * completed backup is available.
   */
  downloadLatestBackup(): Promise<{
    text: string;
    metadata: CloudBackupFileMetadata;
  } | null>;

  /**
   * Apply retention pruning: delete oldest completed backups beyond
   * `keepCount` and clean up stale pending files older than
   * `stalePendingMs`.
   */
  pruneBackups(options: {
    keepCount: number;
    stalePendingMs: number;
  }): Promise<{ deletedCompleted: number; deletedPending: number }>;
}
