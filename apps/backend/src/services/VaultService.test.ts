import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { VaultService } from './VaultService';

function makePrismaMock() {
  return {
    encryptedVault: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    encryptedVaultBlob: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  } as any;
}

describe('VaultService', () => {
  let prisma: any;
  let service: VaultService;

  const IV_12B_BASE64 = Buffer.alloc(12).toString('base64');
  const CT_BASE64 = Buffer.from('ciphertext').toString('base64');

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new VaultService(prisma);
    jest.clearAllMocks();
  });

  test('getVaultMeta returns 404 when vault missing', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue(null);

    const result = await service.getVaultMeta('user-1');

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe(404);
      expect(result.body.message).toBe('Vault not found');
    }
  });

  test('getBlob returns 404 when blob missing', async () => {
    prisma.encryptedVaultBlob.findUnique.mockResolvedValue(null);

    const result = await service.getBlob('user-1', 'addresses');

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe(404);
      expect(result.body.message).toBe('Vault blob not found');
    }
  });

  test('putVaultMeta returns 422 for invalid meta', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue(null);

    const result = await service.putVaultMeta('user-1', { nope: true });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
  });

  test('putVaultMeta creates vault (201) when missing and no If-Match', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue(null);
    prisma.encryptedVault.upsert.mockResolvedValue({
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const meta = {
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: 'salt',
      kdf_params: { iterations: 1 },
      wrapped_mk_passphrase: { v: 1 },
      wrapped_mk_recovery: { v: 1 },
    };

    const result = await service.putVaultMeta('user-1', meta);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(201);
      expect(result.body.ok).toBe(true);
      expect(result.body.etag).toContain('W/');
    }
  });

  test('putVaultMeta returns 409 when If-Match provided but vault missing', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue(null);

    const meta = {
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: 'salt',
      kdf_params: { iterations: 1 },
      wrapped_mk_passphrase: { v: 1 },
      wrapped_mk_recovery: { v: 1 },
    };

    const result = await service.putVaultMeta('user-1', meta, 'W/"123"');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
    }
  });

  test('putVaultMeta returns 409 when If-Match mismatches current ETag', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue({
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const meta = {
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: 'salt',
      kdf_params: { iterations: 1 },
      wrapped_mk_passphrase: { v: 1 },
      wrapped_mk_recovery: { v: 1 },
    };

    const result = await service.putVaultMeta('user-1', meta, 'W/"999"');

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe(409);
      expect(result.body.message).toBe('ETag mismatch');
    }
  });

  test('putVaultMeta returns 422 when meta payload too large', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue(null);

    const meta = {
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: 'salt',
      kdf_params: { padding: 'a'.repeat(40_000) },
      wrapped_mk_passphrase: { v: 1 },
      wrapped_mk_recovery: { v: 1 },
    };

    const result = await service.putVaultMeta('user-1', meta);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe(422);
      expect(result.body.message).toBe('Vault meta payload too large');
    }
  });

  test('putBlob returns 404 when vault missing', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue(null);

    const blob = { version: 1, iv: IV_12B_BASE64, ciphertext: CT_BASE64 };
    const result = await service.putBlob('user-1', 'addresses', blob);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  test('putBlob returns 409 on ETag mismatch', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue({ userId: 'user-1' });
    prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const blob = { version: 1, iv: IV_12B_BASE64, ciphertext: CT_BASE64 };
    const result = await service.putBlob(
      'user-1',
      'addresses',
      blob,
      'W/"999"'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
    }
  });

  test('putBlob returns 422 for non-base64 iv', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue({ userId: 'user-1' });

    const blob = { version: 1, iv: 'not-base64', ciphertext: CT_BASE64 };
    const result = await service.putBlob('user-1', 'addresses', blob);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
  });

  test('putBlob returns 422 for iv that decodes to the wrong byte length', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue({ userId: 'user-1' });

    const iv1 = Buffer.alloc(1).toString('base64');
    const blob = { version: 1, iv: iv1, ciphertext: CT_BASE64 };
    const result = await service.putBlob('user-1', 'addresses', blob);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
  });

  test('putBlob returns 422 for non-base64 ciphertext', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue({ userId: 'user-1' });

    const blob = { version: 1, iv: IV_12B_BASE64, ciphertext: '***' };
    const result = await service.putBlob('user-1', 'addresses', blob);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
  });

  test('putBlob returns 422 when blob payload too large', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue({ userId: 'user-1' });

    const huge = 'a'.repeat(300_000);
    const bigCiphertext = Buffer.from(huge).toString('base64');
    const blob = { version: 1, iv: IV_12B_BASE64, ciphertext: bigCiphertext };

    const result = await service.putBlob('user-1', 'addresses', blob);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe(422);
      expect(result.body.message).toBe('Blob payload too large');
    }
  });

  test('exportVault returns 404 when vault missing', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue(null);

    const result = await service.exportVault('user-1');

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe(404);
      expect(result.body.message).toBe('Vault not found');
    }
  });

  test('importVault returns 422 when wrapped master key shape is invalid', async () => {
    const bundle = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      meta: {
        version: 1,
        kdf_name: 'PBKDF2',
        kdf_salt: 'salt',
        kdf_params: { iterations: 1 },
        wrapped_mk_passphrase: { nope: true },
        wrapped_mk_recovery: { nope: true },
      },
      blobs: {},
    };

    const result = await service.importVault('user-1', bundle);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe(422);
      expect(result.body.message).toBe('Invalid wrapped master key shape');
    }
  });

  test('importVault accepts valid wrapped master key blobs', async () => {
    prisma.encryptedVault.upsert.mockResolvedValue({ updatedAt: new Date() });

    const wrapped = { version: 1, iv: IV_12B_BASE64, ciphertext: CT_BASE64 };
    const bundle = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      meta: {
        version: 1,
        kdf_name: 'PBKDF2',
        kdf_salt: 'salt',
        kdf_params: { iterations: 1 },
        wrapped_mk_passphrase: wrapped,
        wrapped_mk_recovery: wrapped,
      },
      blobs: {
        addresses: wrapped,
      },
    };

    const result = await service.importVault('user-1', bundle);

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.status).toBe(200);
      expect(result.body.ok).toBe(true);
    }
  });
});
