// Mock googleapis
jest.mock('googleapis', () => {
  const mockYoutube = {
    subscriptions: {
      list: jest.fn(),
    },
    channels: {
      list: jest.fn(),
    },
    playlistItems: {
      list: jest.fn(),
    },
    videos: {
      list: jest.fn(),
    },
  };

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          generateAuthUrl: jest
            .fn()
            .mockReturnValue('https://accounts.google.com/o/oauth2/auth?test'),
          getToken: jest.fn().mockResolvedValue({
            tokens: {
              access_token: 'mock-access-token',
              refresh_token: 'mock-refresh-token',
            },
          }),
          setCredentials: jest.fn(),
          revokeToken: jest.fn().mockResolvedValue({}),
          on: jest.fn(),
        })),
      },
      youtube: jest.fn().mockReturnValue(mockYoutube),
    },
  };
});

// Mock encryption
jest.mock('./YouTubeTokenEncryption', () => ({
  encryptToken: jest.fn().mockImplementation((text) => ({
    ciphertext: `encrypted_${text}`,
    iv: 'mock-iv',
    authTag: 'mock-auth-tag',
  })),
  decryptToken: jest
    .fn()
    .mockImplementation((encrypted) =>
      encrypted.ciphertext.replace('encrypted_', ''),
    ),
}));

