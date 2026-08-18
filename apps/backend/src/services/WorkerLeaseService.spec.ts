import { WorkerLeaseService, DEFAULT_LEASE_TTL_MS } from './WorkerLeaseService';

jest.mock('../prisma', () => {
  const __mockPrisma = {
    youTubeWorkerLease: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  return {
    createPrismaClient: () => __mockPrisma,
    PrismaClient: jest.fn(),
    __mockPrisma,
  };
});

const mockPrisma = require('../prisma').__mockPrisma;

describe('WorkerLeaseService', () => {
  let service: WorkerLeaseService;
  const now = new Date('2026-01-15T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkerLeaseService(mockPrisma);
  });

  describe('acquire', () => {
    it('should create a new lease on first run and return null cursor', async () => {
      (mockPrisma.youTubeWorkerLease.updateMany as jest.Mock).mockResolvedValue(
        {
          count: 0,
        },
      );
      (mockPrisma.youTubeWorkerLease.create as jest.Mock).mockResolvedValue({
        name: 'youtube-digest',
        owner: 'digest-owner-1',
        cursor: null,
      });

      const result = await service.acquire(
        'youtube-digest',
        'digest-owner-1',
        DEFAULT_LEASE_TTL_MS,
        now,
      );

      expect(result).toEqual({
        name: 'youtube-digest',
        owner: 'digest-owner-1',
        cursor: null,
      });
    });

    it('should steal an expired lease and return stored cursor', async () => {
      (mockPrisma.youTubeWorkerLease.updateMany as jest.Mock).mockResolvedValue(
        {
          count: 1,
        },
      );
      (mockPrisma.youTubeWorkerLease.findUnique as jest.Mock).mockResolvedValue(
        {
          name: 'youtube-digest',
          owner: 'new-owner',
          cursor: 'user-42',
        },
      );

      const result = await service.acquire(
        'youtube-digest',
        'new-owner',
        DEFAULT_LEASE_TTL_MS,
        now,
      );

      expect(result).toEqual({
        name: 'youtube-digest',
        owner: 'new-owner',
        cursor: 'user-42',
      });
    });

    it('should return null when P2002 unique constraint rejects create', async () => {
      (mockPrisma.youTubeWorkerLease.updateMany as jest.Mock).mockResolvedValue(
        {
          count: 0,
        },
      );
      (mockPrisma.youTubeWorkerLease.create as jest.Mock).mockRejectedValue({
        code: 'P2002',
      });

      const result = await service.acquire(
        'youtube-digest',
        'owner-1',
        DEFAULT_LEASE_TTL_MS,
        now,
      );

      expect(result).toBeNull();
    });

    it('should return null when race is lost after update', async () => {
      (mockPrisma.youTubeWorkerLease.updateMany as jest.Mock).mockResolvedValue(
        {
          count: 1,
        },
      );
      (mockPrisma.youTubeWorkerLease.findUnique as jest.Mock).mockResolvedValue(
        {
          name: 'youtube-digest',
          owner: 'other-owner',
          cursor: 'user-42',
        },
      );

      const result = await service.acquire(
        'youtube-digest',
        'my-owner',
        DEFAULT_LEASE_TTL_MS,
        now,
      );

      expect(result).toBeNull();
    });
  });

  describe('saveCursor', () => {
    it('should persist cursor and push expiry out', async () => {
      const lease = {
        name: 'youtube-digest',
        owner: 'owner-1',
        cursor: 'user-10',
      };

      await service.saveCursor(lease, 'user-20', DEFAULT_LEASE_TTL_MS, now);

      expect(mockPrisma.youTubeWorkerLease.updateMany).toHaveBeenCalledWith({
        where: { name: 'youtube-digest', owner: 'owner-1' },
        data: {
          cursor: 'user-20',
          expiresAt: new Date(now.getTime() + DEFAULT_LEASE_TTL_MS),
        },
      });
    });

    it('should accept null cursor', async () => {
      const lease = {
        name: 'youtube-digest',
        owner: 'owner-1',
        cursor: 'user-10',
      };

      await service.saveCursor(lease, null, DEFAULT_LEASE_TTL_MS, now);

      expect(mockPrisma.youTubeWorkerLease.updateMany).toHaveBeenCalledWith({
        where: { name: 'youtube-digest', owner: 'owner-1' },
        data: {
          cursor: null,
          expiresAt: new Date(now.getTime() + DEFAULT_LEASE_TTL_MS),
        },
      });
    });
  });

  describe('release', () => {
    it('should expire the lease immediately', async () => {
      const lease = {
        name: 'youtube-digest',
        owner: 'owner-1',
        cursor: 'user-42',
      };

      await service.release(lease, now);

      expect(mockPrisma.youTubeWorkerLease.updateMany).toHaveBeenCalledWith({
        where: { name: 'youtube-digest', owner: 'owner-1' },
        data: { expiresAt: now },
      });
    });
  });
});
