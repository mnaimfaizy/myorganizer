import {
  EncryptedBlobV1,
  VaultBlobType,
  VaultExportV1,
  VaultMetaV1,
} from '@myorganizer/app-api-client';
import {
  CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
  isVaultImportError,
  migrateEnvelope,
  parseVaultExportEnvelope,
  VAULT_EXPORT_MAX_BYTES as VAULT_CORE_EXPORT_MAX_BYTES,
  VAULT_EXPORT_BLOB_TYPES,
  VaultExportEnvelope,
  VaultImportError,
} from '@myorganizer/vault-core';

import { AuditReporter, noopAuditReporter } from './auditReporter';
import { ReplayTracker } from './replayTracker';
import { saveVault, VaultStorageV1 } from './vault';
import {
  localToServerMeta,
  normalizeEncryptedBlobV1,
  serverMetaToLocalVault,
  toEncryptedBlobV1,
} from './vaultShapes';

export const VAULT_EXPORT_MAX_BYTES = 1024 * 1024;

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

function byteLengthUtf8(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return Buffer.byteLength(text, 'utf8');
}

function decodeBase64Strict(value: string): Uint8Array | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value.length % 4 !== 0) return null;
  if (!BASE64_RE.test(value)) return null;

  try {
    if (typeof atob === 'function') {
      const bin = atob(value);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      const normalized = btoa(String.fromCharCode(...bytes)).replace(/=+$/, '');
      const normalizedInput = value.replace(/=+$/, '');
      if (normalized !== normalizedInput) return null;
      return bytes;
    }

    const decoded = Buffer.from(value, 'base64');
    const normalizedOutput = decoded.toString('base64').replace(/=+$/, '');
    const normalizedInput = value.replace(/=+$/, '');
    if (normalizedOutput !== normalizedInput) return null;
    return new Uint8Array(decoded);
  } catch {
    return null;
  }
}

function isBase64String(value: string): boolean {
  return decodeBase64Strict(value) !== null;
}

function requireEncryptedBlob(value: unknown, label: string): EncryptedBlobV1 {
  const normalized = normalizeEncryptedBlobV1(value);
  if (!normalized) {
    throw new Error(`${label} must include version, iv, and ciphertext`);
  }

  const ivBytes = decodeBase64Strict(normalized.iv);
  if (!ivBytes || ivBytes.byteLength < 12 || ivBytes.byteLength > 24) {
    throw new Error(`${label}.iv must be base64 (12-24 bytes)`);
  }

  if (!isBase64String(normalized.ciphertext)) {
    throw new Error(`${label}.ciphertext must be base64`);
  }

  return normalized;
}

function requireMeta(value: unknown): VaultMetaV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('meta must be an object');
  }

  const meta = value as VaultMetaV1;
  if (typeof meta.version !== 'number')
    throw new Error('meta.version must be a number');
  if (typeof meta.kdf_name !== 'string')
    throw new Error('meta.kdf_name must be a string');
  if (typeof meta.kdf_salt !== 'string')
    throw new Error('meta.kdf_salt must be a string');
  if (!isBase64String(meta.kdf_salt))
    throw new Error('meta.kdf_salt must be base64');
  if (!meta.kdf_params || typeof meta.kdf_params !== 'object') {
    throw new Error('meta.kdf_params must be an object');
  }

  const passphrase = requireEncryptedBlob(
    meta.wrapped_mk_passphrase,
    'meta.wrapped_mk_passphrase',
  );
  const recovery = requireEncryptedBlob(
    meta.wrapped_mk_recovery,
    'meta.wrapped_mk_recovery',
  );

  const rawKdfParams = meta.kdf_params as Record<string, unknown>;
  const kdfParams: { hash?: string; iterations?: number } = {};

  const hash = rawKdfParams.hash;
  if (hash !== undefined) {
    if (typeof hash !== 'string') {
      throw new Error('meta.kdf_params.hash must be a string when provided');
    }
    kdfParams.hash = hash;
  }

  const iterations = rawKdfParams.iterations;
  if (iterations !== undefined && typeof iterations !== 'number') {
    throw new Error(
      'meta.kdf_params.iterations must be a number when provided',
    );
  }
  if (iterations !== undefined) {
    kdfParams.iterations = iterations;
  }

  return {
    version: meta.version,
    kdf_name: meta.kdf_name,
    kdf_salt: meta.kdf_salt,
    kdf_params: kdfParams,
    wrapped_mk_passphrase: passphrase,
    wrapped_mk_recovery: recovery,
  };
}

