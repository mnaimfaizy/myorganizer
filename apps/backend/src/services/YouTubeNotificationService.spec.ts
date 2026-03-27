import youTubeNotificationService from './YouTubeNotificationService';

// All mock objects must be created INSIDE jest.mock factories because
// jest.mock is hoisted above all variable declarations, and the module
// under test is instantiated at import time via createPrismaClient().

jest.mock('./YouTubeSyncService', () => {
  const __mockSyncVideosForUser = jest.fn().mockResolvedValue(5);
  return {
    __esModule: true,
    default: { syncVideosForUser: __mockSyncVideosForUser },
    __mockSyncVideosForUser,
  };
});

jest.mock('./EmailService', () => {
  const __mockSendEmail = jest.fn().mockResolvedValue(undefined);
  return {
    __esModule: true,
    default: __mockSendEmail,
    __mockSendEmail,
  };
});

jest.mock('../prisma', () => {
  const __mockPrisma = {
    youTubeIntegration: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    youTubeNotificationSettings: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    youTubeVideo: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
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
const mockSyncVideosForUser =
  require('./YouTubeSyncService').__mockSyncVideosForUser;
const mockSendEmail = require('./EmailService').__mockSendEmail;

describe('YouTubeNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncAndNotifyAll', () => {
    it('should return zero counts when no integrations exist', async () => {
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      const result = await youTubeNotificationService.syncAndNotifyAll();
      expect(result).toEqual({ usersSynced: 0, notificationsSent: 0 });
    });

    it('should sync videos for each connected user', async () => {
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue(null);

      const result = await youTubeNotificationService.syncAndNotifyAll();

      expect(mockSyncVideosForUser).toHaveBeenCalledWith('user-1');
      expect(mockSyncVideosForUser).toHaveBeenCalledWith('user-2');
      expect(result.usersSynced).toBe(2);
    });

    it('should send notification email when user is due', async () => {
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1' },
      ]);

      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        intervalDays: 7,
        enabled: true,
        lastNotifiedAt: tenDaysAgo,
      });

      const mockVideos = [
        {
          videoId: 'v1',
          title: 'Test Video',
          thumbnail: 'https://img.youtube.com/vi/v1/mqdefault.jpg',
          publishedAt: new Date(),
          subscription: { channelTitle: 'Test Channel' },
        },
      ];
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue(
        mockVideos,
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'user@test.com',
        first_name: 'Test',
      });

      const result = await youTubeNotificationService.syncAndNotifyAll();

      expect(mockSendEmail).toHaveBeenCalledWith(
        'user@test.com',
        expect.stringContaining('1 new YouTube video'),
        expect.stringContaining('Test Video'),
      );
      expect(result.notificationsSent).toBe(1);
    });

    it('should not send notification if interval has not elapsed', async () => {
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1' },
      ]);

      const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        intervalDays: 7,
        enabled: true,
        lastNotifiedAt: yesterday,
      });

      const result = await youTubeNotificationService.syncAndNotifyAll();

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(result.notificationsSent).toBe(0);
    });

    it('should not send notification if disabled', async () => {
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1' },
      ]);

      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        intervalDays: 7,
        enabled: false,
        lastNotifiedAt: new Date(0),
      });

      const result = await youTubeNotificationService.syncAndNotifyAll();

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(result.notificationsSent).toBe(0);
    });

    it('should mark integration as revoked on token error', async () => {
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1' },
      ]);

      mockSyncVideosForUser.mockRejectedValueOnce(
        new Error('Token has been expired or revoked'),
      );

      await youTubeNotificationService.syncAndNotifyAll();

      expect(mockPrisma.youTubeIntegration.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { status: 'revoked' },
      });
    });
  });
});
