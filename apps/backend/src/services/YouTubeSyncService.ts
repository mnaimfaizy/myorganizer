import { google, youtube_v3 } from 'googleapis';
import winston from 'winston';
import { PrismaClient, createPrismaClient } from '../prisma';
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

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

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

    // Create default notification settings if not existing
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

    // Attempt to revoke the token at Google
    try {
      const oauth2Client = getOAuth2Client();
      const refreshToken = this.decryptRefreshToken(integration);
      await oauth2Client.revokeToken(refreshToken);
    } catch {
      logger.warn('Failed to revoke token at Google (may already be revoked)');
    }

    // Remove all related data
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

      for (const item of response.data.items ?? []) {
        const channelId = item.snippet?.resourceId?.channelId;
        if (!channelId) continue;

        // Get the channel's uploads playlist ID
        const channelResponse = await youtube.channels.list({
          part: ['contentDetails'],
          id: [channelId],
        });
        const uploadsPlaylistId =
          channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists
            ?.uploads;
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
      data: { enabled },
    });
  }

  /** Sync videos for all enabled subscriptions of a user */
  async syncVideosForUser(userId: string): Promise<number> {
    const subs = await this.prisma.youTubeSubscription.findMany({
      where: { userId, enabled: true },
    });

    if (subs.length === 0) return 0;

    const youtube = await this.getAuthenticatedClient(userId);
    let totalSynced = 0;

    for (const sub of subs) {
      try {
        const count = await this.syncVideosForSubscription(
          youtube,
          userId,
          sub.channelId,
          sub.uploadsPlaylistId,
        );
        totalSynced += count;

        await this.prisma.youTubeSubscription.update({
          where: { id: sub.id },
          data: { lastSyncedAt: new Date() },
        });
      } catch (err) {
        logger.error(
          `Failed to sync videos for channel ${sub.channelId}: ${err}`,
        );
      }
    }

    return totalSynced;
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
  ) {
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

    // Only show videos from enabled subscriptions
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

    return subscriptions.map((sub) => ({
      channelId: sub.channelId,
      channelTitle: sub.channelTitle,
      channelThumbnail: sub.channelThumbnail,
      videos: sub.videos,
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

  // ─── Private Helpers ─────────────────────────────────────────────

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

    // Listen for token refresh events to persist the new access token
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
    let count = 0;
    let pageToken: string | undefined;

    // Fetch only the first 2 pages (up to 100 videos) per sync to be quota-efficient
    const maxPages = 2;
    let currentPage = 0;

    do {
      const response = await youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken,
      });

      const videoIds = (response.data.items ?? [])
        .map((item) => item.snippet?.resourceId?.videoId)
        .filter((id): id is string => !!id);

      if (videoIds.length === 0) break;

      // Batch-fetch video details (up to 50 IDs per request = 1 quota unit)
      const videoDetails = await youtube.videos.list({
        part: ['snippet'],
        id: videoIds,
      });

      for (const video of videoDetails.data.items ?? []) {
        if (!video.id || !video.snippet) continue;

        await this.prisma.youTubeVideo.upsert({
          where: { userId_videoId: { userId, videoId: video.id } },
          create: {
            userId,
            videoId: video.id,
            channelId,
            title: video.snippet.title ?? 'Untitled',
            thumbnail:
              video.snippet.thumbnails?.medium?.url ??
              video.snippet.thumbnails?.default?.url ??
              null,
            publishedAt: new Date(video.snippet.publishedAt ?? Date.now()),
          },
          update: {
            title: video.snippet.title ?? 'Untitled',
            thumbnail:
              video.snippet.thumbnails?.medium?.url ??
              video.snippet.thumbnails?.default?.url ??
              null,
          },
        });
        count++;
      }

      pageToken = response.data.nextPageToken ?? undefined;
      currentPage++;
    } while (pageToken && currentPage < maxPages);

    return count;
  }
}

const youtubeSyncService = new YouTubeSyncService(createPrismaClient());
export default youtubeSyncService;
