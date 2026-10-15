jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  })),
  format: { json: jest.fn(() => ({})) },
  transports: { Console: jest.fn() },
}));

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
  const __mockMarkRevoked = jest.fn().mockResolvedValue(false);
  const __mockDisconnect = jest.fn().mockResolvedValue({
    ok: true,
    message: 'YouTube account disconnected.',
  });
  return {
    __esModule: true,
    default: {
      syncVideosForUser: __mockSync,
      markRevokedIfTokenError: __mockMarkRevoked,
      disconnect: __mockDisconnect,
    },
    __mockSync,
    __mockMarkRevoked,
    __mockDisconnect,
  };
});

jest.mock('../prisma', () => {
  const __mockPrisma = {
    youTubeIntegration: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    youTubeWorkerLease: {
      findUnique: jest.fn(),
    },
  };

  return {
    createPrismaClient: () => __mockPrisma,
    PrismaClient: jest.fn(),
    __mockPrisma,
  };
});

const workerWinston = require('winston');
const {
  YouTubeSyncWorkerService,
  SWEEP_TIME_BUDGET_MS,
} = require('./YouTubeSyncWorkerService');
const workerMockLogger = jest.mocked(workerWinston.createLogger).mock.results[0]
  .value;
const workerMockPrisma = require('../prisma').__mockPrisma;
const mockLeases = require('./WorkerLeaseService').__mockWorkerLeaseService;
const mockSync = require('./YouTubeSyncService').default;

/**
 * Serve one batch and then an empty one. The worker drains until a batch comes
 * back empty, so a plain mockResolvedValue of a non-empty batch would loop all
 * the way to maxUsers instead of exercising the batch under test.
 */
function mockBatch(users: Array<{ userId: string }>): void {
  (workerMockPrisma.youTubeIntegration.findMany as jest.Mock)
    .mockResolvedValueOnce(users)
    .mockResolvedValue([]);
}

/** Fixed clock for the ADR 0129 sweep: a Revoked row is expired once it is 7 days old. */
const NOW = new Date('2026-10-14T12:00:00Z');
const SWEEP_CUTOFF = new Date('2026-10-07T12:00:00Z');
/** Far enough ahead that a lease never lapses under the fake clock by accident. */
const FAR_FUTURE = new Date('2099-01-01T00:00:00Z');
const HELD_LEASE = { owner: 'owner-1', expiresAt: FAR_FUTURE };

