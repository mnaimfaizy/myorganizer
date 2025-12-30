import { VaultBlobType } from '@myorganizer/app-api-client';

import type { VaultStorageV1 } from './vault';
import {
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
