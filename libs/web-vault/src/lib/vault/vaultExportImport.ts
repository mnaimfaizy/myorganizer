import {
  EncryptedBlobV1,
  VaultBlobType,
  VaultExportV1,
  VaultMetaV1,
} from '@myorganizer/app-api-client';

import { VaultStorageV1 } from './vault';
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
    'meta.wrapped_mk_passphrase'
  );
  const recovery = requireEncryptedBlob(
    meta.wrapped_mk_recovery,
    'meta.wrapped_mk_recovery'
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
      'meta.kdf_params.iterations must be a number when provided'
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
  value: unknown
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
      key === VaultBlobType.MobileNumbers
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
              localVault.data.addresses
            ),
          }
        : {}),
      ...(localVault.data.mobileNumbers
        ? {
            [VaultBlobType.MobileNumbers]: toEncryptedBlobV1(
              localVault.data.mobileNumbers
            ),
          }
        : {}),
    },
  };
}

export function bundleToLocalVault(bundle: VaultExportV1): VaultStorageV1 {
  const blobs: Partial<Record<VaultBlobType, EncryptedBlobV1 | null>> = {
    [VaultBlobType.Addresses]: bundle.blobs.addresses ?? null,
    [VaultBlobType.MobileNumbers]: bundle.blobs.mobileNumbers ?? null,
  };

  return serverMetaToLocalVault({ meta: bundle.meta, blobs });
}