describe('YouTubeSyncWorkerService', () => {
  let service: InstanceType<typeof YouTubeSyncWorkerService>;

  beforeEach(() => {
    jest.clearAllMocks();
    (workerMockPrisma.youTubeIntegration.findMany as jest.Mock).mockReset();
    (
      workerMockPrisma.youTubeIntegration.findMany as jest.Mock
    ).mockResolvedValue([]);
    (workerMockPrisma.youTubeIntegration.updateMany as jest.Mock).mockReset();
    (
      workerMockPrisma.youTubeIntegration.updateMany as jest.Mock
    ).mockResolvedValue({ count: 0 });
    (workerMockPrisma.youTubeWorkerLease.findUnique as jest.Mock).mockReset();
    (
      workerMockPrisma.youTubeWorkerLease.findUnique as jest.Mock
    ).mockResolvedValue(HELD_LEASE);
    (mockSync.disconnect as jest.Mock).mockReset();
    (mockSync.disconnect as jest.Mock).mockResolvedValue({
      ok: true,
      message: 'YouTube account disconnected.',
    });
    (mockSync.syncVideosForUser as jest.Mock).mockResolvedValue(0);
    service = new YouTubeSyncWorkerService(workerMockPrisma, mockLeases);
  });

  describe('runSyncWorker', () => {
    it('should return ran=false when lease is held', async () => {
      (mockLeases.acquire as jest.Mock).mockResolvedValue(null);

      const result = await service.runSyncWorker();

      expect(result.ran).toBe(false);
      expect(result.usersSynced).toBe(0);
      expect(result.revokedStamped).toBe(0);
      expect(result.disconnectedRevoked).toBe(0);
      expect(result.disconnectedNoAccess).toBe(0);
      expect(result.skippedLive).toBe(0);
      expect(result.sweepFailed).toBe(0);
      // Nothing was acquired, so nothing may be released — releasing here
      // would expire the lease the other live pass is relying on.
      expect(mockLeases.release).not.toHaveBeenCalled();
      expect(
        workerMockPrisma.youTubeIntegration.findMany,
      ).not.toHaveBeenCalled();
      // ADR 0129: no sweep runs without the lease either.
      expect(
        workerMockPrisma.youTubeIntegration.updateMany,
      ).not.toHaveBeenCalled();
      expect(
        workerMockPrisma.youTubeWorkerLease.findUnique,
      ).not.toHaveBeenCalled();
      expect(mockSync.disconnect).not.toHaveBeenCalled();
    });

    it('should release lease in finally block when drain throws', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      (
        workerMockPrisma.youTubeIntegration.findMany as jest.Mock
      ).mockRejectedValue(new Error('Database error'));

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
      (
        workerMockPrisma.youTubeIntegration.findMany as jest.Mock
      ).mockResolvedValue([]);

      const result = await service.runSyncWorker();

      expect(result.ran).toBe(true);
      expect(result.done).toBe(true);
      expect(result.revokedStamped).toBe(0);
      expect(result.disconnectedRevoked).toBe(0);
      expect(result.disconnectedNoAccess).toBe(0);
      expect(result.skippedLive).toBe(0);
      expect(result.sweepFailed).toBe(0);
      expect(mockLeases.release).toHaveBeenCalledWith(mockLease);
    });

    it('should only query connected integrations whose User has YouTube Access', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);

      await service.runSyncWorker();

      // The access filter lives in the query, so a User without access is
      // never handed to syncVideosForUser.
      const call = (workerMockPrisma.youTubeIntegration.findMany as jest.Mock)
        .mock.calls[0][0];
      expect(call.where).toEqual({
        status: 'connected',
        user: { youtube_access: true },
      });
    });
  });

  describe('disconnect sweep (ADR 0129)', () => {
    type Candidate = {
      userId: string;
      status: 'revoked' | 'connected';
      revokedAt: Date | null;
    };

    const expiredRevoked = (userId: string): Candidate => ({
      userId,
      status: 'revoked',
      revokedAt: new Date('2026-10-01T12:00:00Z'),
    });

    const noAccess = (userId: string): Candidate => ({
      userId,
      status: 'connected',
      revokedAt: null,
    });

    /** Route the sweep's candidate read (the only query with an OR) to `candidates`; the drain reads nothing. */
    function mockSweepCandidates(candidates: Candidate[]): void {
      (
        workerMockPrisma.youTubeIntegration.findMany as jest.Mock
      ).mockImplementation(async (args: { where?: object }) =>
        args.where !== undefined && 'OR' in args.where ? candidates : [],
      );
    }

    function findSweepArgs(): {
      where: { OR: unknown[] };
      orderBy: unknown;
      take: number;
    } {
      const call = (
        workerMockPrisma.youTubeIntegration.findMany as jest.Mock
      ).mock.calls.find(
        ([args]: [{ where?: object }]) =>
          args.where !== undefined && 'OR' in args.where,
      );
      if (!call) {
        throw new Error('the sweep candidate query was not issued');
      }
      return call[0];
    }

    beforeEach(() => {
      jest.useFakeTimers({
        now: NOW,
        doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
      });
      (mockLeases.acquire as jest.Mock).mockResolvedValue({
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('disconnects a Connection Revoked for the full seven days and counts it as revoked', async () => {
      mockSweepCandidates([expiredRevoked('user-1')]);

      const result = await service.runSyncWorker();

      expect(mockSync.disconnect).toHaveBeenCalledTimes(1);
      expect(mockSync.disconnect).toHaveBeenCalledWith('user-1', {
        expectRevokeFailure: true,
      });
      expect(result.disconnectedRevoked).toBe(1);
      expect(result.disconnectedNoAccess).toBe(0);
    });

    it('reads only Revoked rows at or past the seven-day cutoff or Users without access, bounded to 25 and oldest-first', async () => {
      // A row Revoked for under seven days, or reconnected (status connected
      // with no access change), fails the query and is never handed back.
      mockSweepCandidates([]);

      await service.runSyncWorker();

      const sweepArgs = findSweepArgs();
      expect(sweepArgs.where).toEqual({
        OR: [
          { status: 'revoked', revokedAt: { lte: SWEEP_CUTOFF } },
          { user: { youtube_access: false } },
        ],
      });
      expect(sweepArgs.take).toBe(25);
      expect(sweepArgs.orderBy).toEqual({ userId: 'asc' });
      expect(mockSync.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects a User who no longer has YouTube Access and counts it as no-access', async () => {
      mockSweepCandidates([noAccess('user-2')]);

      const result = await service.runSyncWorker();

      expect(mockSync.disconnect).toHaveBeenCalledWith('user-2', {
        expectRevokeFailure: false,
      });
      expect(result.disconnectedNoAccess).toBe(1);
      expect(result.disconnectedRevoked).toBe(0);
    });

    it('leaves a Connection with a live Channel Sync or Upload Sync for a later pass and still processes the next candidate', async () => {
      mockSweepCandidates([expiredRevoked('user-1'), expiredRevoked('user-2')]);
      (mockSync.disconnect as jest.Mock).mockImplementation(
        async (userId: string) =>
          userId === 'user-1'
            ? {
                ok: false,
                code: 'sync_run_live',
                message: 'A YouTube sync is running.',
              }
            : { ok: true, message: 'YouTube account disconnected.' },
      );

      const result = await service.runSyncWorker();

      expect(result.skippedLive).toBe(1);
      expect(result.disconnectedRevoked).toBe(1);
      expect(mockSync.disconnect).toHaveBeenNthCalledWith(1, 'user-1', {
        expectRevokeFailure: true,
      });
      expect(mockSync.disconnect).toHaveBeenNthCalledWith(2, 'user-2', {
        expectRevokeFailure: true,
      });
    });

    it('stops once the time budget is spent and leaves the remaining candidates for the next pass', async () => {
      mockSweepCandidates([
        expiredRevoked('user-1'),
        expiredRevoked('user-2'),
        expiredRevoked('user-3'),
      ]);
      (mockSync.disconnect as jest.Mock).mockImplementation(
        async (userId: string) => {
          if (userId === 'user-1') {
            jest.advanceTimersByTime(SWEEP_TIME_BUDGET_MS);
          }
          return { ok: true, message: 'YouTube account disconnected.' };
        },
      );

      const result = await service.runSyncWorker();

      expect(mockSync.disconnect).toHaveBeenCalledTimes(1);
      expect(mockSync.disconnect).toHaveBeenCalledWith('user-1', {
        expectRevokeFailure: true,
      });
      expect(result.disconnectedRevoked).toBe(1);
    });

    it.each([
      ['owner changed', { owner: 'owner-2', expiresAt: FAR_FUTURE }],
      [
        'expired',
        { owner: 'owner-1', expiresAt: new Date('2026-10-14T11:59:00Z') },
      ],
    ])(
      'stops when the worker lease is lost (%s) and leaves the remaining candidates untouched',
      async (_label, lostLease) => {
        mockSweepCandidates([
          expiredRevoked('user-1'),
          expiredRevoked('user-2'),
          expiredRevoked('user-3'),
        ]);
        (workerMockPrisma.youTubeWorkerLease.findUnique as jest.Mock)
          .mockResolvedValueOnce(HELD_LEASE)
          .mockResolvedValueOnce(lostLease);

        const result = await service.runSyncWorker();

        expect(mockSync.disconnect).toHaveBeenCalledTimes(1);
        expect(mockSync.disconnect).toHaveBeenCalledWith('user-1', {
          expectRevokeFailure: true,
        });
        expect(result.disconnectedRevoked).toBe(1);
      },
    );

    it('stamps pre-existing Revoked rows that have no revokedAt, using the pass clock', async () => {
      (
        workerMockPrisma.youTubeIntegration.updateMany as jest.Mock
      ).mockResolvedValue({ count: 3 });
      mockSweepCandidates([]);

      const result = await service.runSyncWorker();

      expect(
        workerMockPrisma.youTubeIntegration.updateMany,
      ).toHaveBeenCalledWith({
        where: { status: 'revoked', revokedAt: null },
        data: { revokedAt: NOW },
      });
      expect(result.revokedStamped).toBe(3);
    });

    it('logs a failed candidate once, counts it, and still processes the next candidate', async () => {
      mockSweepCandidates([expiredRevoked('user-1'), expiredRevoked('user-2')]);
      const sweepError = new Error('boom');
      (mockSync.disconnect as jest.Mock).mockImplementation(
        async (userId: string) => {
          if (userId === 'user-1') {
            throw sweepError;
          }
          return { ok: true, message: 'YouTube account disconnected.' };
        },
      );

      const result = await service.runSyncWorker();

      expect(result.sweepFailed).toBe(1);
      expect(result.disconnectedRevoked).toBe(1);
      expect(mockSync.disconnect).toHaveBeenCalledWith('user-2', {
        expectRevokeFailure: true,
      });
      expect(workerMockLogger.error).toHaveBeenCalledTimes(1);
      expect(workerMockLogger.error).toHaveBeenCalledWith(
        'YouTube disconnect sweep failed for user user-1: boom',
        { stack: sweepError.stack },
      );
    });

    it('propagates a rejected candidate read out of runSyncWorker and still releases the lease', async () => {
      const readError = new Error('candidate read failed');
      (
        workerMockPrisma.youTubeIntegration.findMany as jest.Mock
      ).mockImplementation(async (args: { where?: object }) => {
        if (args.where !== undefined && 'OR' in args.where) {
          throw readError;
        }
        return [];
      });
      const lease = { name: 'youtube-sync', owner: 'owner-1', cursor: null };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(lease);

      await expect(service.runSyncWorker()).rejects.toThrow(readError);

      expect(mockSync.disconnect).not.toHaveBeenCalled();
      expect(mockLeases.release).toHaveBeenCalledWith(lease);
    });

    it('propagates a rejected stamp out of runSyncWorker and still releases the lease', async () => {
      const stampError = new Error('stamp failed');
      (
        workerMockPrisma.youTubeIntegration.updateMany as jest.Mock
      ).mockRejectedValueOnce(stampError);
      mockSweepCandidates([expiredRevoked('user-1')]);
      const lease = { name: 'youtube-sync', owner: 'owner-1', cursor: null };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(lease);

      await expect(service.runSyncWorker()).rejects.toThrow(stampError);

      // The stamp runs first, so the sweep's candidate read (the query with an OR) is never issued.
      const sweepReads = (
        workerMockPrisma.youTubeIntegration.findMany as jest.Mock
      ).mock.calls.filter(
        ([args]: [{ where?: object }]) =>
          args.where !== undefined && 'OR' in args.where,
      );
      expect(sweepReads).toHaveLength(0);
      expect(mockSync.disconnect).not.toHaveBeenCalled();
      expect(mockLeases.release).toHaveBeenCalledWith(lease);
    });

    it('treats a non-live disconnect refusal as neither counted nor failed, and moves on to the next candidate', async () => {
      mockSweepCandidates([expiredRevoked('user-1'), expiredRevoked('user-2')]);
      (mockSync.disconnect as jest.Mock).mockImplementation(
        async (userId: string) =>
          userId === 'user-1'
            ? { ok: false, message: 'No YouTube integration found.' }
            : { ok: true, message: 'YouTube account disconnected.' },
      );

      const result = await service.runSyncWorker();

      expect(mockSync.disconnect).toHaveBeenNthCalledWith(1, 'user-1', {
        expectRevokeFailure: true,
      });
      expect(mockSync.disconnect).toHaveBeenNthCalledWith(2, 'user-2', {
        expectRevokeFailure: true,
      });
      expect(result.disconnectedRevoked).toBe(1);
      expect(result.disconnectedNoAccess).toBe(0);
      expect(result.skippedLive).toBe(0);
      expect(result.sweepFailed).toBe(0);
      expect(workerMockLogger.error).not.toHaveBeenCalled();
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
      const networkError = new Error('Network error');
      (mockSync.syncVideosForUser as jest.Mock).mockImplementation(
        async (userId: string) => {
          if (userId === 'user-1') {
            throw networkError;
          }
          return 5;
        },
      );

      const result = await service.runSyncWorker();

      expect(result.failed).toBe(1);
      expect(result.usersSynced).toBe(1);
      expect(mockSync.syncVideosForUser).toHaveBeenCalledTimes(2);
      expect(workerMockLogger.error).toHaveBeenCalledTimes(1);
      expect(workerMockLogger.error).toHaveBeenCalledWith(
        'YouTube sync failed for user user-1: Network error',
        { stack: networkError.stack },
      );
    });

    it('should log a non-Error rejection once with a quoted message and no stack', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      mockBatch([{ userId: 'user-1' }]);
      (mockSync.syncVideosForUser as jest.Mock).mockRejectedValue(
        'plain failure',
      );

      const result = await service.runSyncWorker();

      expect(result.failed).toBe(1);
      expect(workerMockLogger.error).toHaveBeenCalledTimes(1);
      expect(workerMockLogger.error).toHaveBeenCalledWith(
        'YouTube sync failed for user user-1: "plain failure"',
      );
      expect(workerMockPrisma.youTubeIntegration.update).not.toHaveBeenCalled();
    });

    it('should mark integration revoked on invalid_grant error', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      const revokedError = new Error('invalid_grant');
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      mockBatch([{ userId: 'user-1' }]);
      (mockSync.syncVideosForUser as jest.Mock).mockRejectedValue(revokedError);
      (mockSync.markRevokedIfTokenError as jest.Mock).mockResolvedValue(true);

      await service.runSyncWorker();

      expect(mockSync.markRevokedIfTokenError).toHaveBeenCalledWith(
        'user-1',
        revokedError,
      );
    });

    it('should mark integration revoked on revoked token error', async () => {
      const mockLease = {
        name: 'youtube-sync',
        owner: 'owner-1',
        cursor: null,
      };
      const revokedError = new Error('Token has been expired or revoked');
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      mockBatch([{ userId: 'user-1' }]);
      (mockSync.syncVideosForUser as jest.Mock).mockRejectedValue(revokedError);
      (mockSync.markRevokedIfTokenError as jest.Mock).mockResolvedValue(true);

      await service.runSyncWorker();

      expect(mockSync.markRevokedIfTokenError).toHaveBeenCalledWith(
        'user-1',
        revokedError,
      );
    });
  });
});
