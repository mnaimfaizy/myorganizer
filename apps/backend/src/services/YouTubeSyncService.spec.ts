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

    it('should seed notification settings with the digest opted out', async () => {
      await youtubeSyncService.handleOAuthCallback('user-1', 'auth-code');

      expect(
        mockPrisma.youTubeNotificationSettings.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({
            userId: 'user-1',
            intervalDays: 7,
            // The weekly digest is opt-in: connecting must not start mailing.
            enabled: false,
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
          durationSeconds: null,
          watched: true,
        },
        {
          videoId: 'v2',
          title: 'Keep',
          thumbnail: 't2',
          publishedAt: new Date('2026-01-02'),
          durationSeconds: null,
        },
        {
          videoId: 'v3',
          title: 'DeleteMe',
          thumbnail: 't3',
          publishedAt: new Date('2026-01-03'),
          durationSeconds: null,
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
            durationSeconds: null,
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

      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockImplementation(
        (args: { where?: { enabled?: boolean } }) => {
          if (args?.where?.enabled === true) {
            return [
              {
                id: 'sub-1',
                userId: 'user-1',
                channelId: 'ch-1',
                uploadsPlaylistId: 'pl-1',
                enabled: true,
              },
            ];
          }
          return [];
        },
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);

      const videoIds = Array.from(
        { length: 100 },
        (_, index) => `v${index + 1}`,
      );
      const mockYoutube = require('googleapis').google.youtube();
      mockYoutube.playlistItems.list.mockImplementation(
        (args: { pageToken?: string }) => {
          if (args?.pageToken === 'page-2') {
            return {
              data: {
                items: videoIds.slice(50).map((videoId) => ({
                  snippet: { resourceId: { videoId } },
                })),
              },
            };
          }
          return {
            data: {
              items: videoIds.slice(0, 50).map((videoId) => ({
                snippet: { resourceId: { videoId } },
              })),
              nextPageToken: 'page-2',
            },
          };
        },
      );
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

      // Existing DB and snapshot will match exactly (including durationSeconds)
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Same',
          thumbnail: 't1',
          publishedAt: new Date('2026-01-01'),
          durationSeconds: null,
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
              // No contentDetails means durationSeconds will be null, matching existing
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

      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockImplementation(
        (args: { where?: { enabled?: boolean } }) => {
          if (args?.where?.enabled === true) {
            return [
              {
                id: 'sub-1',
                userId: 'user-1',
                channelId: 'ch-err',
                uploadsPlaylistId: 'pl-err',
                enabled: true,
              },
            ];
          }
          return [];
        },
      );

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
      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockImplementation(
        (args: { where?: { enabled?: boolean } }) => {
          if (args?.where?.enabled === false) {
            return [{ channelId: 'ch-expired' }];
          }
          return [];
        },
      );

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
      (mockPrisma.youTubeIntegration.findUnique as jest.Mock).mockResolvedValue(
        {
          userId: 'user-1',
          encrypted_access_token: 'encrypted_access',
          encrypted_refresh_token: 'encrypted_refresh',
          token_iv: 'iv1:iv2',
          token_auth_tag: 'tag1:tag2',
          status: 'connected',
          lastSyncStatus: 'quota_exceeded',
          lastSyncError: 'quotaExceeded',
        },
      );

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
        enabled: true,
        lastNotifiedAt: null,
        preferredWeekday: 4,
        timeZone: 'Australia/Sydney',
      });

      const settings =
        await youtubeSyncService.getNotificationSettings('user-1');
      expect(settings.enabled).toBe(true);
      expect(settings.preferredWeekday).toBe(4);
      expect(settings.timeZone).toBe('Australia/Sydney');
    });

    it('should return defaults when no settings exist', async () => {
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue(null);

      const settings =
        await youtubeSyncService.getNotificationSettings('user-1');
      // Absent settings read as opted out, never as opted in.
      expect(settings.enabled).toBe(false);
      expect(settings.preferredWeekday).toBe(1);
      expect(settings.timeZone).toBeNull();
    });
  });

  describe('updateNotificationSettings', () => {
    it('should reject a weekday outside 0-6', async () => {
      await expect(
        youtubeSyncService.updateNotificationSettings('user-1', {
          preferredWeekday: 7,
        }),
      ).rejects.toThrow('0 (Sunday) to 6 (Saturday)');
    });

    it('should reject a non-integer weekday', async () => {
      await expect(
        youtubeSyncService.updateNotificationSettings('user-1', {
          preferredWeekday: 2.5,
        }),
      ).rejects.toThrow('0 (Sunday) to 6 (Saturday)');
    });

    it('should reject an unknown IANA time zone', async () => {
      await expect(
        youtubeSyncService.updateNotificationSettings('user-1', {
          timeZone: 'Mars/Olympus_Mons',
        }),
      ).rejects.toThrow('valid IANA identifier');
    });

    it('should accept a valid weekday and time zone', async () => {
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({ optedInAt: new Date('2026-01-01') });

      await youtubeSyncService.updateNotificationSettings('user-1', {
        preferredWeekday: 5,
        timeZone: 'Australia/Sydney',
      });

      expect(
        mockPrisma.youTubeNotificationSettings.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          update: { preferredWeekday: 5, timeZone: 'Australia/Sydney' },
        }),
      );
    });

    it('should stamp optedInAt the first time the digest is enabled', async () => {
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({ optedInAt: null });

      await youtubeSyncService.updateNotificationSettings('user-1', {
        enabled: true,
      });

      const call = (mockPrisma.youTubeNotificationSettings.upsert as jest.Mock)
        .mock.calls[0][0];
      expect(call.update.optedInAt).toBeInstanceOf(Date);
    });

    it('should not restamp optedInAt when the digest is re-enabled', async () => {
      const originalOptIn = new Date('2026-01-01');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({ optedInAt: originalOptIn });

      await youtubeSyncService.updateNotificationSettings('user-1', {
        enabled: true,
      });

      const call = (mockPrisma.youTubeNotificationSettings.upsert as jest.Mock)
        .mock.calls[0][0];
      expect(call.update.optedInAt).toBeUndefined();
    });
  });

  describe('parseIso8601DurationSeconds', () => {
    const { parseIso8601DurationSeconds } = require('./YouTubeSyncService');

    it('should parse seconds only', () => {
      expect(parseIso8601DurationSeconds('PT30S')).toBe(30);
      expect(parseIso8601DurationSeconds('PT1S')).toBe(1);
    });

    it('should parse minutes', () => {
      expect(parseIso8601DurationSeconds('PT1M')).toBe(60);
      expect(parseIso8601DurationSeconds('PT5M')).toBe(300);
    });

    it('should parse combined minutes and seconds', () => {
      expect(parseIso8601DurationSeconds('PT1M30S')).toBe(90);
      expect(parseIso8601DurationSeconds('PT2M15S')).toBe(135);
    });

    it('should parse hours', () => {
      expect(parseIso8601DurationSeconds('PT1H')).toBe(3600);
      expect(parseIso8601DurationSeconds('PT2H')).toBe(7200);
    });

    it('should parse hours, minutes, and seconds', () => {
      expect(parseIso8601DurationSeconds('PT2H3M4S')).toBe(7384);
      expect(parseIso8601DurationSeconds('PT1H30M45S')).toBe(5445);
    });

    it('should parse days', () => {
      expect(parseIso8601DurationSeconds('P1D')).toBe(86400);
      expect(parseIso8601DurationSeconds('P2D')).toBe(172800);
    });

    it('should parse days with time component', () => {
      expect(parseIso8601DurationSeconds('P1DT2H')).toBe(93600);
      expect(parseIso8601DurationSeconds('P1DT2H3M4S')).toBe(93784);
    });

    it('should round fractional seconds', () => {
      expect(parseIso8601DurationSeconds('PT1M30.5S')).toBe(91);
      expect(parseIso8601DurationSeconds('PT1.5S')).toBe(2);
      expect(parseIso8601DurationSeconds('PT0.4S')).toBe(0);
    });

    it('should parse zero duration', () => {
      expect(parseIso8601DurationSeconds('PT0S')).toBe(0);
    });

    it('should return null for null input', () => {
      expect(parseIso8601DurationSeconds(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseIso8601DurationSeconds(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseIso8601DurationSeconds('')).toBeNull();
    });

    it('should return null for garbage input', () => {
      expect(parseIso8601DurationSeconds('garbage')).toBeNull();
      expect(parseIso8601DurationSeconds('123')).toBeNull();
      expect(parseIso8601DurationSeconds('not-iso')).toBeNull();
    });

    it('should return null for malformed ISO 8601', () => {
      expect(parseIso8601DurationSeconds('P')).toBeNull();
      expect(parseIso8601DurationSeconds('PT')).toBeNull();
      expect(parseIso8601DurationSeconds('T1H')).toBeNull();
    });
  });

  describe('isShortDuration', () => {
    const {
      isShortDuration,
      SHORTS_MAX_DURATION_SECONDS,
    } = require('./YouTubeSyncService');

    it('should identify shorts under the ceiling', () => {
      expect(isShortDuration(1)).toBe(true);
      expect(isShortDuration(30)).toBe(true);
      expect(isShortDuration(60)).toBe(true);
      expect(isShortDuration(179)).toBe(true);
    });

    it('should identify exactly 180 seconds as short (inclusive ceiling)', () => {
      expect(isShortDuration(SHORTS_MAX_DURATION_SECONDS)).toBe(true);
    });

    it('should reject durations over the ceiling', () => {
      expect(isShortDuration(181)).toBe(false);
      expect(isShortDuration(300)).toBe(false);
      expect(isShortDuration(3600)).toBe(false);
    });

    it('should reject zero duration', () => {
      expect(isShortDuration(0)).toBe(false);
    });

    it('should reject negative duration', () => {
      expect(isShortDuration(-1)).toBe(false);
      expect(isShortDuration(-100)).toBe(false);
    });

    it('should treat null as not short (safety critical)', () => {
      expect(isShortDuration(null)).toBe(false);
    });

    it('should treat undefined as not short (safety critical)', () => {
      expect(isShortDuration(undefined)).toBe(false);
    });
  });

  describe('videoKindWhere', () => {
    const {
      videoKindWhere,
      SHORTS_MAX_DURATION_SECONDS,
    } = require('./YouTubeSyncService');

    it('should select shorts when kind=short', () => {
      const where = videoKindWhere('short');
      expect(where).toEqual({
        durationSeconds: { gt: 0, lte: SHORTS_MAX_DURATION_SECONDS },
      });
    });

    it('should select long-form when kind=long', () => {
      const where = videoKindWhere('long');
      expect(where).toEqual({
        OR: [
          { durationSeconds: null },
          { durationSeconds: { gt: SHORTS_MAX_DURATION_SECONDS } },
          { durationSeconds: { lte: 0 } },
        ],
      });
    });

    it('should select all when kind=all', () => {
      const where = videoKindWhere('all');
      expect(where).toEqual({});
    });
  });

  describe('video sync with duration backfill', () => {
    it('should request contentDetails in video fetch', async () => {
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

      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);

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
                title: 'Video 1',
                thumbnails: { medium: { url: 't1' } },
                publishedAt: '2026-01-01T00:00:00Z',
              },
              contentDetails: { duration: 'PT2M30S' },
            },
          ],
        },
      });

      await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      // Verify contentDetails was requested
      expect(mockYoutube.videos.list).toHaveBeenCalledWith(
        expect.objectContaining({
          part: ['snippet', 'contentDetails'],
        }),
      );
    });

    it('should populate durationSeconds from contentDetails.duration', async () => {
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

      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);

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
                title: 'A Short Video',
                thumbnails: { medium: { url: 't1' } },
                publishedAt: '2026-01-01T00:00:00Z',
              },
              contentDetails: { duration: 'PT30S' },
            },
          ],
        },
      });

      await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      // Verify durationSeconds was included in the upsert
      expect(mockPrisma.__transaction.youTubeVideo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_videoId: { userId: 'user-1', videoId: 'v1' } },
          create: expect.objectContaining({
            durationSeconds: 30,
          }),
        }),
      );
    });

    it('should store null when contentDetails.duration is missing', async () => {
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

      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);

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
                title: 'No Duration Video',
                thumbnails: { medium: { url: 't1' } },
                publishedAt: '2026-01-01T00:00:00Z',
              },
              // Missing contentDetails
            },
          ],
        },
      });

      await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      expect(mockPrisma.__transaction.youTubeVideo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            durationSeconds: null,
          }),
        }),
      );
    });

    it('should treat duration mismatch as changed and backfill null', async () => {
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

      // Existing video has null duration (cached before duration collection)
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Same Video',
          thumbnail: 't1',
          publishedAt: new Date('2026-01-01'),
          durationSeconds: null, // Previously unclassified
        },
      ]);

      const mockYoutube = require('googleapis').google.youtube();
      mockYoutube.playlistItems.list.mockResolvedValue({
        data: { items: [{ snippet: { resourceId: { videoId: 'v1' } } }] },
      });

      // Now we have the duration
      mockYoutube.videos.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'v1',
              snippet: {
                title: 'Same Video',
                thumbnails: { medium: { url: 't1' } },
                publishedAt: '2026-01-01T00:00:00Z',
              },
              contentDetails: { duration: 'PT2M30S' },
            },
          ],
        },
      });

      const result =
        await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      // Should recognize it as changed and perform the transaction
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.__transaction.youTubeVideo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_videoId: { userId: 'user-1', videoId: 'v1' } },
          update: expect.objectContaining({
            durationSeconds: 150,
          }),
        }),
      );
      expect(result.videosSynced).toBe(1);
    });

    it('should include durationSeconds in the update block of upsert', async () => {
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

      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Old Title',
          thumbnail: 't1',
          publishedAt: new Date('2026-01-01'),
          durationSeconds: 60,
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
                title: 'New Title',
                thumbnails: { medium: { url: 't1-new' } },
                publishedAt: '2026-01-01T00:00:00Z',
              },
              contentDetails: { duration: 'PT1M30S' },
            },
          ],
        },
      });

      await youtubeSyncService.syncVideosForUserWithStatus('user-1');

      expect(mockPrisma.__transaction.youTubeVideo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            durationSeconds: 90,
          }),
        }),
      );
    });
  });

  describe('getVideos with kind filtering', () => {
    it('should default to kind=all when not specified', async () => {
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.youTubeVideo.count as jest.Mock).mockResolvedValue(0);

      await youtubeSyncService.getVideos('user-1', {});

      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            // No duration filter when kind=all
          }),
        }),
      );

      // Verify the where clause doesn't have durationSeconds
      const call = (mockPrisma.youTubeVideo.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where).not.toHaveProperty('durationSeconds');
    });

    it('should filter shorts when kind=short', async () => {
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.youTubeVideo.count as jest.Mock).mockResolvedValue(0);

      await youtubeSyncService.getVideos('user-1', { kind: 'short' });

      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            durationSeconds: { gt: 0, lte: 180 },
          }),
        }),
      );
    });

    it('should filter long-form when kind=long', async () => {
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.youTubeVideo.count as jest.Mock).mockResolvedValue(0);

      await youtubeSyncService.getVideos('user-1', { kind: 'long' });

      const call = (mockPrisma.youTubeVideo.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where).toHaveProperty('OR');
      expect(call.where.OR).toContainEqual({ durationSeconds: null });
      expect(call.where.OR).toContainEqual({
        durationSeconds: { gt: 180 },
      });
    });

    it('should apply kind filter alongside other filters', async () => {
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.youTubeVideo.count as jest.Mock).mockResolvedValue(0);

      await youtubeSyncService.getVideos('user-1', {
        kind: 'short',
        search: 'test',
        channelId: 'ch-1',
      });

      const call = (mockPrisma.youTubeVideo.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where).toMatchObject({
        userId: 'user-1',
        durationSeconds: { gt: 0, lte: 180 },
        channelId: 'ch-1',
        title: { contains: 'test', mode: 'insensitive' },
      });
    });
  });

  describe('getVideosGroupedByChannel', () => {
    it('should default to kind=long', async () => {
      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockResolvedValue([
        {
          channelId: 'ch-1',
          channelTitle: 'Channel 1',
          channelThumbnail: null,
          videos: [],
        },
      ]);

      await youtubeSyncService.getVideosGroupedByChannel('user-1');

      const call = (mockPrisma.youTubeSubscription.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.include.videos.where).toEqual({
        OR: [
          { durationSeconds: null },
          { durationSeconds: { gt: 180 } },
          { durationSeconds: { lte: 0 } },
        ],
      });
    });

    it('should filter nested videos when kind=short', async () => {
      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockResolvedValue([
        {
          channelId: 'ch-1',
          channelTitle: 'Channel 1',
          channelThumbnail: null,
          videos: [],
        },
      ]);

      await youtubeSyncService.getVideosGroupedByChannel('user-1', 'short');

      const call = (mockPrisma.youTubeSubscription.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.include.videos.where).toEqual({
        durationSeconds: { gt: 0, lte: 180 },
      });
    });

    it('should not filter when kind=all', async () => {
      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockResolvedValue([
        {
          channelId: 'ch-1',
          channelTitle: 'Channel 1',
          channelThumbnail: null,
          videos: [],
        },
      ]);

      await youtubeSyncService.getVideosGroupedByChannel('user-1', 'all');

      const call = (mockPrisma.youTubeSubscription.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.include.videos.where).toEqual({});
    });

    it('should order nested videos by publishedAt descending', async () => {
      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockResolvedValue([
        {
          channelId: 'ch-1',
          channelTitle: 'Channel 1',
          channelThumbnail: null,
          videos: [],
        },
      ]);

      await youtubeSyncService.getVideosGroupedByChannel('user-1');

      const call = (mockPrisma.youTubeSubscription.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.include.videos.orderBy).toEqual({ publishedAt: 'desc' });
    });

    it('should limit nested videos to 20 per channel', async () => {
      (mockPrisma.youTubeSubscription.findMany as jest.Mock).mockResolvedValue([
        {
          channelId: 'ch-1',
          channelTitle: 'Channel 1',
          channelThumbnail: null,
          videos: [],
        },
      ]);

      await youtubeSyncService.getVideosGroupedByChannel('user-1');

      const call = (mockPrisma.youTubeSubscription.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.include.videos.take).toBe(20);
    });
  });
});
