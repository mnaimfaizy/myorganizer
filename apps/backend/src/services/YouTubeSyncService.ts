import { google, youtube_v3 } from 'googleapis';
import winston from 'winston';
import { Prisma, PrismaClient, createPrismaClient } from '../prisma';
import {
  EncryptedToken,
  decryptToken,
  encryptToken,
} from './YouTubeTokenEncryption';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

const VIDEO_SNAPSHOT_LIMIT = 100;
const MANUAL_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;
const DISABLED_VIDEO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export type YouTubeVideoWithChannel = Prisma.YouTubeVideoGetPayload<{
  include: { subscription: { select: { channelTitle: true } } };
}>;

export interface YouTubeSubscriptionDTO {
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
  uploadsPlaylistId: string;
}

export interface YouTubeVideoDTO {
  videoId: string;
  channelId: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string;
}

export type YouTubeSyncStatus =
  | 'never'
  | 'running'
  | 'success'
  | 'partial'
  | 'failed'
  | 'quota_exceeded'
  | 'cooldown';

export interface YouTubeSyncStatusDTO {
  status: YouTubeSyncStatus;
  lastSyncedAt: Date | null;
  lastSyncAttemptAt: Date | null;
  lastSyncError: string | null;
  retryAt: Date | null;
}

export interface YouTubeRefreshResult extends YouTubeSyncStatusDTO {
  subscriptionsSynced: number;
  videosSynced: number;
}

interface YouTubeVideoSnapshot {
  videoId: string;
  channelId: string;
  title: string;
  thumbnail: string | null;
  publishedAt: Date;
}

function isQuotaExceededError(error: unknown): boolean {
  let message = String(error);
  if (error instanceof Error) {
    message = error.message;
  } else {
    try {
      message = JSON.stringify(error) ?? message;
    } catch {
      // Keep the string representation when a third-party error is not serializable.
    }
  }
  return /quotaExceeded/i.test(message);
}

function getSyncErrorCode(error: unknown): string {
  return isQuotaExceededError(error) ? 'quotaExceeded' : 'syncFailed';
}

class YouTubeSyncService {
  constructor(private prisma: PrismaClient) {}