function requireBlobs(
  value: unknown,
): Partial<Record<VaultBlobType, EncryptedBlobV1>> {
  if (value === undefined) return {};
  if (value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('blobs must be an object when provided');
  }

  const blobs: Partial<Record<VaultBlobType, EncryptedBlobV1>> = {};
  const record = value as Record<string, unknown>;
  for (const [key, candidate] of Object.entries(record)) {
    if (
      key === VaultBlobType.Addresses ||
      key === VaultBlobType.MobileNumbers ||
      key === VaultBlobType.Subscriptions ||
      key === VaultBlobType.Todos
    ) {
      blobs[key] = requireEncryptedBlob(candidate, `blobs.${key}`);
    } else {
      console.warn(`Unknown blob type key in export bundle: ${key}`);
    }
  }
  return blobs;
}

export function validateVaultExportBundle(raw: unknown): VaultExportV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Export bundle must be an object');
  }

  const bundle = raw as VaultExportV1;
  if (bundle.exportVersion !== 1) {
    throw new Error('Unsupported exportVersion');
  }

  if (typeof bundle.exportedAt !== 'string') {
    throw new Error('exportedAt must be a string');
  }

  const meta = requireMeta(bundle.meta);
  const blobs = requireBlobs(bundle.blobs);

  return {
    exportVersion: 1,
    exportedAt: bundle.exportedAt,
    meta,
    blobs,
  };
}

