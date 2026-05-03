import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { VaultBackupService } from './VaultBackupService';

type MockPrisma = {
  vaultBackupRecord: {
    create: jest.Mock<any>;
    findFirst: jest.Mock<any>;
    findMany: jest.Mock<any>;
  };
};

function makePrisma(): MockPrisma {
  return {
    vaultBackupRecord: {
      create: jest.fn() as jest.Mock<any>,
      findFirst: jest.fn() as jest.Mock<any>,
      findMany: jest.fn() as jest.Mock<any>,
    },
  };
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rec-1',
    userId: 'user-1',
    event: 'export',
    source: 'google-drive',
    status: 'success',
    errorCode: null,
    schemaVersion: 1,
    blobTypes: ['addresses'],
    sizeBytes: 1024,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as any;
}

describe('VaultBackupService source filtering', () => {
  let prisma: MockPrisma;
  let service: VaultBackupService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new VaultBackupService(prisma as any);
  });

  test('records a google-drive backup', async () => {
    prisma.vaultBackupRecord.create.mockResolvedValueOnce(makeRow());
    const result = await service.recordEvent('user-1', {
      event: 'export',
      source: 'google-drive',
      status: 'success',
      schemaVersion: 1,
      blobTypes: ['addresses'],
      sizeBytes: 1024,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.source).toBe('google-drive');
    expect(prisma.vaultBackupRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: 'google-drive' }),
    });
  });

  test('rejects unknown source value when recording', async () => {
    const result = await service.recordEvent('user-1', {
      event: 'export',
      source: 'cloud-magic',
      status: 'success',
      schemaVersion: 1,
      blobTypes: [],
      sizeBytes: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
    expect(prisma.vaultBackupRecord.create).not.toHaveBeenCalled();
  });

  test('getLatest filters by source', async () => {
    prisma.vaultBackupRecord.findFirst.mockResolvedValueOnce(makeRow());
    const result = await service.getLatest('user-1', 'success', 'google-drive');
    expect(result.ok).toBe(true);
    expect(prisma.vaultBackupRecord.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'success',
        source: 'google-drive',
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  test('getLatest rejects invalid source filter', async () => {
    const result = await service.getLatest('user-1', undefined, 'bogus');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
    expect(prisma.vaultBackupRecord.findFirst).not.toHaveBeenCalled();
  });

  test('getLatest returns 404 when no row matches', async () => {
    prisma.vaultBackupRecord.findFirst.mockResolvedValueOnce(null);
    const result = await service.getLatest('user-1', 'success', 'google-drive');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  test('listHistory filters by source', async () => {
    prisma.vaultBackupRecord.findMany.mockResolvedValueOnce([]);
    const result = await service.listHistory('user-1', {
      source: 'google-drive',
    });
    expect(result.ok).toBe(true);
    expect(prisma.vaultBackupRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', source: 'google-drive' },
      }),
    );
  });

  test('listHistory rejects invalid source filter', async () => {
    const result = await service.listHistory('user-1', { source: 'bogus' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
    expect(prisma.vaultBackupRecord.findMany).not.toHaveBeenCalled();
  });
});
