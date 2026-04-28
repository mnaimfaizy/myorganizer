import { z } from 'zod';
import { VaultImportError } from './vaultImportError';

export const VAULT_EXPORT_BLOB_TYPES = [
  'addresses',
  'mobileNumbers',
  'subscriptions',
  'todos',
] as const;

export type VaultExportBlobType = (typeof VAULT_EXPORT_BLOB_TYPES)[number];

/**
 * Current envelope schema version produced by `exportVault`. Forward
 * migrations are registered in {@link migrationRegistry}.
 */
export const CURRENT_VAULT_EXPORT_SCHEMA_VERSION = 1 as const;

/** Hard cap on the parsed envelope size in bytes. */
export const VAULT_EXPORT_MAX_BYTES = 10 * 1024 * 1024;

const Base64String = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9+/]*={0,2}$/u, 'must be base64');

const EncryptedBlobSchema = z
  .object({
    version: z.number().int().positive(),
    iv: Base64String,
    ciphertext: Base64String,
  })
  .passthrough();

const VaultMetaSchema = z
  .object({
    version: z.number().int().positive(),
    kdf_name: z.string().min(1),
    kdf_salt: Base64String,
    kdf_params: z.record(z.string(), z.unknown()),
    wrapped_mk_passphrase: EncryptedBlobSchema,
    wrapped_mk_recovery: EncryptedBlobSchema,
  })
  .passthrough();

const BlobsSchema = z
  .object({
    addresses: EncryptedBlobSchema.optional(),
    mobileNumbers: EncryptedBlobSchema.optional(),
    subscriptions: EncryptedBlobSchema.optional(),
    todos: EncryptedBlobSchema.optional(),
  })
  .strict();

/**
 * Strict Zod schema for a vault export envelope.
 *
 * Notes:
 * - `exportId` is a uuid v4 generated per export and is used by the
 *   client-side replay tracker.
 * - Unknown blob type keys cause validation to fail with `unrecognized_keys`,
 *   which is mapped to {@link VaultImportError} code `unknown-blob-type` by
 *   {@link parseVaultExportEnvelope}.
 */
export const VaultExportEnvelopeSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    exportId: z.string().uuid(),
    exportedAt: z.string().min(1),
    meta: VaultMetaSchema,
    blobs: BlobsSchema,
  })
  .passthrough();

export type VaultExportEnvelope = z.infer<typeof VaultExportEnvelopeSchema>;

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return Buffer.byteLength(text, 'utf8');
}

/**
 * Parse a serialized envelope (raw JSON text) into a validated
 * {@link VaultExportEnvelope}. Throws {@link VaultImportError} with a
 * specific code on every failure path. Does not perform migration or
 * decryption.
 */
export function parseVaultExportEnvelope(text: string): VaultExportEnvelope {
  if (typeof text !== 'string' || text.length === 0) {
    throw new VaultImportError('corrupt-file', 'Empty envelope');
  }

  if (utf8ByteLength(text) > VAULT_EXPORT_MAX_BYTES) {
    throw new VaultImportError(
      'oversize',
      `Envelope exceeds ${VAULT_EXPORT_MAX_BYTES} bytes`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VaultImportError('corrupt-file', `Invalid JSON: ${message}`);
  }

  return validateVaultExportEnvelope(parsed);
}

/**
 * Validate an already-parsed object as a {@link VaultExportEnvelope}.
 * Throws {@link VaultImportError} with a specific code on every failure.
 */
export function validateVaultExportEnvelope(raw: unknown): VaultExportEnvelope {
  const result = VaultExportEnvelopeSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues;
    const unknownKey = issues.find(
      (i) => i.code === 'unrecognized_keys' && i.path.includes('blobs'),
    );
    if (unknownKey) {
      throw new VaultImportError(
        'unknown-blob-type',
        'Envelope contains unsupported blob types',
        issues,
      );
    }
    throw new VaultImportError(
      'corrupt-file',
      'Envelope failed schema validation',
      issues,
    );
  }

  const envelope = result.data;
  const blobEntries = Object.values(envelope.blobs).filter(
    (v) => v !== undefined,
  );
  if (blobEntries.length === 0) {
    throw new VaultImportError('empty-envelope', 'Envelope contains no blobs');
  }

  return envelope;
}