export function validateVaultExportBundleFromText(text: string): VaultExportV1 {
  if (byteLengthUtf8(text) > VAULT_EXPORT_MAX_BYTES) {
    throw new Error('Bundle is too large to import');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON: ${message}`);
  }

  return validateVaultExportBundle(parsed);
}

export function buildLocalExportBundle(options: {
  localVault: VaultStorageV1;
  exportedAt?: string;
}): VaultExportV1 {
  const { localVault, exportedAt } = options;
  return {
    exportVersion: 1,
    exportedAt: exportedAt ?? new Date().toISOString(),
    meta: localToServerMeta(localVault),
    blobs: {
      ...(localVault.data.addresses
        ? {
            [VaultBlobType.Addresses]: toEncryptedBlobV1(
              localVault.data.addresses,
            ),
          }
        : {}),
      ...(localVault.data.mobileNumbers
        ? {
            [VaultBlobType.MobileNumbers]: toEncryptedBlobV1(
              localVault.data.mobileNumbers,
            ),
          }
        : {}),
      ...(localVault.data.subscriptions
        ? {
            [VaultBlobType.Subscriptions]: toEncryptedBlobV1(
              localVault.data.subscriptions,
            ),
          }
        : {}),
      ...(localVault.data.todos
        ? {
            [VaultBlobType.Todos]: toEncryptedBlobV1(localVault.data.todos),
          }
        : {}),
    },
  };
}

export function bundleToLocalVault(bundle: VaultExportV1): VaultStorageV1 {
  const blobs: Partial<Record<VaultBlobType, EncryptedBlobV1 | null>> = {
    [VaultBlobType.Addresses]: bundle.blobs.addresses ?? null,
    [VaultBlobType.MobileNumbers]: bundle.blobs.mobileNumbers ?? null,
    [VaultBlobType.Subscriptions]: bundle.blobs.subscriptions ?? null,
    [VaultBlobType.Todos]: (bundle.blobs as any).todos ?? null,
  };

  return serverMetaToLocalVault({ meta: bundle.meta, blobs });
}

// ---------------------------------------------------------------------------
// Hardened export / import (stage-then-commit + audit + replay tracking).
// ---------------------------------------------------------------------------

export const VAULT_CURRENT_SCHEMA_VERSION = CURRENT_VAULT_EXPORT_SCHEMA_VERSION;

function generateExportId(): string {
  const cryptoApi: { randomUUID?: () => string } | undefined =
    typeof globalThis !== 'undefined'
      ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  // RFC4122-compliant v4 fallback for environments without crypto.randomUUID.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

function envelopeBlobTypes(envelope: VaultExportEnvelope): VaultBlobType[] {
  const out: VaultBlobType[] = [];
  if (envelope.blobs.addresses) out.push(VaultBlobType.Addresses);
  if (envelope.blobs.mobileNumbers) out.push(VaultBlobType.MobileNumbers);
  if (envelope.blobs.subscriptions) out.push(VaultBlobType.Subscriptions);
  if (envelope.blobs.todos) out.push(VaultBlobType.Todos);
  return out;
}

function envelopeFromLocalVault(
  localVault: VaultStorageV1,
  options: { exportedAt?: string; exportId?: string } = {},
): VaultExportEnvelope {
  const blobs: VaultExportEnvelope['blobs'] = {};
  if (localVault.data.addresses) {
    blobs.addresses = toEncryptedBlobV1(localVault.data.addresses);
  }
  if (localVault.data.mobileNumbers) {
    blobs.mobileNumbers = toEncryptedBlobV1(localVault.data.mobileNumbers);
  }
  if (localVault.data.subscriptions) {
    blobs.subscriptions = toEncryptedBlobV1(localVault.data.subscriptions);
  }
  if (localVault.data.todos) {
    blobs.todos = toEncryptedBlobV1(localVault.data.todos);
  }

  return {
    schemaVersion: CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
    exportId: options.exportId ?? generateExportId(),
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    meta: localToServerMeta(localVault),
    blobs,
  };
}

function envelopeToLocalVault(envelope: VaultExportEnvelope): VaultStorageV1 {
  const blobs: Partial<Record<VaultBlobType, EncryptedBlobV1 | null>> = {
    [VaultBlobType.Addresses]: envelope.blobs.addresses
      ? normalizeEncryptedBlobV1(envelope.blobs.addresses)
      : null,
    [VaultBlobType.MobileNumbers]: envelope.blobs.mobileNumbers
      ? normalizeEncryptedBlobV1(envelope.blobs.mobileNumbers)
      : null,
    [VaultBlobType.Subscriptions]: envelope.blobs.subscriptions
      ? normalizeEncryptedBlobV1(envelope.blobs.subscriptions)
      : null,
    [VaultBlobType.Todos]: envelope.blobs.todos
      ? normalizeEncryptedBlobV1(envelope.blobs.todos)
      : null,
  };
  return serverMetaToLocalVault({
    meta: envelope.meta as VaultMetaV1,
    blobs,
  });
}

function envelopeBlobTypesAsBackup(
  envelope: VaultExportEnvelope,
): ('addresses' | 'mobileNumbers' | 'subscriptions' | 'todos')[] {
  return envelopeBlobTypes(envelope) as (
    | 'addresses'
    | 'mobileNumbers'
    | 'subscriptions'
    | 'todos'
  )[];
}

export interface ExportVaultOptions {
  localVault: VaultStorageV1;
  source?: 'local-file';
  auditReporter?: AuditReporter;
  exportedAt?: string;
  exportId?: string;
}

export interface ExportVaultResult {
  envelope: VaultExportEnvelope;
  /** Pretty-printed JSON text suitable for download. */
  text: string;
  /** Size of `text` in UTF-8 bytes. */
  sizeBytes: number;
}

/**
 * Build and serialize a hardened vault export envelope and report a
 * `success` audit record. On any failure prior to serialization, a `failed`
 * audit record is emitted and the original error is re-thrown.
 *
 * Audit reporting is non-blocking: failures inside the audit reporter are
 * caught and logged by the reporter itself.
 */
export async function exportVault(
  options: ExportVaultOptions,
): Promise<ExportVaultResult> {
  const reporter = options.auditReporter ?? noopAuditReporter;
  const source = options.source ?? 'local-file';

  let envelope: VaultExportEnvelope;
  try {
    envelope = envelopeFromLocalVault(options.localVault, {
      exportedAt: options.exportedAt,
      exportId: options.exportId,
    });

    if (envelopeBlobTypes(envelope).length === 0) {
      throw new VaultImportError(
        'empty-envelope',
        'Local vault has no blobs to export',
      );
    }
  } catch (error) {
    await reporter({
      event: 'export',
      source,
      status: 'failed',
      errorCode: isVaultImportError(error) ? error.code : 'corrupt-file',
      schemaVersion: CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
      blobTypes: [],
      sizeBytes: 0,
    });
    throw error;
  }

  const text = JSON.stringify(envelope, null, 2);
  const sizeBytes =
    typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(text).length
      : Buffer.byteLength(text, 'utf8');

  await reporter({
    event: 'export',
    source,
    status: 'success',
    errorCode: null,
    schemaVersion: envelope.schemaVersion,
    blobTypes: envelopeBlobTypesAsBackup(envelope),
    sizeBytes,
  });

  return { envelope, text, sizeBytes };
}

export interface ImportVaultOptions {
  text: string;
  source?: 'local-file';
  replayTracker?: ReplayTracker;
  auditReporter?: AuditReporter;
}

export interface ImportVaultResult {
  envelope: VaultExportEnvelope;
  nextLocalVault: VaultStorageV1;
  sizeBytes: number;
}

/**
 * Validate, migrate, and atomically commit a vault export envelope to the
 * local store. Always reports an audit record (`success` or `failed`).
 *
 * Phases:
 * 1. Parse & validate (`parseVaultExportEnvelope`)
 * 2. Replay-detection lookup
 * 3. Forward migration to current schema version (`migrateEnvelope`)
 * 4. Stage to in-memory `VaultStorageV1` (no localStorage writes yet)
 * 5. Atomic commit via `saveVault` (single localStorage write)
 * 6. Record this `exportId` in the replay tracker
 *
 * If any step fails the local vault is not mutated and a `failed` audit
 * record is emitted with the classified `VaultImportError.code`.
 */
export async function importVault(
  options: ImportVaultOptions,
): Promise<ImportVaultResult> {
  const reporter = options.auditReporter ?? noopAuditReporter;
  const source = options.source ?? 'local-file';
  const sizeBytes =
    typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(options.text).length
      : Buffer.byteLength(options.text, 'utf8');

  let envelope: VaultExportEnvelope | null = null;

  const reportFailure = async (
    code: string,
    schemaVersion: number,
    blobTypes: ('addresses' | 'mobileNumbers' | 'subscriptions' | 'todos')[],
  ): Promise<void> => {
    await reporter({
      event: 'import',
      source,
      status: 'failed',
      errorCode: code,
      schemaVersion,
      blobTypes,
      sizeBytes,
    });
  };

  try {
    // Phase 1: parse & validate.
    envelope = parseVaultExportEnvelope(options.text);

    // Phase 2: replay detection.
    if (options.replayTracker) {
      const seen = await options.replayTracker.has(envelope.exportId);
      if (seen) {
        throw new VaultImportError(
          'replay-detected',
          'This envelope has already been imported recently',
        );
      }
    }

    // Phase 3: forward migration. Throws on downgrade or unsupported.
    const migrated = migrateEnvelope(
      envelope,
      CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
    );

    // Phase 4: stage in memory. Re-parse migrated envelope to recover the
    // narrow `VaultExportEnvelope` type after the registry's `Record` return.
    const stagedEnvelope = parseVaultExportEnvelope(JSON.stringify(migrated));
    const staged = envelopeToLocalVault(stagedEnvelope);

    // Phase 5: atomic commit.
    saveVault(staged);

    // Phase 6: record exportId.
    if (options.replayTracker) {
      await options.replayTracker.remember(stagedEnvelope.exportId);
    }

    await reporter({
      event: 'import',
      source,
      status: 'success',
      errorCode: null,
      schemaVersion: stagedEnvelope.schemaVersion,
      blobTypes: envelopeBlobTypesAsBackup(stagedEnvelope),
      sizeBytes,
    });

    return { envelope: stagedEnvelope, nextLocalVault: staged, sizeBytes };
  } catch (error) {
    const code = isVaultImportError(error) ? error.code : 'corrupt-file';
    const schemaVersion =
      envelope?.schemaVersion ?? CURRENT_VAULT_EXPORT_SCHEMA_VERSION;
    const blobTypes = envelope ? envelopeBlobTypesAsBackup(envelope) : [];
    await reportFailure(code, schemaVersion, blobTypes);
    throw error;
  }
}

// Re-export vault-core symbols that are part of the new public surface so
// consumers can import them from `@myorganizer/web-vault` without a direct
// vault-core dependency.
export {
  CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
  isVaultImportError,
  VAULT_CORE_EXPORT_MAX_BYTES,
  VAULT_EXPORT_BLOB_TYPES,
  VaultImportError,
};
export type { VaultExportEnvelope };
