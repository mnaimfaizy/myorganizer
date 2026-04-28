export const VAULT_BACKUP_EVENTS = ['export', 'import'] as const;
export type VaultBackupEvent = (typeof VAULT_BACKUP_EVENTS)[number];

export const VAULT_BACKUP_SOURCES = ['local-file'] as const;
export type VaultBackupSource = (typeof VAULT_BACKUP_SOURCES)[number];

export const VAULT_BACKUP_STATUSES = ['success', 'failed'] as const;
export type VaultBackupStatus = (typeof VAULT_BACKUP_STATUSES)[number];

export const VAULT_BACKUP_BLOB_TYPES = [
  'addresses',
  'mobileNumbers',
  'subscriptions',
  'todos',
] as const;
export type VaultBackupBlobType = (typeof VAULT_BACKUP_BLOB_TYPES)[number];

export const VAULT_BACKUP_HISTORY_DEFAULT_LIMIT = 20;
export const VAULT_BACKUP_HISTORY_MAX_LIMIT = 100;

// Cap accepted by the audit endpoint. Mirrors VAULT_EXPORT_MAX_BYTES (10 MiB).
export const VAULT_BACKUP_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function isVaultBackupEvent(value: unknown): value is VaultBackupEvent {
  return (
    typeof value === 'string' &&
    (VAULT_BACKUP_EVENTS as readonly string[]).includes(value)
  );
}

export function isVaultBackupSource(
  value: unknown,
): value is VaultBackupSource {
  return (
    typeof value === 'string' &&
    (VAULT_BACKUP_SOURCES as readonly string[]).includes(value)
  );
}

export function isVaultBackupStatus(
  value: unknown,
): value is VaultBackupStatus {
  return (
    typeof value === 'string' &&
    (VAULT_BACKUP_STATUSES as readonly string[]).includes(value)
  );
}

export function isVaultBackupBlobType(
  value: unknown,
): value is VaultBackupBlobType {
  return (
    typeof value === 'string' &&
    (VAULT_BACKUP_BLOB_TYPES as readonly string[]).includes(value)
  );
}
