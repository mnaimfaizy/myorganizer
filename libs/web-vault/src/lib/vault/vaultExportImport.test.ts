import { VaultBlobType } from '@myorganizer/app-api-client';

import type { VaultStorageV1 } from './vault';
import {
  VAULT_EXPORT_MAX_BYTES,
  buildLocalExportBundle,
  bundleToLocalVault,
  validateVaultExportBundleFromText,
} from './vaultExportImport';

const sampleVault: VaultStorageV1 = {
  version: 1,
  kdf: {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 310_000,
    salt: 'c2FsdA==',
  },
  masterKeyWrappedWithPassphrase: {
    iv: 'cGFzc3BocmFzZS1pdg==',
    ciphertext: 'cGFzc3BocmFzZS1jdA==',
  },
  masterKeyWrappedWithRecoveryKey: {
    iv: 'cmVjb3ZlcnktaXYtMTI=',
    ciphertext: 'cmVjb3ZlcnktaXYtY3Q=',
  },
  data: {
    addresses: {
      iv: 'YWRkcmVzcy1pdi0xMjM=',
      ciphertext: 'YWRkcmVzcy1jdC0xMjM=',
    },
    mobileNumbers: {
      iv: 'bW9iaWxlLWl2LTEyMzQ=',
      ciphertext: 'bW9iaWxlLWN0LTEyMzQ=',
    },
  },
};

describe('vaultExportImport helpers', () => {
  function byteLengthUtf8(text: string): number {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text).length;
    }
    return Buffer.byteLength(text, 'utf8');
  }

  test('buildLocalExportBundle produces exportVersion 1 snapshot with blobs', () => {
    const bundle = buildLocalExportBundle({
      localVault: sampleVault,
      exportedAt: '2025-01-01T00:00:00Z',
    });

    expect(bundle.exportVersion).toBe(1);
    expect(bundle.exportedAt).toBe('2025-01-01T00:00:00Z');
    expect(bundle.meta.kdf_name).toBe('PBKDF2');
    expect(bundle.meta.wrapped_mk_passphrase.version).toBe(1);
    expect(bundle.blobs.addresses?.version).toBe(1);
  });

  test('validateVaultExportBundleFromText rejects invalid base64 iv', () => {
    const invalid = buildLocalExportBundle({ localVault: sampleVault });
    if (invalid.blobs.addresses) {
      invalid.blobs.addresses.iv = 'not-base64';
    }

    const text = JSON.stringify(invalid);
    expect(() => validateVaultExportBundleFromText(text)).toThrow('base64');
  });

  test('validateVaultExportBundleFromText rejects invalid JSON with readable message', () => {
    expect(() => validateVaultExportBundleFromText('{')).toThrow(
      'Invalid JSON'
    );
  });

  test('validateVaultExportBundleFromText rejects unsupported exportVersion', () => {
    const invalid = buildLocalExportBundle({
      localVault: sampleVault,
      exportedAt: '2025-01-01T00:00:00Z',
    }) as any;
    invalid.exportVersion = 2;

    expect(() =>
      validateVaultExportBundleFromText(JSON.stringify(invalid))
    ).toThrow('Unsupported exportVersion');
  });

  test('validateVaultExportBundleFromText rejects exportedAt that is not a string', () => {
    const invalid = buildLocalExportBundle({
      localVault: sampleVault,
      exportedAt: '2025-01-01T00:00:00Z',
    }) as any;
    invalid.exportedAt = null;

    expect(() =>
      validateVaultExportBundleFromText(JSON.stringify(invalid))
    ).toThrow('exportedAt must be a string');
  });

  test('validateVaultExportBundleFromText size guard triggers before JSON parse', () => {
    const tooLarge = 'a'.repeat(VAULT_EXPORT_MAX_BYTES + 1);
    expect(() => validateVaultExportBundleFromText(tooLarge)).toThrow(
      'Bundle is too large to import'
    );
  });

  test('validateVaultExportBundleFromText allows payload exactly at size limit (then fails on schema)', () => {
    const prefix = '{"a":"';
    const suffix = '"}';
    const padLen =
      VAULT_EXPORT_MAX_BYTES - byteLengthUtf8(prefix) - byteLengthUtf8(suffix);
    expect(padLen).toBeGreaterThan(0);

    const text = `${prefix}${'x'.repeat(padLen)}${suffix}`;
    expect(byteLengthUtf8(text)).toBe(VAULT_EXPORT_MAX_BYTES);

    // Should pass size check but fail schema validation.
    expect(() => validateVaultExportBundleFromText(text)).toThrow(
      'Unsupported exportVersion'
    );
  });

  test('validateVaultExportBundleFromText warns on unknown blob type keys', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const bundle = buildLocalExportBundle({
        localVault: sampleVault,
        exportedAt: '2025-01-01T00:00:00Z',
      }) as any;

      bundle.blobs = {
        ...bundle.blobs,
        unknownBlobType: {
          version: 1,
          iv: 'YWRkcmVzcy1pdi0xMjM=',
          ciphertext: 'YWRkcmVzcy1jdC0xMjM=',
        },
      };

      validateVaultExportBundleFromText(JSON.stringify(bundle));
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('bundleToLocalVault round-trips encrypted blobs', () => {
    const bundle = buildLocalExportBundle({
      localVault: sampleVault,
      exportedAt: '2025-01-01T00:00:00Z',
    });
    const restored = bundleToLocalVault(bundle);

    expect(restored.kdf.salt).toBe(sampleVault.kdf.salt);
    expect(restored.data.addresses?.ciphertext).toBe(
      sampleVault.data.addresses?.ciphertext
    );
    expect(restored.data.mobileNumbers?.ciphertext).toBe(
      sampleVault.data.mobileNumbers?.ciphertext
    );
    expect(Object.keys(restored.data)).toEqual([
      VaultBlobType.Addresses,
      VaultBlobType.MobileNumbers,
    ]);
  });
});
