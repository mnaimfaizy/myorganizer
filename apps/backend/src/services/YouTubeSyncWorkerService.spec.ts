import { YouTubeSyncWorkerService } from './YouTubeSyncWorkerService';

jest.mock('./WorkerLeaseService', () => {
  const __mockWorkerLeaseService = {
    newOwnerId: jest.fn(),
    acquire: jest.fn(),
    saveCursor: jest.fn(),
    release: jest.fn(),
  };
  return {
    __esModule: true,
    default: __mockWorkerLeaseService,
    __mockWorkerLeaseService,
  };
});

jest.mock('./YouTubeSyncService', () => {
  const __mockSync = jest.fn().mockResolvedValue(5);
  return {
    __esModule: true,
    default: { syncVideosForUser: __mockSync },
    __mockSync,
  };
});

jest.mock('../prisma', () => {
  const __mockPrisma = {
    youTubeIntegration: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
  };

  return {
    createPrismaClient: () => __mockPrisma,
    PrismaClient: jest.fn(),
    __mockPrisma,
  };
});

const mockPrisma = require('../prisma').__mockPrisma;
const mockLeases = require('./WorkerLeaseService').__mockWorkerLeaseService;
const mockSync = require('./YouTubeSyncService').default;

/**
 * Serve one batch and then an empty one. The worker drains until a batch comes
 * back empty, so a plain mockResolvedValue of a non-empty batch would loop all
 * the way to maxUsers instead of exercising the batch under test.
 */
function mockBatch(users: Array<{ userId: string }>): void {
  (mockPrisma.youTubeIntegration.findMany as jest.Mock)
    .mockResolvedValueOnce(users)
    .mockResolvedValue([]);
}

describe('YouTubeSyncWorkerService', () => {
  let service: YouTubeSyncWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue([]);
    (mockSync.syncVideosForUser as jest.Mock).mockResolvedValue(0);
    service = new YouTubeSyncWorkerService(mockPrisma, mockLeases);
  });

  describe('runSyncWorker', () => {
    it('should return ran=false when lease is held', async () => {
      (mockLeases.acquire as jest.Mock).mockResolvedValue(null);

      const result = await service.runSyncWorker();

      expect(result.ran).toBe(false);
      expect(result.usersSynced).toBe(0);
      // Nothing was acquired, so nothing may be released — releasing here
      // would expire the lease the other live pass is relying on.
      expect(mockLeases.release).not.toHaveBeenCalled();
      expect(mockPrisma.youTubeIntegration.findMany).not.toHaveBeenCalled();
    });

    it('should release lease in finally block when drain throws', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.runSyncWorker()).rejects.toThrow();
      expect(mockLeases.release).toHaveBeenCalledWith(mockLease);
    });

    it('should process batch and return results', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      const result = await service.runSyncWorker();

      expect(result.ran).toBe(true);
      expect(result.done).toBe(true);
      expect(mockLeases.release).toHaveBeenCalledWith(mockLease);
    });
  });

  describe('sync behavior', () => {
    it('should call syncVideosForUser per user in batch', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      mockBatch([{ userId: 'user-1' }, { userId: 'user-2' }]);
      (mockSync.syncVideosForUser as jest.Mock).mockResolvedValue(3);

      await service.runSyncWorker();

      expect(mockSync.syncVideosForUser).toHaveBeenCalledWith('user-1');
      expect(mockSync.syncVideosForUser).toHaveBeenCalledWith('user-2');
    });

    it('should increment usersSynced when sync returns > 0', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      mockBatch([{ userId: 'user-1' }]);
      (mockSync.syncVideosForUser as jest.Mock).mockResolvedValue(5);

      const result = await service.runSyncWorker();

      expect(result.usersSynced).toBe(1);
    });

    it('should not increment usersSynced when sync returns 0', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      mockBatch([{ userId: 'user-1' }]);
      (mockSync.syncVideosForUser as jest.Mock).mockResolvedValue(0);

      const result = await service.runSyncWorker();

      expect(result.usersSynced).toBe(0);
    });

    it('should increment failed and continue on sync error', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      mockBatch([{ userId: 'user-1' }, { userId: 'user-2' }]);
      (mockSync.syncVideosForUser as jest.Mock).mockImplementation(
        async (userId: string) => {
          if (userId === 'user-1') {
            throw new Error('Network error');
          }
          return 5;
        },
      );

      const result = await service.runSyncWorker();

      expect(result.failed).toBe(1);
      expect(result.usersSynced).toBe(1);
      expect(mockSync.syncVideosForUser).toHaveBeenCalledTimes(2);
    });

    it('should mark integration revoked on invalid_grant error', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      mockBatch([{ userId: 'user-1' }]);
      (mockSync.syncVideosForUser as jest.Mock).mockRejectedValue(
        new Error('invalid_grant'),
      );

      await service.runSyncWorker();

      expect(mockPrisma.youTubeIntegration.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { status: 'revoked' },
      });
    });

    it('should mark integration revoked on revoked token error', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      mockBatch([{ userId: 'user-1' }]);
      (mockSync.syncVideosForUser as jest.Mock).mockRejectedValue(
        new Error('Token has been expired or revoked'),
      );

      await service.runSyncWorker();

      expect(mockPrisma.youTubeIntegration.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { status: 'revoked' },
      });
    });
  });
});
