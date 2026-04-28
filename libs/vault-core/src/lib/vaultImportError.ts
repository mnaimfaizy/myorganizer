export const VAULT_IMPORT_ERROR_CODES = [
  'corrupt-file',
  'schema-version-unsupported',
  'schema-version-downgrade',
  'oversize',
  'unknown-blob-type',
  'decrypt-failed',
  'replay-detected',
  'empty-envelope',
  'network-failed',
] as const;

export type VaultImportErrorCode = (typeof VAULT_IMPORT_ERROR_CODES)[number];

export class VaultImportError extends Error {
  public readonly code: VaultImportErrorCode;
  public readonly details?: unknown;

  constructor(code: VaultImportErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'VaultImportError';
    this.code = code;
    this.details = details;
    // Preserve prototype chain for instanceof checks across module boundaries.
    Object.setPrototypeOf(this, VaultImportError.prototype);
  }
}

export function isVaultImportError(value: unknown): value is VaultImportError {
  return value instanceof VaultImportError;
}
