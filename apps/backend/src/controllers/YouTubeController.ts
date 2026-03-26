import { Request as ExRequest } from 'express';
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Put,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from 'tsoa';
import youTubeNotificationService from '../services/YouTubeNotificationService';
import youtubeSyncService from '../services/YouTubeSyncService';
import { UserInterface } from '../types';

type YouTubeErrorResponse = { message: string };

// ─── Response Types ─────────────────────────────────────────────

interface AuthUrlResponse {
  url: string;
}

interface StatusResponse {
  connected: boolean;
  status: string;
}

interface SubscriptionResponse {
  id: string;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
  uploadsPlaylistId: string;
  enabled: boolean;
  lastSyncedAt: string | null;
}

interface VideoResponse {
  id: string;
  videoId: string;
  channelId: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string;
  channelTitle?: string;
}

interface VideosPageResponse {
  videos: VideoResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ChannelCarouselResponse {
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
  videos: VideoResponse[];
}

interface NotificationSettingsResponse {
  intervalDays: number;
  enabled: boolean;
  lastNotifiedAt: string | null;
}

interface NotificationSettingsBody {
  intervalDays?: number;
  enabled?: boolean;
}

interface CronResultResponse {
  usersSynced: number;
  notificationsSent: number;
}

// ─── Controller ─────────────────────────────────────────────────

@Tags('YouTube')
@Route('/youtube')
export class YouTubeController extends Controller {
  private getUserId(req: ExRequest): string {
    const user = req.user as UserInterface;
    return user?.id;
  }