// Mock Prisma — mock object must be created inside the factory because
// jest.mock is hoisted above all variable declarations.
// We export __mockPrisma so tests can reference mock methods.
jest.mock('../prisma', () => {
  const transaction = {
    youTubeVideo: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
  };

  const __mockPrisma = {
    youTubeIntegration: {
      upsert: jest
        .fn()
        .mockResolvedValue({ userId: 'user-1', status: 'connected' }),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    youTubeSubscription: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    youTubeVideo: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn(),
    },
    youTubeNotificationSettings: {
      upsert: jest.fn().mockResolvedValue({ intervalDays: 7, enabled: true }),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    // Provide a $transaction implementation that passes a transaction-like
    // object to the callback so the service's transactional upserts/deletes
    // can be asserted.
    $transaction: jest.fn().mockImplementation(async (fn: any) => {
      // call the provided function with the transaction stub
      await fn(transaction as any);
      return;
    }),
    // expose the transaction stub so tests can assert on transactional calls
    __transaction: transaction,
  };

  return {
    createPrismaClient: () => __mockPrisma,
    PrismaClient: jest.fn(),
    __mockPrisma,
  };
});

const youtubeSyncService = require('./YouTubeSyncService').default;
const mockPrisma = require('../prisma').__mockPrisma;

describe('YouTubeSyncService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI =
      'http://localhost:3000/api/v1/youtube/callback';
  });

  describe('getAuthUrl', () => {
    it('should generate an OAuth consent URL', () => {
      const url = youtubeSyncService.getAuthUrl('user-1');
      expect(url).toContain('https://accounts.google.com');
    });
  });

  describe('handleOAuthCallback', () => {
    it('should exchange code for tokens and store them encrypted', async () => {
      const result = await youtubeSyncService.handleOAuthCallback(
        'user-1',
        'auth-code',
      );

      expect(result.ok).toBe(true);
      expect(result.message).toContain('connected successfully');
      expect(mockPrisma.youTubeIntegration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({
            userId: 'user-1',
            status: 'connected',
            encrypted_access_token: 'encrypted_mock-access-token',
            encrypted_refresh_token: 'encrypted_mock-refresh-token',
          }),
        }),
      );
    });

    it('should create default notification settings', async () => {
      await youtubeSyncService.handleOAuthCallback('user-1', 'auth-code');

      expect(
        mockPrisma.youTubeNotificationSettings.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({
            userId: 'user-1',
            intervalDays: 7,
            enabled: true,
          }),
        }),
      );
    });
  });

  describe('getStatus', () => {
    it('should return not connected if no integration exists', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const status = await youtubeSyncService.getStatus('user-1');
      expect(status).toEqual({ connected: false, status: 'not_connected' });
    });

    it('should return connected status when integration exists', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        { userId: 'user-1', status: 'connected' },
      );

      const status = await youtubeSyncService.getStatus('user-1');
      expect(status).toEqual({ connected: true, status: 'connected' });
    });

    it('should return false for revoked integration', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        { userId: 'user-1', status: 'revoked' },
      );

      const status = await youtubeSyncService.getStatus('user-1');
      expect(status).toEqual({ connected: false, status: 'revoked' });
    });
  });

  describe('disconnect', () => {
    it('should remove all YouTube data for the user', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        {
          userId: 'user-1',
          encrypted_refresh_token: 'encrypted_mock-token',
          token_iv: 'mock-iv:mock-iv2',
          token_auth_tag: 'mock-tag:mock-tag2',
          status: 'connected',
        },
      );

      const result = await youtubeSyncService.disconnect('user-1');

      expect(result.ok).toBe(true);
      expect(mockPrisma.youTubeVideo.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.youTubeSubscription.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.youTubeIntegration.delete).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should return error if no integration exists', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await youtubeSyncService.disconnect('user-1');
      expect(result.ok).toBe(false);
    });
  });

  describe('getSubscriptions', () => {
    it('should return subscriptions ordered by channel title', async () => {
      const subs = [
        { id: '1', channelTitle: 'Alpha', channelId: 'ch-1' },
        { id: '2', channelTitle: 'Beta', channelId: 'ch-2' },
      ];
      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockResolvedValue(
        subs,
      );

      const result = await youtubeSyncService.getSubscriptions('user-1');
      expect(result).toEqual(subs);
      expect(mockPrisma.youTubeSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { channelTitle: 'asc' },
      });
    });
  });

  describe('toggleSubscription', () => {
    it('should update subscription enabled state', async () => {
      await youtubeSyncService.toggleSubscription('user-1', 'sub-1', false);

      expect(mockPrisma.youTubeSubscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1', userId: 'user-1' },
          data: expect.objectContaining({ enabled: false }),
        }),
      );
    });
  });

  describe('video sync behavior', () => {
    it('should upsert new videos and delete removed videos when snapshot differs', async () => {
      // Setup integration and a single enabled subscription
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        {
          userId: 'user-1',
          encrypted_access_token: 'encrypted_access',
          encrypted_refresh_token: 'encrypted_refresh',
          token_iv: 'iv1:iv2',
          token_auth_tag: 'tag1:tag2',
          status: 'connected',
        },
      );

      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sub-1',
          userId: 'user-1',
          channelId: 'ch-1',
          uploadsPlaylistId: 'pl-1',
          enabled: true,
        },
      ]);

      // Existing DB has three videos; snapshot will contain two (one new)
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Old title',
          thumbnail: 't1',
          publishedAt: new Date('2026-01-01'),
          watched: true,
        },
        {
          videoId: 'v2',
          title: 'Keep',
          thumbnail: 't2',
          publishedAt: new Date('2026-01-02'),
        },
        {
          videoId: 'v3',
          title: 'DeleteMe',
          thumbnail: 't3',
          publishedAt: new Date('2026-01-03'),
          watched: true,
        },
      ]);

      const mockYoutube = require('googleapis').google.youtube();
      mockYoutube.playlistItems.list.mockResolvedValue({
        data: {
          items: [
            { snippet: { resourceId: { videoId: 'v1' } } },
            { snippet: { resourceId: { videoId: 'v4' } } },
          ],
        },
      });

      mockYoutube.videos.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'v1',
              snippet: {
                title: 'Updated title',
                thumbnails: { medium: { url: 'updated-t1' } },
                publishedAt: '2026-01-05T00:00:00Z',
              },
            },
            {
              id: 'v4',
              snippet: {
                title: 'New Video',
                thumbnails: { medium: { url: 't4' } },
                publishedAt: '2026-01-04T00:00:00Z',
              },
            },
          ],
        },
      });

      const result =
        await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      // Transactional upserts should have been invoked for snapshot items
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(
        mockPrisma.__transaction.youTubeVideo.upsert,
      ).toHaveBeenCalledTimes(2);

      expect(mockPrisma.__transaction.youTubeVideo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_videoId: { userId: 'user-1', videoId: 'v1' } },
          update: {
            channelId: 'ch-1',
            title: 'Updated title',
            thumbnail: 'updated-t1',
            publishedAt: new Date('2026-01-05T00:00:00Z'),
          },
        }),
      );

      const v1Upsert = (
        mockPrisma.__transaction.youTubeVideo.upsert as jest.Mock
      ).mock.calls.find(
        ([payload]) => payload.where.userId_videoId.videoId === 'v1',
      );
      expect(v1Upsert?.[0].update).not.toHaveProperty('watched');

      expect(mockPrisma.__transaction.youTubeVideo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_videoId: { userId: 'user-1', videoId: 'v4' } },
          create: expect.not.objectContaining({ watched: true }),
        }),
      );

      // Deleted videos should be pruned (videoId not in snapshot)
      expect(
        mockPrisma.__transaction.youTubeVideo.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          channelId: 'ch-1',
          videoId: { notIn: ['v1', 'v4'] },
        },
      });

      expect(result.videosSynced).toBe(2);
    });

    it('should cap a successful snapshot at 100 videos', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        {
          userId: 'user-1',
          encrypted_access_token: 'encrypted_access',
          encrypted_refresh_token: 'encrypted_refresh',
          token_iv: 'iv1:iv2',
          token_auth_tag: 'tag1:tag2',
          status: 'connected',
        },
      );

      (mockPrisma.youTubeSubscription.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'sub-1',
            userId: 'user-1',
            channelId: 'ch-1',
            uploadsPlaylistId: 'pl-1',
            enabled: true,
          },
        ]);
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);

      const videoIds = Array.from(
        { length: 100 },
        (_, index) => `v${index + 1}`,
      );
      const mockYoutube = require('googleapis').google.youtube();
      mockYoutube.playlistItems.list
        .mockResolvedValueOnce({
          data: {
            items: videoIds.slice(0, 50).map((videoId) => ({
              snippet: { resourceId: { videoId } },
            })),
            nextPageToken: 'page-2',
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: videoIds.slice(50).map((videoId) => ({
              snippet: { resourceId: { videoId } },
            })),
          },
        });
      mockYoutube.videos.list.mockResolvedValue({
        data: {
          items: videoIds.map((videoId) => ({
            id: videoId,
            snippet: {
              title: `Video ${videoId}`,
              thumbnails: { medium: { url: `https://img.test/${videoId}` } },
              publishedAt: '2026-01-01T00:00:00Z',
            },
          })),
        },
      });

      const result =
        await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      expect(result.videosSynced).toBe(100);
      expect(
        mockPrisma.__transaction.youTubeVideo.upsert,
      ).toHaveBeenCalledTimes(100);
    });

    it('should not perform transaction when snapshot is unchanged', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        {
          userId: 'user-1',
          encrypted_access_token: 'encrypted_access',
          encrypted_refresh_token: 'encrypted_refresh',
          token_iv: 'iv1:iv2',
          token_auth_tag: 'tag1:tag2',
          status: 'connected',
        },
      );

      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sub-1',
          userId: 'user-1',
          channelId: 'ch-1',
          uploadsPlaylistId: 'pl-1',
          enabled: true,
        },
      ]);

      // Existing DB and snapshot will match exactly
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Same',
          thumbnail: 't1',
          publishedAt: new Date('2026-01-01'),
        },
      ]);

      const mockYoutube = require('googleapis').google.youtube();
      mockYoutube.playlistItems.list.mockResolvedValue({
        data: { items: [{ snippet: { resourceId: { videoId: 'v1' } } }] },
      });
      mockYoutube.videos.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'v1',
              snippet: {
                title: 'Same',
                thumbnails: { medium: { url: 't1' } },
                publishedAt: '2026-01-01T00:00:00Z',
              },
            },
          ],
        },
      });

      const result =
        await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result.videosSynced).toBe(0);
    });

    it('should retain last-good snapshot on fetch failure', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        {
          userId: 'user-1',
          encrypted_access_token: 'encrypted_access',
          encrypted_refresh_token: 'encrypted_refresh',
          token_iv: 'iv1:iv2',
          token_auth_tag: 'tag1:tag2',
          status: 'connected',
        },
      );

      (mockPrisma.youTubeSubscription.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'sub-1',
            userId: 'user-1',
            channelId: 'ch-err',
            uploadsPlaylistId: 'pl-err',
            enabled: true,
          },
        ]);

      const mockYoutube = require('googleapis').google.youtube();
      mockYoutube.playlistItems.list.mockRejectedValue(
        new Error('network failure'),
      );

      await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      // Should mark lastSyncStatus as failed and should not have deleted cached rows
      expect(mockPrisma.youTubeIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: expect.objectContaining({ lastSyncStatus: 'failed' }),
        }),
      );

      expect(mockPrisma.youTubeVideo.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.youTubeSubscription.update).not.toHaveBeenCalled();
    });

    it('should prune expired disabled channel videos during sync', async () => {
      // First call: pruneExpiredDisabledVideos should find expired subs
      (mockPrisma.youTubeSubscription.findMany as jest.Mock)
        .mockResolvedValueOnce([{ channelId: 'ch-expired' }])
        .mockResolvedValueOnce([]); // enabled subs after prune

      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        {
          userId: 'user-1',
          status: 'connected',
        },
      );

      await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      expect(mockPrisma.youTubeVideo.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', channelId: { in: ['ch-expired'] } },
        }),
      );
    });

    it('manualRefresh should claim and invoke sync when not in cooldown', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        {
          userId: 'user-1',
          status: 'connected',
          lastManualRefreshAt: null,
        },
      );

      (mockPrisma.youTubeIntegration.updateMany as jest.Mock).mockResolvedValue(
        { count: 1 },
      );

      const subsSpy = jest
        .spyOn(youtubeSyncService, 'syncSubscriptions')
        .mockResolvedValue([]);
      const videosSpy = jest
        .spyOn(youtubeSyncService, 'syncVideosForUserWithStatus')
        .mockResolvedValue({
          subscriptionsSynced: 0,
          videosSynced: 0,
          status: 'success',
          lastSyncedAt: null,
          lastSyncAttemptAt: null,
          lastSyncError: null,
          retryAt: null,
        });

      const result = await youtubeSyncService.manualRefresh('user-1');

      expect(subsSpy).toHaveBeenCalled();
      expect(videosSpy).toHaveBeenCalled();
      expect(result.status).toBeDefined();
    });

    it('manualRefresh should return cooldown when called too soon', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        {
          userId: 'user-1',
          status: 'connected',
          lastManualRefreshAt: new Date(),
        },
      );

      const subsSpy = jest.spyOn(youtubeSyncService, 'syncSubscriptions');
      const result = await youtubeSyncService.manualRefresh('user-1');

      expect(result.status).toBe('cooldown');
      expect(subsSpy).not.toHaveBeenCalled();
    });

    it('should stop processing channels on quotaExceeded and report quota_exceeded', async () => {
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          userId: 'user-1',
          encrypted_access_token: 'encrypted_access',
          encrypted_refresh_token: 'encrypted_refresh',
          token_iv: 'iv1:iv2',
          token_auth_tag: 'tag1:tag2',
          status: 'connected',
        })
        .mockResolvedValueOnce({
          userId: 'user-1',
          status: 'connected',
          lastSyncStatus: 'quota_exceeded',
          lastSyncError: 'quotaExceeded',
        });

      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockResolvedValue([
        {
          id: 's1',
          channelId: 'c1',
          uploadsPlaylistId: 'p1',
          userId: 'user-1',
          enabled: true,
        },
        {
          id: 's2',
          channelId: 'c2',
          uploadsPlaylistId: 'p2',
          userId: 'user-1',
          enabled: true,
        },
      ]);

      const mockYoutube = require('googleapis').google.youtube();
      mockYoutube.playlistItems.list.mockRejectedValueOnce(
        new Error('quotaExceeded'),
      );

      const result =
        await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      expect(mockYoutube.playlistItems.list).toHaveBeenCalledTimes(1);
      expect(mockPrisma.youTubeIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: expect.objectContaining({
            lastSyncStatus: 'quota_exceeded',
            lastSyncError: 'quotaExceeded',
          }),
        }),
      );
      expect(result.status).toBe('quota_exceeded');
    });
  });

  describe('getVideos', () => {
    it('should query with correct sort order for latest', async () => {
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.youTubeVideo.count as jest.Mock).mockResolvedValue(0);

      const result = await youtubeSyncService.getVideos('user-1', {
        sort: 'latest',
      });

      expect(result.page).toBe(1);
      expect(result.videos).toEqual([]);
      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { publishedAt: 'desc' },
        }),
      );
    });

    it('should query with A-Z sort', async () => {
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.youTubeVideo.count as jest.Mock).mockResolvedValue(0);

      await youtubeSyncService.getVideos('user-1', { sort: 'az' });

      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'asc' },
        }),
      );
    });

    it('should include search filter when provided', async () => {
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.youTubeVideo.count as jest.Mock).mockResolvedValue(0);

      await youtubeSyncService.getVideos('user-1', {
        search: 'tutorial',
      });

      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            title: { contains: 'tutorial', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should paginate correctly', async () => {
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.youTubeVideo.count as jest.Mock).mockResolvedValue(50);

      const result = await youtubeSyncService.getVideos('user-1', {
        page: 2,
        limit: 10,
      });

      expect(result.totalPages).toBe(5);
      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe('setVideoWatched', () => {
    it('should update watched state to true and return affected count', async () => {
      (mockPrisma.youTubeVideo.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const count = await youtubeSyncService.setVideoWatched(
        'user-1',
        'v1',
        true,
      );

      expect(mockPrisma.youTubeVideo.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', videoId: 'v1' },
        data: { watched: true },
      });
      expect(count).toBe(1);
    });

    it('should update watched state to false and return affected count', async () => {
      (mockPrisma.youTubeVideo.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const count = await youtubeSyncService.setVideoWatched(
        'user-1',
        'v1',
        false,
      );

      expect(mockPrisma.youTubeVideo.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', videoId: 'v1' },
        data: { watched: false },
      });
      expect(count).toBe(1);
    });

    it('should return 0 when no video matched the criteria', async () => {
      (mockPrisma.youTubeVideo.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const count = await youtubeSyncService.setVideoWatched(
        'user-1',
        'v-nonexistent',
        true,
      );

      expect(mockPrisma.youTubeVideo.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', videoId: 'v-nonexistent' },
        data: { watched: true },
      });
      expect(count).toBe(0);
    });
  });

  describe('getNotificationSettings', () => {
    it('should return stored settings', async () => {
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        intervalDays: 3,
        enabled: false,
        lastNotifiedAt: null,
      });

      const settings =
        await youtubeSyncService.getNotificationSettings('user-1');
      expect(settings.intervalDays).toBe(3);
      expect(settings.enabled).toBe(false);
    });

    it('should return defaults when no settings exist', async () => {
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue(null);

      const settings =
        await youtubeSyncService.getNotificationSettings('user-1');
      expect(settings.intervalDays).toBe(7);
      expect(settings.enabled).toBe(true);
    });
  });

  describe('updateNotificationSettings', () => {
    it('should reject interval below 2', async () => {
      await expect(
        youtubeSyncService.updateNotificationSettings('user-1', {
          intervalDays: 1,
        }),
      ).rejects.toThrow('between 2 and 15');
    });

    it('should reject interval above 15', async () => {
      await expect(
        youtubeSyncService.updateNotificationSettings('user-1', {
          intervalDays: 16,
        }),
      ).rejects.toThrow('between 2 and 15');
    });

    it('should accept valid interval', async () => {
      await youtubeSyncService.updateNotificationSettings('user-1', {
        intervalDays: 5,
      });

      expect(
        mockPrisma.youTubeNotificationSettings.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          update: { intervalDays: 5 },
        }),
      );
    });
  });
});
