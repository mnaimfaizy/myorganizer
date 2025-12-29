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

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new VaultService(prisma);
    jest.clearAllMocks();
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

  test('putBlob returns 404 when vault missing', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue(null);

    const blob = { version: 1, iv: 'iv', ciphertext: 'ct' };
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

    const blob = { version: 1, iv: 'iv', ciphertext: 'ct' };
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
});
