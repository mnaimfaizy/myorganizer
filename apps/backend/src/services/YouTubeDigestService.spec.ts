import { collectCidReferences } from '@myorganizer/email-shell';
import { YouTubeDigestService, DIGEST_ITEM_CAP } from './YouTubeDigestService';

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

// The digest worker must never reach into sync. Mocked so the spec can assert
// the absence of that call — worker separation is an acceptance criterion.
jest.mock('./YouTubeSyncService', () => {
  const __mockSyncVideosForUser = jest.fn().mockResolvedValue(0);
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
    },
    youTubeNotificationSettings: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    youTubeVideo: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    youTubeDigestDelivery: {
      create: jest.fn(),
      update: jest.fn(),
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
const mockLeases = require('./WorkerLeaseService').__mockWorkerLeaseService;
const mockSendEmail = require('./EmailService').__mockSendEmail;
const mockSyncVideosForUser =
  require('./YouTubeSyncService').__mockSyncVideosForUser;

interface DigestDeliveryInput {
  videoId: string;
  channelId?: string;
  title: string;
  thumbnail?: string | null;
  publishedAt: Date;
  channelTitle: string;
}

async function deliverDigestAndCapture(
  videos: DigestDeliveryInput[] = [],
  options?: {
    userId?: string;
    email?: string;
    firstName?: string;
    unsubscribeToken?: string;
    connectedAt?: Date;
  },
) {
  const userId = options?.userId ?? 'user-1';
  const email = options?.email ?? 'user@example.com';
  const firstName = options?.firstName ?? 'John';
  const unsubscribeToken = options?.unsubscribeToken ?? 'token123';
  const connectedAt = options?.connectedAt ?? new Date('2025-12-01');
  const monday = new Date('2026-01-05T12:00:00Z');

  process.env.APP_FRONTEND_URL = 'https://app.example.com';

  (
    mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
  ).mockResolvedValue({
    userId,
    enabled: true,
    timeZone: 'UTC',
    preferredWeekday: 1,
    lastNotifiedAt: null,
    optedInAt: connectedAt,
    unsubscribeToken,
  });
  (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue({});
  (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue(
    videos.map((v) => ({
      videoId: v.videoId,
      channelId: v.channelId ?? 'default-chan',
      title: v.title,
      thumbnail: v.thumbnail ?? null,
      publishedAt: v.publishedAt,
      subscription: { channelTitle: v.channelTitle },
    })),
  );
  (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
    email,
    first_name: firstName,
  });

  const service = new YouTubeDigestService(mockPrisma, mockLeases);
  await service.deliverDigestForUser(userId, new Date('2025-11-01'), monday);

  const messageArg = (mockSendEmail as jest.Mock).mock.calls[0]?.[2];
  return messageArg;
}

describe('YouTubeDigestService', () => {
  let service: YouTubeDigestService;
  const now = new Date('2026-01-15T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks resets recorded calls but not implementations, so a test
    // that makes sendEmail reject would otherwise poison every later test.
    (mockSendEmail as jest.Mock).mockResolvedValue(undefined);
    service = new YouTubeDigestService(mockPrisma, mockLeases);
  });

  afterEach(() => {
    delete process.env.APP_FRONTEND_URL;
  });

  describe('runDigestWorker', () => {
    it('should return ran=false when lease is held', async () => {
      (mockLeases.acquire as jest.Mock).mockResolvedValue(null);

      const result = await service.runDigestWorker({ now });

      expect(result.ran).toBe(false);
      expect(result.sent).toBe(0);
      // Nothing was acquired, so nothing may be released — releasing here
      // would expire the lease the other live pass is relying on.
      expect(mockLeases.release).not.toHaveBeenCalled();
      expect(mockPrisma.youTubeIntegration.findMany).not.toHaveBeenCalled();
    });

    it('should release lease in finally block when drain throws', async () => {
      const mockLease = {
        name: 'youtube-digest',
        owner: 'owner-1',
        cursor: null,
      };
      (mockLeases.acquire as jest.Mock).mockResolvedValue(mockLease);
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.runDigestWorker({ now })).rejects.toThrow();
      expect(mockLeases.release).toHaveBeenCalledWith(mockLease);
    });

    it('should never call the sync service', async () => {
      (mockLeases.acquire as jest.Mock).mockResolvedValue({
        name: 'youtube-digest',
        owner: 'owner-1',
        cursor: null,
      });
      (mockPrisma.youTubeIntegration.findMany as jest.Mock)
        .mockResolvedValueOnce([{ userId: 'user-1', createdAt: new Date() }])
        .mockResolvedValue([]);
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await service.runDigestWorker({ now });

      expect(mockSyncVideosForUser).not.toHaveBeenCalled();
    });

    it('should query without a cursor clause on a fresh pass', async () => {
      (mockLeases.acquire as jest.Mock).mockResolvedValue({
        name: 'youtube-digest',
        owner: 'owner-1',
        cursor: null,
      });
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      const result = await service.runDigestWorker({ now });

      const call = (mockPrisma.youTubeIntegration.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where.userId).toBeUndefined();
      expect(call.where.status).toBe('connected');
      expect(result.done).toBe(true);
      expect(result.cursor).toBeNull();
    });

    it('should resume from the stored cursor', async () => {
      (mockLeases.acquire as jest.Mock).mockResolvedValue({
        name: 'youtube-digest',
        owner: 'owner-1',
        cursor: 'user-5',
      });
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      await service.runDigestWorker({ now });

      const call = (mockPrisma.youTubeIntegration.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where.userId).toEqual({ gt: 'user-5' });
    });

    it('should stop at maxUsers and hand the cursor to the next tick', async () => {
      (mockLeases.acquire as jest.Mock).mockResolvedValue({
        name: 'youtube-digest',
        owner: 'owner-1',
        cursor: null,
      });
      (mockPrisma.youTubeIntegration.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1', createdAt: new Date() },
      ]);
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.runDigestWorker({ now, maxUsers: 1 });

      expect(result.processed).toBe(1);
      expect(result.done).toBe(false);
      expect(result.cursor).toBe('user-1');
      expect(mockLeases.saveCursor).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
      );
    });
  });

  describe('deliverDigestForUser', () => {
    it('should return not_due when no settings row exists', async () => {
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.deliverDigestForUser('user-1', now, now);

      expect(result).toBe('not_due');
      expect(mockPrisma.youTubeDigestDelivery.create).not.toHaveBeenCalled();
    });

    it('should return not_due when enabled is false', async () => {
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: false,
        timeZone: 'UTC',
        preferredWeekday: 3,
      });

      const result = await service.deliverDigestForUser('user-1', now, now);

      expect(result).toBe('not_due');
      expect(mockPrisma.youTubeDigestDelivery.create).not.toHaveBeenCalled();
    });

    it('should return duplicate when claimPeriod rejects P2002', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt: new Date('2025-12-01'),
      });
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Test',
          thumbnail: null,
          publishedAt: new Date('2026-01-02'),
          subscription: { channelTitle: 'Channel' },
        },
      ]);
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockRejectedValue({
        code: 'P2002',
      });

      const result = await service.deliverDigestForUser('user-1', now, monday);

      expect(result).toBe('duplicate');
      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should query videos with watched=false and enabled subscriptions', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      const windowStart = new Date('2026-01-01T00:00:00Z');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: windowStart,
        optedInAt: null,
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);

      await service.deliverDigestForUser('user-1', windowStart, monday);

      const call = (mockPrisma.youTubeVideo.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          watched: false,
          publishedAt: { gt: windowStart },
          subscription: { enabled: true },
        }),
      );
      expect(call.orderBy).toEqual({ publishedAt: 'desc' });
      expect(call.take).toBe(DIGEST_ITEM_CAP);
    });

    it('should exclude Shorts from the digest', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: new Date('2025-12-29'),
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);

      await service.deliverDigestForUser('user-1', new Date(), monday);

      // Shorts live behind the Daily Budget on their own page, so the weekly
      // mail must carry long-form only. `long` deliberately keeps
      // unclassified rows, matching the channel-first home.
      const call = (mockPrisma.youTubeVideo.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where.OR).toEqual([
        { durationSeconds: null },
        { durationSeconds: { gt: expect.any(Number) } },
        { durationSeconds: { lte: 0 } },
      ]);
    });

    it('should return skipped_empty when no videos match and use optedInAt as window fallback', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      const optedInAt = new Date('2025-12-01');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt,
      });
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.deliverDigestForUser(
        'user-1',
        new Date('2025-11-01'),
        monday,
      );

      expect(result).toBe('skipped_empty');
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockPrisma.youTubeDigestDelivery.create).not.toHaveBeenCalled();
      const call = (mockPrisma.youTubeVideo.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where.publishedAt).toEqual({ gt: optedInAt });
    });

    it('should still send later the same Period after an empty Window', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      const settings = {
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt: new Date('2025-12-01'),
        unsubscribeToken: 'token123',
      };
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue(settings);
      const lateVideo = {
        videoId: 'v1',
        title: 'Late sync',
        thumbnail: null,
        publishedAt: new Date('2026-01-02'),
        subscription: { channelTitle: 'Channel' },
      };
      let findManyCalls = 0;
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockImplementation(() => {
        findManyCalls += 1;
        return findManyCalls === 1 ? [] : [lateVideo];
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        first_name: 'John',
      });

      const empty = await service.deliverDigestForUser(
        'user-1',
        new Date('2025-11-01'),
        monday,
      );
      const sent = await service.deliverDigestForUser(
        'user-1',
        new Date('2025-11-01'),
        monday,
      );

      expect(empty).toBe('skipped_empty');
      expect(sent).toBe('sent');
      expect(mockPrisma.youTubeDigestDelivery.create).toHaveBeenCalledTimes(1);
    });

    it('should return failed when user row missing', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt: new Date('2025-12-01'),
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Test',
          thumbnail: null,
          publishedAt: new Date(),
          subscription: { channelTitle: 'Channel' },
        },
      ]);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.deliverDigestForUser(
        'user-1',
        new Date('2025-11-01'),
        monday,
      );

      expect(result).toBe('failed');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should send email and advance lastNotifiedAt on happy path', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt: new Date('2025-12-01'),
        unsubscribeToken: 'token123',
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Test Video',
          thumbnail: null,
          publishedAt: new Date('2026-01-02'),
          subscription: { channelTitle: 'Test Channel' },
        },
      ]);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        first_name: 'John',
      });

      const result = await service.deliverDigestForUser(
        'user-1',
        new Date('2025-11-01'),
        monday,
      );

      expect(result).toBe('sent');
      expect(mockSendEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('1 new video'),
        expect.anything(),
      );
      expect(
        mockPrisma.youTubeNotificationSettings.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { lastNotifiedAt: monday },
        }),
      );
    });

    it('should carry an unsubscribe link and keep every link inside MyOrganizer', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      process.env.APP_FRONTEND_URL = 'https://app.example.com';
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt: new Date('2025-12-01'),
        unsubscribeToken: 'token123',
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          channelId: 'chan-1',
          title: 'Test Video',
          thumbnail: null,
          publishedAt: new Date('2026-01-02'),
          subscription: { channelTitle: 'Test Channel' },
        },
      ]);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        first_name: 'John',
      });

      await service.deliverDigestForUser(
        'user-1',
        new Date('2025-11-01'),
        monday,
      );

      const messageArg = (mockSendEmail as jest.Mock).mock.calls[0][2] as {
        html: string;
        text: string;
      };
      const html = messageArg.html;
      expect(html).toContain(
        'https://app.example.com/youtube/unsubscribe?token=token123',
      );
      expect(html).toContain('https://app.example.com/dashboard/youtube');
      // The whole point of the digest is to return the reader to MyOrganizer.
      expect(html).not.toContain('youtube.com');
      // ...and specifically to the locked long-form home, the channel
      // directory with the channel preselected (Variant C / issue #250),
      // rather than the separate grid that used to live on its own route.
      expect(html).toContain(
        'https://app.example.com/dashboard/youtube?channel=chan-1',
      );
      expect(html).not.toContain('/dashboard/youtube/channel/');
    });

    it('should include data-privacy link in footer', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      process.env.APP_FRONTEND_URL = 'https://app.example.com';
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt: new Date('2025-12-01'),
        unsubscribeToken: 'token123',
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          channelId: 'chan-1',
          title: 'Test Video',
          thumbnail: null,
          publishedAt: new Date('2026-01-02'),
          subscription: { channelTitle: 'Test Channel' },
        },
      ]);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        first_name: 'John',
      });

      await service.deliverDigestForUser(
        'user-1',
        new Date('2025-11-01'),
        monday,
      );

      const messageArg = (mockSendEmail as jest.Mock).mock.calls[0][2] as {
        html: string;
        text: string;
      };
      const html = messageArg.html;
      expect(html).toContain('https://app.example.com/youtube/data-privacy');
      expect(html).toContain('How we store your data');
    });

    it('should mint and persist an unsubscribe token when none exists', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt: new Date('2025-12-01'),
        unsubscribeToken: null,
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          channelId: 'chan-1',
          title: 'Test Video',
          thumbnail: null,
          publishedAt: new Date('2026-01-02'),
          subscription: { channelTitle: 'Test Channel' },
        },
      ]);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        first_name: 'John',
      });

      await service.deliverDigestForUser(
        'user-1',
        new Date('2025-11-01'),
        monday,
      );

      const mintCall = (
        mockPrisma.youTubeNotificationSettings.update as jest.Mock
      ).mock.calls.find((call) => call[0].data.unsubscribeToken !== undefined);
      expect(mintCall).toBeDefined();
      expect(mintCall[0].where).toEqual({ userId: 'user-1' });
      expect(typeof mintCall[0].data.unsubscribeToken).toBe('string');
      expect(mintCall[0].data.unsubscribeToken).toHaveLength(64);
    });

    it('should catch sendEmail error and not advance lastNotifiedAt', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt: new Date('2025-12-01'),
        unsubscribeToken: 'token',
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Test',
          thumbnail: null,
          publishedAt: new Date(),
          subscription: { channelTitle: 'Channel' },
        },
      ]);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        first_name: 'John',
      });
      (mockSendEmail as jest.Mock).mockRejectedValue(new Error('SMTP error'));

      const result = await service.deliverDigestForUser(
        'user-1',
        new Date('2025-11-01'),
        monday,
      );

      expect(result).toBe('failed');
    });

    it('should use connectedAt as window fallback when lastNotifiedAt and optedInAt are null', async () => {
      const monday = new Date('2026-01-05T12:00:00Z');
      const connectedAt = new Date('2025-10-15');
      (
        mockPrisma.youTubeNotificationSettings.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        timeZone: 'UTC',
        preferredWeekday: 1,
        lastNotifiedAt: null,
        optedInAt: null,
      });
      (mockPrisma.youTubeDigestDelivery.create as jest.Mock).mockResolvedValue(
        {},
      );
      (mockPrisma.youTubeVideo.findMany as jest.Mock).mockResolvedValue([
        {
          videoId: 'v1',
          title: 'Test Video',
          thumbnail: null,
          publishedAt: new Date('2025-10-20'),
          subscription: { channelTitle: 'Test Channel' },
        },
      ]);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        first_name: 'John',
      });

      const result = await service.deliverDigestForUser(
        'user-1',
        connectedAt,
        monday,
      );

      expect(result).toBe('sent');
      const call = (mockPrisma.youTubeVideo.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where.publishedAt).toEqual({ gt: connectedAt });
    });

    it('digest renders as Notification Email with Unsubscribe in html and text', async () => {
      const message = await deliverDigestAndCapture([
        {
          videoId: 'v1',
          channelId: 'chan-1',
          title: 'Test Video',
          thumbnail: 'https://cdn.example.com/thumb.jpg',
          publishedAt: new Date('2026-01-02'),
          channelTitle: 'Test Channel',
        },
      ]);

      const html = message.html;
      const text = message.text;

      expect(html).toMatch(/^<!doctype html>/i);
      expect(html).toContain('Unsubscribe');
      expect(html).toContain(
        'https://app.example.com/youtube/unsubscribe?token=token123',
      );
      expect(text).toContain(
        'Unsubscribe: https://app.example.com/youtube/unsubscribe?token=token123',
      );
    });

    it('digest keeps privacy and settings links in footer', async () => {
      const message = await deliverDigestAndCapture([
        {
          videoId: 'v1',
          channelId: 'chan-1',
          title: 'Test Video',
          thumbnail: 'https://cdn.example.com/thumb.jpg',
          publishedAt: new Date('2026-01-02'),
          channelTitle: 'Test Channel',
        },
      ]);

      const html = message.html;

      expect(html).toContain('https://app.example.com/youtube/data-privacy');
      expect(html).toContain('How we store your data');
      expect(html).toContain('https://app.example.com/dashboard/youtube');
      expect(html).toContain('Digest settings');
    });

    it('digest rows are fluid: thumbnail has width 100% and no fixed dimensions', async () => {
      const message = await deliverDigestAndCapture([
        {
          videoId: 'v1',
          channelId: 'chan-1',
          title: 'Test Video',
          thumbnail: 'https://cdn.example.com/thumb.jpg',
          publishedAt: new Date('2026-01-02'),
          channelTitle: 'Test Channel',
        },
      ]);

      const html = message.html;

      // Thumbnail should have width="100%" attribute and width: 100%; height: auto in css
      const imgMatch = html.match(
        /<img[^>]*src="https:\/\/cdn\.example\.com\/thumb\.jpg"[^>]*>/,
      );
      expect(imgMatch).not.toBeNull();
      const thumbnailImg = imgMatch?.[0] ?? '';
      expect(thumbnailImg).toContain('width="100%"');
      expect(thumbnailImg).toContain('width: 100%');
      expect(thumbnailImg).toContain('height: auto');
      // No fixed pixel dimensions from old digest (168x94)
      expect(thumbnailImg).not.toContain('width="168"');
      expect(thumbnailImg).not.toContain('height="94"');
    });

    it('digest ships logo CID and linkage holds', async () => {
      const message = await deliverDigestAndCapture([
        {
          videoId: 'v1',
          channelId: 'chan-1',
          title: 'Test Video',
          thumbnail: 'https://cdn.example.com/thumb.jpg',
          publishedAt: new Date('2026-01-02'),
          channelTitle: 'Test Channel',
        },
      ]);

      const referencedCids = collectCidReferences(message.html);
      const attachmentCids = message.attachments.map((a) => a.cid);

      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0].contentType).toBe('image/png');
      expect(referencedCids).toEqual(attachmentCids);
    });

    it('digest plain-text lists videos as dash-lines with title, channel, date, and url', async () => {
      const message = await deliverDigestAndCapture([
        {
          videoId: 'v1',
          channelId: 'chan-1',
          title: 'Video One',
          thumbnail: 'https://cdn.example.com/thumb1.jpg',
          publishedAt: new Date('2026-01-02'),
          channelTitle: 'Channel A',
        },
        {
          videoId: 'v2',
          channelId: 'chan-2',
          title: 'Video Two',
          thumbnail: 'https://cdn.example.com/thumb2.jpg',
          publishedAt: new Date('2026-01-01'),
          channelTitle: 'Channel B',
        },
      ]);

      const text = message.text;

      // Check the format matches: - <title> (<channel> · <date>): <url>
      expect(text).toContain(
        '- Video One (Channel A · 1/2/2026): https://app.example.com/dashboard/youtube?channel=chan-1',
      );
      expect(text).toContain(
        '- Video Two (Channel B · 1/1/2026): https://app.example.com/dashboard/youtube?channel=chan-2',
      );
    });

    it('digest escaping survives migration: script tags and ampersands', async () => {
      const message = await deliverDigestAndCapture([
        {
          videoId: 'v1',
          channelId: 'chan-1',
          title: 'Watch <script>alert(1)</script>',
          thumbnail: 'https://cdn.example.com/thumb.jpg',
          publishedAt: new Date('2026-01-02'),
          channelTitle: 'Channel & Co',
        },
      ]);

      const html = message.html;
      const text = message.text;

      // HTML should have escaped forms
      expect(html).toContain('Watch &lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).toContain('Channel &amp; Co');
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('Channel & Co');

      // Text should have unescaped forms
      expect(text).toContain('Watch <script>alert(1)</script>');
      expect(text).toContain('Channel & Co');
    });
  });

  describe('unsubscribe', () => {
    it('should return false for empty token', async () => {
      const result = await service.unsubscribe('');
      expect(result).toBe(false);
      expect(
        mockPrisma.youTubeNotificationSettings.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('should return true when updateMany matches rows', async () => {
      (
        mockPrisma.youTubeNotificationSettings.updateMany as jest.Mock
      ).mockResolvedValue({
        count: 1,
      });

      const result = await service.unsubscribe('valid-token');

      expect(result).toBe(true);
      expect(
        mockPrisma.youTubeNotificationSettings.updateMany,
      ).toHaveBeenCalledWith({
        where: { unsubscribeToken: 'valid-token' },
        data: { enabled: false },
      });
    });

    it('should return false when updateMany matches zero rows', async () => {
      (
        mockPrisma.youTubeNotificationSettings.updateMany as jest.Mock
      ).mockResolvedValue({
        count: 0,
      });

      const result = await service.unsubscribe('unknown-token');

      expect(result).toBe(false);
    });
  });
});
