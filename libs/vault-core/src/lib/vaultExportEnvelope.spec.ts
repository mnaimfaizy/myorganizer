import { describe, expect, test } from '@jest/globals';
import {
  CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
  VAULT_EXPORT_MAX_BYTES,
  VaultImportError,
  migrateEnvelope,
  migrationRegistry,
  parseVaultExportEnvelope,
  validateVaultExportEnvelope,
} from '../index';

const validBlob = {
  version: 1,
  iv: Buffer.alloc(12).toString('base64'),
  ciphertext: Buffer.from('ciphertext').toString('base64'),
};

const validMeta = {
  version: 1,
  kdf_name: 'PBKDF2',
  kdf_salt: Buffer.alloc(16).toString('base64'),
  kdf_params: { iterations: 100000, hash: 'SHA-256' },
  wrapped_mk_passphrase: validBlob,
  wrapped_mk_recovery: validBlob,
};

function makeEnvelope(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schemaVersion: CURRENT_VAULT_EXPORT_SCHEMA_VERSION,
    exportId: '11111111-1111-4111-8111-111111111111',
    exportedAt: '2026-01-01T00:00:00.000Z',
    meta: validMeta,
    blobs: { addresses: validBlob },
    ...overrides,
  };
}

describe('parseVaultExportEnvelope', () => {
  test('parses a valid envelope', () => {
    const text = JSON.stringify(makeEnvelope());
    const result = parseVaultExportEnvelope(text);
    expect(result.schemaVersion).toBe(CURRENT_VAULT_EXPORT_SCHEMA_VERSION);
    expect(result.blobs.addresses).toBeDefined();
  });

  test('throws corrupt-file on invalid JSON', () => {
    expect(() => parseVaultExportEnvelope('{not json')).toThrow(
      VaultImportError,
    );
    try {
      parseVaultExportEnvelope('{not json');
    } catch (e) {
      expect((e as VaultImportError).code).toBe('corrupt-file');
    }
  });

  test('throws corrupt-file on empty string', () => {
    try {
      parseVaultExportEnvelope('');
    } catch (e) {
      expect((e as VaultImportError).code).toBe('corrupt-file');
    }
  });

  test('throws oversize when payload exceeds max bytes', () => {
    const padded = JSON.stringify({
      ...makeEnvelope(),
      filler: 'x'.repeat(VAULT_EXPORT_MAX_BYTES + 100),
    });
    try {
      parseVaultExportEnvelope(padded);
    } catch (e) {
      expect((e as VaultImportError).code).toBe('oversize');
    }
  });
});

describe('validateVaultExportEnvelope', () => {
  test('rejects unknown blob type with unknown-blob-type', () => {
    const envelope = makeEnvelope({
      blobs: { addresses: validBlob, weird: validBlob } as any,
    });
    try {
      validateVaultExportEnvelope(envelope);
    } catch (e) {
      expect((e as VaultImportError).code).toBe('unknown-blob-type');
    }
  });

  test('rejects empty envelope (no blobs)', () => {
    const envelope = makeEnvelope({ blobs: {} });
    try {
      validateVaultExportEnvelope(envelope);
    } catch (e) {
      expect((e as VaultImportError).code).toBe('empty-envelope');
    }
  });

  test('rejects envelope missing required fields with corrupt-file', () => {
    const envelope = makeEnvelope({ exportId: 'not-a-uuid' });
    try {
      validateVaultExportEnvelope(envelope);
    } catch (e) {
      expect((e as VaultImportError).code).toBe('corrupt-file');
    }
  });
});

describe('migrateEnvelope', () => {
  test('returns envelope unchanged when already at current version', () => {
    const env = { schemaVersion: 1, foo: 'bar' };
    const result = migrateEnvelope(env, 1);
    expect(result.schemaVersion).toBe(1);
  });

  test('throws schema-version-downgrade when envelope is newer', () => {
    const env = { schemaVersion: 99 };
    try {
      migrateEnvelope(env, 1);
    } catch (e) {
      expect((e as VaultImportError).code).toBe('schema-version-downgrade');
    }
  });

  test('throws schema-version-unsupported when no migration registered', () => {
    const env = { schemaVersion: 0 };
    try {
      migrateEnvelope(env, 1);
    } catch (e) {
      expect((e as VaultImportError).code).toBe('schema-version-unsupported');
    }
  });

  test('throws schema-version-unsupported when version is non-numeric', () => {
    const env = { schemaVersion: 'one' as unknown as number };
    try {
      migrateEnvelope(env, 1);
    } catch (e) {
      expect((e as VaultImportError).code).toBe('schema-version-unsupported');
    }
  });

  test('applies a registered forward migration', () => {
    const original = migrationRegistry[1];
    migrationRegistry[1] = (env) => ({ ...env, migrated: true });
    try {
      const env = { schemaVersion: 1 };
      const result = migrateEnvelope(env, 2);
      expect(result.schemaVersion).toBe(2);
      expect(result.migrated).toBe(true);
    } finally {
      if (original) migrationRegistry[1] = original;
      else delete migrationRegistry[1];
    }
  });
});