  /**
   * Returns the Google OAuth consent URL for linking YouTube.
   */
  @Get('/auth-url')
  @Security('jwt')
  public async getAuthUrl(
    @Request() req: ExRequest,
  ): Promise<AuthUrlResponse | YouTubeErrorResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }
    const url = youtubeSyncService.getAuthUrl(userId);
    return { url };
  }

  /**
   * OAuth callback — exchanges the authorization code for tokens.
   */
  @Get('/callback')
  @Security('jwt')
  public async handleCallback(
    @Request() req: ExRequest,
    @Query() code: string,
    @Query() state: string,
  ): Promise<{ ok: boolean; message: string }> {
    // The state param contains the userId set during getAuthUrl
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { ok: false, message: 'Unauthorized' };
    }
    const result = await youtubeSyncService.handleOAuthCallback(userId, code);
    if (!result.ok) {
      this.setStatus(400);
    }
    return result;
  }

  /**
   * Returns the user's YouTube integration status.
   */
  @Get('/status')
  @Security('jwt')
  public async getConnectionStatus(
    @Request() req: ExRequest,
  ): Promise<StatusResponse | YouTubeErrorResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }
    try {
      return await youtubeSyncService.getStatus(userId);
    } catch {
      this.setStatus(500);
      return { message: 'Failed to fetch YouTube status' };
    }
  }

  /**
   * Disconnects the user's YouTube account after revoking the token.
   */
  @Delete('/disconnect')
  @Security('jwt')
  public async disconnect(
    @Request() req: ExRequest,
  ): Promise<{ ok: boolean; message: string }> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { ok: false, message: 'Unauthorized' };
    }
    return youtubeSyncService.disconnect(userId);
  }

  /**
   * Returns the user's synced YouTube channel subscriptions.
   */
  @Get('/subscriptions')
  @Security('jwt')
  public async getSubscriptions(
    @Request() req: ExRequest,
  ): Promise<SubscriptionResponse[] | YouTubeErrorResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }
    const subs = await youtubeSyncService.getSubscriptions(userId);
    return subs.map((s) => ({
      id: s.id,
      channelId: s.channelId,
      channelTitle: s.channelTitle,
      channelThumbnail: s.channelThumbnail,
      uploadsPlaylistId: s.uploadsPlaylistId,
      enabled: s.enabled,
      lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Fetches fresh subscriptions from YouTube and syncs to DB.
   */
  @Put('/subscriptions/sync')
  @Security('jwt')
  public async syncSubscriptions(
    @Request() req: ExRequest,
  ): Promise<{ synced: number } | YouTubeErrorResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }
    const subs = await youtubeSyncService.syncSubscriptions(userId);
    return { synced: subs.length };
  }

  /**
   * Toggles a subscription's enabled state.
   */
  @Patch('/subscriptions/{subscriptionId}')
  @Security('jwt')
  public async toggleSubscription(
    @Request() req: ExRequest,
    @Path() subscriptionId: string,
    @Body() body: { enabled: boolean },
  ): Promise<{ ok: boolean } | YouTubeErrorResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }
    await youtubeSyncService.toggleSubscription(
      userId,
      subscriptionId,
      body.enabled,
    );
    return { ok: true };
  }

  /**
   * Returns cached videos with sorting, searching, and pagination.
   * @param sort  Sort order: latest | oldest | az
   * @param search  Filter by video title
   * @param page  Page number (1-based)
   * @param limit  Items per page
   */
  @Get('/videos')
  @Security('jwt')
  public async getVideos(
    @Request() req: ExRequest,
    @Query() sort?: 'latest' | 'oldest' | 'az',
    @Query() search?: string,
    @Query() page?: number,
    @Query() limit?: number,
  ): Promise<VideosPageResponse | YouTubeErrorResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }
    const result = await youtubeSyncService.getVideos(userId, {
      sort,
      search,
      page,
      limit,
    });
    return {
      ...result,
      videos: result.videos.map((v) => ({
        id: v.id,
        videoId: v.videoId,
        channelId: v.channelId,
        title: v.title,
        thumbnail: v.thumbnail,
        publishedAt: v.publishedAt.toISOString(),
        channelTitle: (v as any).subscription?.channelTitle ?? undefined,
      })),
    };
  }

  /**
   * Returns videos grouped by channel for the carousel view.
   */
  @Get('/videos/carousel')
  @Security('jwt')
  public async getVideosCarousel(
    @Request() req: ExRequest,
  ): Promise<ChannelCarouselResponse[] | YouTubeErrorResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }
    const grouped = await youtubeSyncService.getVideosGroupedByChannel(userId);
    return grouped.map((g) => ({
      channelId: g.channelId,
      channelTitle: g.channelTitle,
      channelThumbnail: g.channelThumbnail,
      videos: g.videos.map((v) => ({
        id: v.id,
        videoId: v.videoId,
        channelId: v.channelId,
        title: v.title,
        thumbnail: v.thumbnail,
        publishedAt: v.publishedAt.toISOString(),
      })),
    }));
  }

  /**
   * Returns the user's YouTube notification preferences.
   */
  @Get('/notification-settings')
  @Security('jwt')
  public async getNotificationSettings(
    @Request() req: ExRequest,
  ): Promise<NotificationSettingsResponse | YouTubeErrorResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }
    const settings = await youtubeSyncService.getNotificationSettings(userId);
    return {
      intervalDays: settings.intervalDays,
      enabled: settings.enabled,
      lastNotifiedAt: settings.lastNotifiedAt?.toISOString() ?? null,
    };
  }

  /**
   * Updates the user's YouTube notification preferences.
   */
  @Patch('/notification-settings')
  @Security('jwt')
  public async updateNotificationSettings(
    @Request() req: ExRequest,
    @Body() body: NotificationSettingsBody,
  ): Promise<NotificationSettingsResponse | YouTubeErrorResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }
    const updated = await youtubeSyncService.updateNotificationSettings(
      userId,
      body,
    );
    return {
      intervalDays: updated.intervalDays,
      enabled: updated.enabled,
      lastNotifiedAt: updated.lastNotifiedAt?.toISOString() ?? null,
    };
  }

  /**
   * Cron-only endpoint: syncs all users' videos and sends due notifications.
   * Authenticated via X-Cron-Secret header instead of JWT.
   */
  @Post('/cron/sync-and-notify')
  public async cronSyncAndNotify(
    @Request() req: ExRequest,
  ): Promise<CronResultResponse | YouTubeErrorResponse> {
    const secret = req.headers['x-cron-secret'];
    const expectedSecret = process.env.YOUTUBE_CRON_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    const result = await youTubeNotificationService.syncAndNotifyAll();
    return result;
  }
}