  /** Generate OAuth consent URL */
  getAuthUrl(state: string): string {
    const oauth2Client = getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/youtube.readonly'],
      state,
    });
  }

  /** Exchange authorization code for tokens and store encrypted in DB */
  async handleOAuthCallback(
    userId: string,
    code: string,
  ): Promise<{ ok: boolean; message: string }> {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return { ok: false, message: 'Failed to obtain tokens from Google.' };
    }

    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = encryptToken(tokens.refresh_token);

    await this.prisma.youTubeIntegration.upsert({
      where: { userId },
      create: {
        userId,
        encrypted_access_token: encryptedAccess.ciphertext,
        encrypted_refresh_token: encryptedRefresh.ciphertext,
        token_iv: `${encryptedAccess.iv}:${encryptedRefresh.iv}`,
        token_auth_tag: `${encryptedAccess.authTag}:${encryptedRefresh.authTag}`,
        status: 'connected',
      },
      update: {
        encrypted_access_token: encryptedAccess.ciphertext,
        encrypted_refresh_token: encryptedRefresh.ciphertext,
        token_iv: `${encryptedAccess.iv}:${encryptedRefresh.iv}`,
        token_auth_tag: `${encryptedAccess.authTag}:${encryptedRefresh.authTag}`,
        status: 'connected',
      },
    });

    await this.prisma.youTubeNotificationSettings.upsert({
      where: { userId },
      create: { userId, intervalDays: 7, enabled: true },
      update: {},
    });

    return { ok: true, message: 'YouTube account connected successfully.' };
  }

  /** Get integration status for a user */
  async getStatus(
    userId: string,
  ): Promise<{ connected: boolean; status: string }> {
    const integration = await this.prisma.youTubeIntegration.findUnique({
      where: { userId },
    });
    if (!integration) {
      return { connected: false, status: 'not_connected' };
    }
    return {
      connected: integration.status === 'connected',
      status: integration.status,
    };
  }

  /** Disconnect YouTube integration */
  async disconnect(userId: string): Promise<{ ok: boolean; message: string }> {
    const integration = await this.prisma.youTubeIntegration.findUnique({
      where: { userId },
    });
    if (!integration) {
      return { ok: false, message: 'No YouTube integration found.' };
    }

    try {
      const oauth2Client = getOAuth2Client();
      const refreshToken = this.decryptRefreshToken(integration);
      await oauth2Client.revokeToken(refreshToken);
    } catch {
      logger.warn('Failed to revoke token at Google (may already be revoked)');
    }

    await this.prisma.youTubeVideo.deleteMany({ where: { userId } });
    await this.prisma.youTubeSubscription.deleteMany({ where: { userId } });
    await this.prisma.youTubeNotificationSettings.deleteMany({
      where: { userId },
    });
    await this.prisma.youTubeIntegration.delete({ where: { userId } });

    return { ok: true, message: 'YouTube account disconnected.' };
  }

  /** Fetch user's subscriptions from YouTube and sync to DB */
  async syncSubscriptions(userId: string): Promise<YouTubeSubscriptionDTO[]> {
    const youtube = await this.getAuthenticatedClient(userId);
    const subscriptions: YouTubeSubscriptionDTO[] = [];
    let pageToken: string | undefined;

    do {
      const response = await youtube.subscriptions.list({
        part: ['snippet'],
        mine: true,
        maxResults: 50,
        pageToken,
      });

      const subscriptionItems = response.data.items ?? [];
      const channelIds = subscriptionItems
        .map((item) => item.snippet?.resourceId?.channelId)
        .filter((channelId): channelId is string => Boolean(channelId));

      const uploadsPlaylistByChannelId: Record<string, string> = {};

      if (channelIds.length > 0) {
        const channelResponse = await youtube.channels.list({
          part: ['contentDetails'],
          id: channelIds,
        });

        for (const channel of channelResponse.data.items ?? []) {
          const id = channel.id;
          const uploadsPlaylistId =
            channel.contentDetails?.relatedPlaylists?.uploads;
          if (id && uploadsPlaylistId) {
            uploadsPlaylistByChannelId[id] = uploadsPlaylistId;
          }
        }
      }

      for (const item of subscriptionItems) {
        const channelId = item.snippet?.resourceId?.channelId;
        if (!channelId) continue;

        const uploadsPlaylistId = uploadsPlaylistByChannelId[channelId];
        if (!uploadsPlaylistId) continue;

        const dto: YouTubeSubscriptionDTO = {
          channelId,
          channelTitle: item.snippet?.title ?? 'Unknown Channel',
          channelThumbnail: item.snippet?.thumbnails?.default?.url ?? null,
          uploadsPlaylistId,
        };
        subscriptions.push(dto);

        await this.prisma.youTubeSubscription.upsert({
          where: { userId_channelId: { userId, channelId } },
          create: {
            userId,
            channelId,
            channelTitle: dto.channelTitle,
            channelThumbnail: dto.channelThumbnail,
            uploadsPlaylistId: dto.uploadsPlaylistId,
          },
          update: {
            channelTitle: dto.channelTitle,
            channelThumbnail: dto.channelThumbnail,
            uploadsPlaylistId: dto.uploadsPlaylistId,
          },
        });
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return subscriptions;
  }

  /** Get user's subscriptions from DB */
  async getSubscriptions(userId: string) {
    return this.prisma.youTubeSubscription.findMany({
      where: { userId },
      orderBy: { channelTitle: 'asc' },
    });
  }

  /** Toggle a subscription's enabled state */
  async toggleSubscription(
    userId: string,
    subscriptionId: string,
    enabled: boolean,
  ) {
    return this.prisma.youTubeSubscription.updateMany({
      where: { id: subscriptionId, userId },
      data: enabled
        ? { enabled: true, disabledAt: null }
        : { enabled: false, disabledAt: new Date() },
    });
  }

  /** Sync enabled videos and preserve the last good snapshot on failure. */
  async syncVideosForUser(userId: string): Promise<number> {
    const result = await this.syncVideosForUserWithStatus(userId);
    return result.videosSynced;
  }

  async syncVideosForUserWithStatus(
    userId: string,
  ): Promise<YouTubeRefreshResult> {
    const attemptAt = new Date();
    await this.prisma.youTubeIntegration.update({
      where: { userId },
      data: {
        lastSyncAttemptAt: attemptAt,
        lastSyncStatus: 'running',
        lastSyncError: null,
      },
    });

    await this.pruneExpiredDisabledVideos(userId);
    const subscriptions = await this.prisma.youTubeSubscription.findMany({
      where: { userId, enabled: true },
    });

    if (subscriptions.length === 0) {
      await this.recordSyncState(userId, attemptAt, 'success', null);
      return {
        subscriptionsSynced: 0,
        videosSynced: 0,
        ...(await this.getSyncStatus(userId)),
      };
    }

    let youtube: youtube_v3.Youtube;
    try {
      youtube = await this.getAuthenticatedClient(userId);
    } catch (error) {
      await this.recordSyncState(
        userId,
        attemptAt,
        'failed',
        getSyncErrorCode(error),
      );
      throw error;
    }

    let videosSynced = 0;
    let successfulChannels = 0;
    let failedChannels = 0;
    let lastSyncError: string | null = null;
    let quotaExceeded = false;

    for (const subscription of subscriptions) {
      try {
        const count = await this.syncVideosForSubscription(
          youtube,
          userId,
          subscription.channelId,
          subscription.uploadsPlaylistId,
        );
        videosSynced += count;
        successfulChannels++;

        await this.prisma.youTubeSubscription.update({
          where: { id: subscription.id },
          data: { lastSyncedAt: attemptAt },
        });
      } catch (error) {
        failedChannels++;
        lastSyncError = getSyncErrorCode(error);
        logger.error(
          `Failed to sync videos for channel ${subscription.channelId}: ${error}`,
        );
        if (isQuotaExceededError(error)) {
          quotaExceeded = true;
          break;
        }
      }
    }

    const status: YouTubeSyncStatus = quotaExceeded
      ? 'quota_exceeded'
      : failedChannels === 0
        ? 'success'
        : successfulChannels === 0
          ? 'failed'
          : 'partial';

    await this.recordSyncState(userId, attemptAt, status, lastSyncError);

    return {
      subscriptionsSynced: successfulChannels,
      videosSynced,
      ...(await this.getSyncStatus(userId)),
    };
  }

  /** Refresh subscriptions and videos with a per-user 15-minute cooldown. */
  async manualRefresh(userId: string): Promise<YouTubeRefreshResult> {
    const integration = await this.prisma.youTubeIntegration.findUnique({
      where: { userId },
    });
    if (!integration || integration.status !== 'connected') {
      throw new Error('YouTube account is not connected.');
    }

    const now = new Date();
    const cooldownUntil = integration.lastManualRefreshAt
      ? new Date(
          integration.lastManualRefreshAt.getTime() +
            MANUAL_REFRESH_COOLDOWN_MS,
        )
      : null;

    if (cooldownUntil && cooldownUntil > now) {
      return {
        subscriptionsSynced: 0,
        videosSynced: 0,
        ...(await this.getSyncStatus(userId)),
        status: 'cooldown',
        retryAt: cooldownUntil,
      };
    }

    const claim = await this.prisma.youTubeIntegration.updateMany({
      where: {
        userId,
        status: 'connected',
        OR: [
          { lastManualRefreshAt: null },
          {
            lastManualRefreshAt: {
              lte: new Date(now.getTime() - MANUAL_REFRESH_COOLDOWN_MS),
            },
          },
        ],
      },
      data: { lastManualRefreshAt: now },
    });

    if (claim.count !== 1) {
      const currentStatus = await this.getSyncStatus(userId);
      return {
        subscriptionsSynced: 0,
        videosSynced: 0,
        ...currentStatus,
        status: 'cooldown',
        retryAt:
          currentStatus.retryAt ??
          new Date(now.getTime() + MANUAL_REFRESH_COOLDOWN_MS),
      };
    }

    try {
      const subscriptions = await this.syncSubscriptions(userId);
      const syncResult = await this.syncVideosForUserWithStatus(userId);
      return {
        ...syncResult,
        subscriptionsSynced: subscriptions.length,
      };
    } catch (error) {
      const status: YouTubeSyncStatus = isQuotaExceededError(error)
        ? 'quota_exceeded'
        : 'failed';
      await this.recordSyncState(userId, now, status, getSyncErrorCode(error));
      return {
        subscriptionsSynced: 0,
        videosSynced: 0,
        ...(await this.getSyncStatus(userId)),
        status,
      };
    }
  }

  /** Return persisted freshness and manual-refresh state. */
  async getSyncStatus(userId: string): Promise<YouTubeSyncStatusDTO> {
    const integration = await this.prisma.youTubeIntegration.findUnique({
      where: { userId },
    });
    if (!integration) {
      return {
        status: 'never',
        lastSyncedAt: null,
        lastSyncAttemptAt: null,
        lastSyncError: null,
        retryAt: null,
      };
    }

    const latestSubscription = await this.prisma.youTubeSubscription.findFirst({
      where: {
        userId,
        enabled: true,
        lastSyncedAt: { not: null },
      },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true },
    });
    const now = new Date();
    const manualRefreshAt = integration.lastManualRefreshAt;
    const retryAt = manualRefreshAt
      ? new Date(manualRefreshAt.getTime() + MANUAL_REFRESH_COOLDOWN_MS)
      : null;

    return {
      status: (integration.lastSyncStatus ?? 'never') as YouTubeSyncStatus,
      lastSyncedAt: latestSubscription?.lastSyncedAt ?? null,
      lastSyncAttemptAt: integration.lastSyncAttemptAt ?? null,
      lastSyncError: integration.lastSyncError ?? null,
      retryAt: retryAt && retryAt > now ? retryAt : null,
    };
  }

  /** Get cached videos with sorting, search, and pagination */
  async getVideos(
    userId: string,
    options: {
      sort?: 'latest' | 'oldest' | 'az';
      search?: string;
      page?: number;
      limit?: number;
      channelId?: string;
    },
  ): Promise<{
    videos: YouTubeVideoWithChannel[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      sort = 'latest',
      search,
      page = 1,
      limit = 24,
      channelId,
    } = options;

    const where: Record<string, unknown> = { userId };
    if (channelId) {
      where['channelId'] = channelId;
    }
    if (search) {
      where['title'] = { contains: search, mode: 'insensitive' };
    }
    where['subscription'] = { enabled: true };

    let orderBy: Record<string, string>;
    switch (sort) {
      case 'oldest':
        orderBy = { publishedAt: 'asc' };
        break;
      case 'az':
        orderBy = { title: 'asc' };
        break;
      case 'latest':
      default:
        orderBy = { publishedAt: 'desc' };
        break;
    }

    const skip = (page - 1) * limit;
    const [videos, total] = await Promise.all([
      this.prisma.youTubeVideo.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { subscription: { select: { channelTitle: true } } },
      }),
      this.prisma.youTubeVideo.count({ where }),
    ]);

    return {
      videos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Get videos grouped by channel for carousel view */
  async getVideosGroupedByChannel(userId: string) {
    const subscriptions = await this.prisma.youTubeSubscription.findMany({
      where: { userId, enabled: true },
      orderBy: { channelTitle: 'asc' },
      include: {
        videos: {
          orderBy: { publishedAt: 'desc' },
          take: 20,
        },
      },
    });

    return subscriptions.map((subscription) => ({
      channelId: subscription.channelId,
      channelTitle: subscription.channelTitle,
      channelThumbnail: subscription.channelThumbnail,
      videos: subscription.videos,
    }));
  }

  /** Get notification settings for a user */
  async getNotificationSettings(userId: string) {
    const settings = await this.prisma.youTubeNotificationSettings.findUnique({
      where: { userId },
    });
    return settings ?? { intervalDays: 7, enabled: true, lastNotifiedAt: null };
  }

  /** Update notification settings */
  async updateNotificationSettings(
    userId: string,
    data: { intervalDays?: number; enabled?: boolean },
  ) {
    if (data.intervalDays !== undefined) {
      if (data.intervalDays < 2 || data.intervalDays > 15) {
        throw new Error('Notification interval must be between 2 and 15 days.');
      }
    }

    return this.prisma.youTubeNotificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        intervalDays: data.intervalDays ?? 7,
        enabled: data.enabled ?? true,
      },
      update: data,
    });
  }

  private async getAuthenticatedClient(
    userId: string,
  ): Promise<youtube_v3.Youtube> {
    const integration = await this.prisma.youTubeIntegration.findUnique({
      where: { userId },
    });
    if (!integration || integration.status !== 'connected') {
      throw new Error('YouTube account is not connected.');
    }

    const accessToken = this.decryptAccessToken(integration);
    const refreshToken = this.decryptRefreshToken(integration);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        const encrypted = encryptToken(tokens.access_token);
        const existingIvParts = integration.token_iv.split(':');
        const existingAuthTagParts = integration.token_auth_tag.split(':');
        await this.prisma.youTubeIntegration.update({
          where: { userId },
          data: {
            encrypted_access_token: encrypted.ciphertext,
            token_iv: `${encrypted.iv}:${existingIvParts[1]}`,
            token_auth_tag: `${encrypted.authTag}:${existingAuthTagParts[1]}`,
          },
        });
      }
    });

    return google.youtube({ version: 'v3', auth: oauth2Client });
  }

  private decryptAccessToken(integration: {
    encrypted_access_token: string;
    token_iv: string;
    token_auth_tag: string;
  }): string {
    const [accessIv] = integration.token_iv.split(':');
    const [accessAuthTag] = integration.token_auth_tag.split(':');
    const encrypted: EncryptedToken = {
      ciphertext: integration.encrypted_access_token,
      iv: accessIv,
      authTag: accessAuthTag,
    };
    return decryptToken(encrypted);
  }

  private decryptRefreshToken(integration: {
    encrypted_refresh_token: string;
    token_iv: string;
    token_auth_tag: string;
  }): string {
    const [, refreshIv] = integration.token_iv.split(':');
    const [, refreshAuthTag] = integration.token_auth_tag.split(':');
    const encrypted: EncryptedToken = {
      ciphertext: integration.encrypted_refresh_token,
      iv: refreshIv,
      authTag: refreshAuthTag,
    };
    return decryptToken(encrypted);
  }

  private async syncVideosForSubscription(
    youtube: youtube_v3.Youtube,
    userId: string,
    channelId: string,
    uploadsPlaylistId: string,
  ): Promise<number> {
    const snapshot = await this.fetchVideoSnapshot(
      youtube,
      channelId,
      uploadsPlaylistId,
    );
    const existingVideos = await this.prisma.youTubeVideo.findMany({
      where: { userId, channelId },
      select: {
        videoId: true,
        title: true,
        thumbnail: true,
        publishedAt: true,
      },
    });
    const existingByVideoId = new Map(
      existingVideos.map((video) => [video.videoId, video]),
    );
    const changed =
      existingVideos.length !== snapshot.length ||
      snapshot.some((video) => {
        const existing = existingByVideoId.get(video.videoId);
        return (
          !existing ||
          existing.title !== video.title ||
          existing.thumbnail !== video.thumbnail ||
          existing.publishedAt.getTime() !== video.publishedAt.getTime()
        );
      });

    if (!changed) return 0;

    await this.prisma.$transaction(async (transaction) => {
      for (const video of snapshot) {
        await transaction.youTubeVideo.upsert({
          where: { userId_videoId: { userId, videoId: video.videoId } },
          create: { userId, ...video },
          update: {
            channelId: video.channelId,
            title: video.title,
            thumbnail: video.thumbnail,
            publishedAt: video.publishedAt,
          },
        });
      }

      await transaction.youTubeVideo.deleteMany({
        where:
          snapshot.length === 0
            ? { userId, channelId }
            : {
                userId,
                channelId,
                videoId: {
                  notIn: snapshot.map((video) => video.videoId),
                },
              },
      });
    });

    return snapshot.length;
  }

  private async fetchVideoSnapshot(
    youtube: youtube_v3.Youtube,
    channelId: string,
    uploadsPlaylistId: string,
  ): Promise<YouTubeVideoSnapshot[]> {
    const videosById = new Map<string, YouTubeVideoSnapshot>();
    let pageToken: string | undefined;
    let page = 0;

    do {
      const response = await youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken,
      });
      const videoIds = [
        ...new Set(
          (response.data.items ?? [])
            .map((item) => item.snippet?.resourceId?.videoId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      if (videoIds.length > 0) {
        const videoDetails = await youtube.videos.list({
          part: ['snippet'],
          id: videoIds,
        });

        for (const video of videoDetails.data.items ?? []) {
          if (!video.id || !video.snippet || videosById.has(video.id)) {
            continue;
          }
          videosById.set(video.id, {
            videoId: video.id,
            channelId,
            title: video.snippet.title ?? 'Untitled',
            thumbnail:
              video.snippet.thumbnails?.medium?.url ??
              video.snippet.thumbnails?.default?.url ??
              null,
            publishedAt: new Date(video.snippet.publishedAt ?? Date.now()),
          });
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
      page++;
    } while (pageToken && page < VIDEO_SNAPSHOT_LIMIT / 50);

    return [...videosById.values()].slice(0, VIDEO_SNAPSHOT_LIMIT);
  }

  private async pruneExpiredDisabledVideos(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - DISABLED_VIDEO_RETENTION_MS);
    const expiredSubscriptions = await this.prisma.youTubeSubscription.findMany(
      {
        where: {
          userId,
          enabled: false,
          disabledAt: { not: null, lt: cutoff },
        },
        select: { channelId: true },
      },
    );
    const channelIds = expiredSubscriptions.map(
      (subscription) => subscription.channelId,
    );
    if (channelIds.length === 0) return;

    await this.prisma.youTubeVideo.deleteMany({
      where: { userId, channelId: { in: channelIds } },
    });
  }

  private async recordSyncState(
    userId: string,
    attemptAt: Date,
    status: YouTubeSyncStatus,
    error: string | null,
  ): Promise<void> {
    await this.prisma.youTubeIntegration.update({
      where: { userId },
      data: {
        lastSyncAttemptAt: attemptAt,
        lastSyncStatus: status,
        lastSyncError: error,
      },
    });
  }
}

const youtubeSyncService = new YouTubeSyncService(createPrismaClient());
export default youtubeSyncService;
