import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
  EncryptedBlobV1,
  VAULT_BLOB_TYPES,
  VaultService,
} from './VaultService';

jest.mock('../prisma', () => ({
  __esModule: true,
  createPrismaClient: jest.fn(),
  PrismaClient: jest.fn(),
  Prisma: jest.fn(),
}));

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
    const existingBlob = {
      version: 1,
      iv: IV_12B_BASE64,
      ciphertext: CT_BASE64,
    };
    prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
      blob: existingBlob,
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const blob = { version: 1, iv: IV_12B_BASE64, ciphertext: CT_BASE64 };
    const result = await service.putBlob(
      'user-1',
      'addresses',
      blob,
      'W/"999"',
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

  test('getBlob returns groceries blob with correct type', async () => {
    const expectedBlob = {
      version: 1,
      iv: IV_12B_BASE64,
      ciphertext: CT_BASE64,
    };
    prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
      type: 'groceries',
      blob: expectedBlob,
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const result = await service.getBlob('user-1', 'groceries');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.body.type).toBe('groceries');
      expect(result.body.blob).toEqual(expectedBlob);
    }
  });

  test('putBlob stores and returns groceries blob with etag', async () => {
    prisma.encryptedVault.findUnique.mockResolvedValue({ userId: 'user-1' });
    prisma.encryptedVaultBlob.findUnique.mockResolvedValue(null);
    prisma.encryptedVaultBlob.upsert.mockResolvedValue({
      type: 'groceries',
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const blob = { version: 1, iv: IV_12B_BASE64, ciphertext: CT_BASE64 };
    const result = await service.putBlob('user-1', 'groceries', blob);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(201);
      expect(result.body.ok).toBe(true);
      expect(result.body.etag).toContain('W/');
    }
  });

  test('exportVault includes groceries key when blob exists', async () => {
    const groceriesBlob = {
      version: 1,
      iv: IV_12B_BASE64,
      ciphertext: CT_BASE64,
    };
    prisma.encryptedVault.findUnique.mockResolvedValue({
      userId: 'user-1',
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: 'salt',
      kdf_params: { iterations: 1 },
      wrapped_mk_passphrase: { v: 1 },
      wrapped_mk_recovery: { v: 1 },
    });
    prisma.encryptedVaultBlob.findMany.mockResolvedValue([
      {
        type: 'groceries',
        blob: groceriesBlob,
      },
    ]);

    const result = await service.exportVault('user-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.body.blobs).toHaveProperty('groceries');
      expect(result.body.blobs.groceries).toEqual(groceriesBlob);
    }
  });

  test('importVault accepts groceries blob in bundle', async () => {
    prisma.encryptedVault.upsert.mockResolvedValue({ updatedAt: new Date() });
    prisma.encryptedVaultBlob.upsert.mockResolvedValue({
      updatedAt: new Date(),
    });

    const wrapped = { version: 1, iv: IV_12B_BASE64, ciphertext: CT_BASE64 };
    const groceriesBlob = {
      version: 1,
      iv: IV_12B_BASE64,
      ciphertext: CT_BASE64,
    };
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
        groceries: groceriesBlob,
      },
    };

    const result = await service.importVault('user-1', bundle);

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.status).toBe(200);
      expect(result.body.ok).toBe(true);
    }

    // Assert that the groceries blob was actually persisted to the database
    expect(prisma.encryptedVaultBlob.upsert).toHaveBeenCalledWith({
      where: { userId_type: { userId: 'user-1', type: 'groceries' } },
      create: {
        userId: 'user-1',
        type: 'groceries',
        blob: groceriesBlob,
      },
      update: { blob: groceriesBlob },
    });
  });

  test('importVault persists all registered blob types from bundle', async () => {
    prisma.encryptedVault.upsert.mockResolvedValue({ updatedAt: new Date() });
    prisma.encryptedVaultBlob.upsert.mockResolvedValue({
      updatedAt: new Date(),
    });

    const wrapped = { version: 1, iv: IV_12B_BASE64, ciphertext: CT_BASE64 };

    // Create blobs for all registered types
    const blobs: Record<string, EncryptedBlobV1> = {};
    for (const type of VAULT_BLOB_TYPES) {
      blobs[type] = { version: 1, iv: IV_12B_BASE64, ciphertext: CT_BASE64 };
    }

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
      blobs,
    };

    const result = await service.importVault('user-1', bundle);

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.status).toBe(200);
      expect(result.body.ok).toBe(true);
    }

    // Assert that all six registered blob types were persisted
    expect(prisma.encryptedVaultBlob.upsert).toHaveBeenCalledTimes(
      VAULT_BLOB_TYPES.length,
    );

    // Verify each registered type was persisted with correct where clause
    for (const type of VAULT_BLOB_TYPES) {
      expect(prisma.encryptedVaultBlob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_type: { userId: 'user-1', type } },
        }),
      );
    }
  });

  describe('ADR 0055: ETag is content-based, not timestamp-based', () => {
    test('blob ETag is stable when content is identical despite different updatedAt', async () => {
      const blobContentA = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: CT_BASE64,
      };

      const date1 = new Date('2025-01-01T00:00:00.000Z');
      const date2 = new Date('2025-06-15T12:00:00.000Z');

      // First call: blob with date1
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentA,
        updatedAt: date1,
      });

      const result1 = await service.getBlob('user-1', 'addresses');
      expect(result1.ok).toBe(true);
      if (!result1.ok) throw new Error('Expected ok result');
      const etag1 = result1.body.etag;

      // Second call: same blob with date2
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentA,
        updatedAt: date2,
      });

      const result2 = await service.getBlob('user-1', 'addresses');
      expect(result2.ok).toBe(true);
      if (!result2.ok) throw new Error('Expected ok result');
      const etag2 = result2.body.etag;

      // Both ETags should be identical (content-based, not timestamp-based)
      expect(etag1).toBe(etag2);
    });

    test('blob ETag changes when content differs even at identical timestamp', async () => {
      const date = new Date('2025-01-01T00:00:00.000Z');
      const blobContentA = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: CT_BASE64,
      };
      const blobContentB = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: Buffer.from('different-ciphertext').toString('base64'),
      };

      // First call: blob A with timestamp
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentA,
        updatedAt: date,
      });

      const result1 = await service.getBlob('user-1', 'addresses');
      expect(result1.ok).toBe(true);
      if (!result1.ok) throw new Error('Expected ok result');
      const etag1 = result1.body.etag;

      // Second call: blob B with same timestamp
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentB,
        updatedAt: date,
      });

      const result2 = await service.getBlob('user-1', 'addresses');
      expect(result2.ok).toBe(true);
      if (!result2.ok) throw new Error('Expected ok result');
      const etag2 = result2.body.etag;

      // ETags should differ because content differs
      expect(etag1).not.toBe(etag2);
    });

    test('putBlob rejects stale If-Match with 409 when content has changed', async () => {
      const blobContentA = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: CT_BASE64,
      };
      const blobContentB = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: Buffer.from('different-ciphertext').toString('base64'),
      };
      const blobContentC = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: Buffer.from('third-ciphertext').toString('base64'),
      };

      // Mock vault exists
      prisma.encryptedVault.findUnique.mockResolvedValue({
        userId: 'user-1',
      });

      // Get the real ETag for blobContentA (what the client has)
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentA,
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const getResult = await service.getBlob('user-1', 'addresses');
      expect(getResult.ok).toBe(true);
      if (!getResult.ok) throw new Error('Expected ok result');
      const realEtagForA = getResult.body.etag;

      // Mock that the server NOW has blobContentB (server content changed)
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentB,
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      // Try putBlob with the old ETag (for A) but server now has B
      const putResult = await service.putBlob(
        'user-1',
        'addresses',
        blobContentC,
        realEtagForA,
      );

      expect(putResult.ok).toBe(false);
      if (putResult.ok === false) {
        expect(putResult.status).toBe(409);
        expect(putResult.body.message).toBe('ETag mismatch');
      }
    });

    test('putBlob succeeds when If-Match matches current content ETag', async () => {
      const blobContentA = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: CT_BASE64,
      };
      const blobContentB = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: Buffer.from('different-ciphertext').toString('base64'),
      };

      // Mock vault exists
      prisma.encryptedVault.findUnique.mockResolvedValue({
        userId: 'user-1',
      });

      // Get the real ETag for blobContentA (the existing content)
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentA,
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const getResult = await service.getBlob('user-1', 'addresses');
      expect(getResult.ok).toBe(true);
      if (!getResult.ok) throw new Error('Expected ok result');
      const realEtagForA = getResult.body.etag;

      // Mock for the putBlob findUnique call
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentA,
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      // Mock the upsert that stores the new content
      prisma.encryptedVaultBlob.upsert.mockResolvedValue({
        type: 'addresses',
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const putResult = await service.putBlob(
        'user-1',
        'addresses',
        blobContentB,
        realEtagForA,
      );

      expect(putResult.ok).toBe(true);
      if (putResult.ok) {
        expect(putResult.status).toBe(200);
      }
    });

    test('blob ETag returns to previous value when content returns to that value', async () => {
      const blobContentX = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: CT_BASE64,
      };
      const blobContentY = {
        version: 1,
        iv: IV_12B_BASE64,
        ciphertext: Buffer.from('different-ciphertext').toString('base64'),
      };

      // First call: content X
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentX,
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const resultX1 = await service.getBlob('user-1', 'addresses');
      expect(resultX1.ok).toBe(true);
      if (!resultX1.ok) throw new Error('Expected ok result');
      const etagX1 = resultX1.body.etag;

      // Second call: content Y
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentY,
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const resultY = await service.getBlob('user-1', 'addresses');
      expect(resultY.ok).toBe(true);
      if (!resultY.ok) throw new Error('Expected ok result');
      const etagY = resultY.body.etag;

      // Third call: content X again
      prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
        type: 'addresses',
        blob: blobContentX,
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const resultX2 = await service.getBlob('user-1', 'addresses');
      expect(resultX2.ok).toBe(true);
      if (!resultX2.ok) throw new Error('Expected ok result');
      const etagX2 = resultX2.body.etag;

      // Both X ETags should be identical
      expect(etagX1).toBe(etagX2);
      // Y ETag should be different from X
      expect(etagY).not.toBe(etagX1);
    });

    test('vault meta ETag is stable when content is identical despite different updatedAt', async () => {
      const metaContent = {
        version: 1,
        kdf_name: 'PBKDF2',
        kdf_salt: 'salt',
        kdf_params: { iterations: 1 },
        wrapped_mk_passphrase: { v: 1 },
        wrapped_mk_recovery: { v: 1 },
      };

      const date1 = new Date('2025-01-01T00:00:00.000Z');
      const date2 = new Date('2025-06-15T12:00:00.000Z');

      // First call: meta with date1
      prisma.encryptedVault.findUnique.mockResolvedValue({
        ...metaContent,
        updatedAt: date1,
      });

      const result1 = await service.getVaultMeta('user-1');
      expect(result1.ok).toBe(true);
      if (!result1.ok) throw new Error('Expected ok result');
      const etag1 = result1.body.etag;

      // Second call: same meta with date2
      prisma.encryptedVault.findUnique.mockResolvedValue({
        ...metaContent,
        updatedAt: date2,
      });

      const result2 = await service.getVaultMeta('user-1');
      expect(result2.ok).toBe(true);
      if (!result2.ok) throw new Error('Expected ok result');
      const etag2 = result2.body.etag;

      // Both ETags should be identical (content-based, not timestamp-based)
      expect(etag1).toBe(etag2);
    });

    test('vault meta ETag changes when content differs even at identical timestamp', async () => {
      const date = new Date('2025-01-01T00:00:00.000Z');
      const metaContentA = {
        version: 1,
        kdf_name: 'PBKDF2',
        kdf_salt: 'salt',
        kdf_params: { iterations: 1 },
        wrapped_mk_passphrase: { v: 1 },
        wrapped_mk_recovery: { v: 1 },
      };
      const metaContentB = {
        version: 1,
        kdf_name: 'PBKDF2',
        kdf_salt: 'salt-different',
        kdf_params: { iterations: 1 },
        wrapped_mk_passphrase: { v: 1 },
        wrapped_mk_recovery: { v: 1 },
      };

      // First call: meta A with timestamp
      prisma.encryptedVault.findUnique.mockResolvedValue({
        ...metaContentA,
        updatedAt: date,
      });

      const result1 = await service.getVaultMeta('user-1');
      expect(result1.ok).toBe(true);
      if (!result1.ok) throw new Error('Expected ok result');
      const etag1 = result1.body.etag;

      // Second call: meta B with same timestamp
      prisma.encryptedVault.findUnique.mockResolvedValue({
        ...metaContentB,
        updatedAt: date,
      });

      const result2 = await service.getVaultMeta('user-1');
      expect(result2.ok).toBe(true);
      if (!result2.ok) throw new Error('Expected ok result');
      const etag2 = result2.body.etag;

      // ETags should differ because content differs
      expect(etag1).not.toBe(etag2);
    });
  });
});
