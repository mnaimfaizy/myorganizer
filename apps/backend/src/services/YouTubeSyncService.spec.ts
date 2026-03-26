import youtubeSyncService from './YouTubeSyncService';

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
  const __mockPrisma = {
    youTubeIntegration: {
      upsert: jest
        .fn()
        .mockResolvedValue({ userId: 'user-1', status: 'connected' }),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    youTubeSubscription: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    youTubeVideo: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn(),
    },
    youTubeNotificationSettings: {
      upsert: jest.fn().mockResolvedValue({ intervalDays: 7, enabled: true }),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return {
    createPrismaClient: () => __mockPrisma,
    PrismaClient: jest.fn(),
    __mockPrisma,
  };
});

const mockPrisma = require('../prisma').__mockPrisma;

describe('YouTubeSyncService', () => {
  beforeEach(() => {
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

      expect(mockPrisma.youTubeSubscription.updateMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', userId: 'user-1' },
        data: { enabled: false },
      });
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
