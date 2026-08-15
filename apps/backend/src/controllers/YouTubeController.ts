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
import { requireUserId } from '../guards/AuthGuard';
import youTubeDigestService from '../services/YouTubeDigestService';
import youTubeSyncWorkerService from '../services/YouTubeSyncWorkerService';
import youtubeSyncService, {
  YouTubeRefreshResult,
  YouTubeSyncStatusDTO,
  YouTubeVideoWithChannel,
  isShortDuration,
} from '../services/YouTubeSyncService';

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
  watched: boolean;
  channelTitle?: string;
  /** Runtime in seconds, or null when this upload has not been classified yet. */
  durationSeconds: number | null;
  /** Whether this Cached Upload is a Short. Unclassified uploads are never Shorts. */
  isShort: boolean;
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
  /** Whether the User has opted in to the weekly New-only digest. */
  enabled: boolean;
  lastNotifiedAt: string | null;
  /** Preferred send day in the User's own week, 0 = Sunday .. 6 = Saturday. */
  preferredWeekday: number;
  /** IANA time zone the weekday is evaluated in. Null means UTC. */
  timeZone: string | null;
}

interface NotificationSettingsBody {
  enabled?: boolean;
  preferredWeekday?: number;
  timeZone?: string | null;
}

/** Result of one bounded pass of the metadata sync worker. */
interface CronSyncResponse {
  ran: boolean;
  processed: number;
  usersSynced: number;
  failed: number;
  done: boolean;
}

/** Result of one bounded pass of the weekly digest worker. */
interface CronDigestResponse {
  ran: boolean;
  processed: number;
  sent: number;
  skippedEmpty: number;
  notDue: number;
  duplicates: number;
  failed: number;
  done: boolean;
}

interface UnsubscribeBody {
  token: string;
}

interface UnsubscribeResponse {
  ok: boolean;
}

interface SyncStatusResponse {
  status: string;
  lastSyncedAt: string | null;
  lastSyncAttemptAt: string | null;
  lastSyncError: string | null;
  retryAt: string | null;
}

interface SyncResponse extends SyncStatusResponse {
  synced: number;
  videosSynced: number;
}

interface WatchedBody {
  watched: boolean;
}

interface WatchedResponse {
  ok: boolean;
  watched: boolean;
}

function toSyncStatusResponse(
  status: YouTubeSyncStatusDTO,
): SyncStatusResponse {
  return {
    status: status.status,
    lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
    lastSyncAttemptAt: status.lastSyncAttemptAt?.toISOString() ?? null,
    lastSyncError: status.lastSyncError,
    retryAt: status.retryAt?.toISOString() ?? null,
  };
}

function toNotificationSettingsResponse(settings: {
  enabled: boolean;
  lastNotifiedAt: Date | null;
  preferredWeekday: number;
  timeZone: string | null;
}): NotificationSettingsResponse {
  return {
    enabled: settings.enabled,
    lastNotifiedAt: settings.lastNotifiedAt?.toISOString() ?? null,
    preferredWeekday: settings.preferredWeekday,
    timeZone: settings.timeZone,
  };
}

function toSyncResponse(result: YouTubeRefreshResult): SyncResponse {
  return {
    synced: result.subscriptionsSynced,
    videosSynced: result.videosSynced,
    ...toSyncStatusResponse(result),
  };
}

// ─── Controller ─────────────────────────────────────────────────

@Tags('YouTube')
@Route('/youtube')
export class YouTubeController extends Controller {
  /**
   * Returns the Google OAuth consent URL for linking YouTube.
   */
  @Get('/auth-url')
  @Security('jwt')
  public async getAuthUrl(
    @Request() req: ExRequest,
  ): Promise<AuthUrlResponse | YouTubeErrorResponse> {
    const userId = requireUserId(req);
    const url = youtubeSyncService.getAuthUrl(userId);
    return { url };
  }

  /**
   * OAuth callback — exchanges the authorization code for tokens.
   */
  @Post('/callback')
  @Security('jwt')
  public async handleCallback(
    @Request() req: ExRequest,
    @Body() body: { code: string },
  ): Promise<{ ok: boolean; message: string }> {
    const userId = requireUserId(req);
    const result = await youtubeSyncService.handleOAuthCallback(
      userId,
      body.code,
    );
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
  ): Promise<SyncResponse | YouTubeErrorResponse> {
    const userId = requireUserId(req);
    return toSyncResponse(await youtubeSyncService.manualRefresh(userId));
  }

  /** Returns the latest cached-video sync outcome and retry time. */
  @Get('/sync-status')
  @Security('jwt')
  public async getSyncStatus(
    @Request() req: ExRequest,
  ): Promise<SyncStatusResponse | YouTubeErrorResponse> {
    const userId = requireUserId(req);
    return toSyncStatusResponse(await youtubeSyncService.getSyncStatus(userId));
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
    const userId = requireUserId(req);
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
   * @param kind  Library slice by runtime: short | long | all (default all)
   */
  @Get('/videos')
  @Security('jwt')
  public async getVideos(
    @Request() req: ExRequest,
    @Query() sort?: 'latest' | 'oldest' | 'az',
    @Query() search?: string,
    @Query() page?: number,
    @Query() limit?: number,
    @Query() channelId?: string,
    @Query() kind?: 'short' | 'long' | 'all',
  ): Promise<VideosPageResponse | YouTubeErrorResponse> {
    const userId = requireUserId(req);
    const result = await youtubeSyncService.getVideos(userId, {
      sort,
      search,
      page,
      limit,
      channelId,
      kind,
    });
    return {
      ...result,
      videos: result.videos.map((v: YouTubeVideoWithChannel) => ({
        id: v.id,
        videoId: v.videoId,
        channelId: v.channelId,
        title: v.title,
        thumbnail: v.thumbnail,
        publishedAt: v.publishedAt.toISOString(),
        watched: v.watched,
        channelTitle: v.subscription?.channelTitle ?? undefined,
        durationSeconds: v.durationSeconds,
        isShort: isShortDuration(v.durationSeconds),
      })),
    };
  }

  /** Marks a Cached Upload as Watched or New. */
  @Patch('/videos/{videoId}/watched')
  @Security('jwt')
  public async setVideoWatched(
    @Request() req: ExRequest,
    @Path() videoId: string,
    @Body() body: WatchedBody,
  ): Promise<WatchedResponse | YouTubeErrorResponse> {
    const userId = requireUserId(req);
    const updated = await youtubeSyncService.setVideoWatched(
      userId,
      videoId,
      body.watched,
    );
    if (updated === 0) {
      this.setStatus(404);
      return { message: 'Cached Upload not found' };
    }
    return { ok: true, watched: body.watched };
  }

  /**
   * Returns videos grouped by channel for the carousel view.
   */
  @Get('/videos/carousel')
  @Security('jwt')
  public async getVideosCarousel(
    @Request() req: ExRequest,
  ): Promise<ChannelCarouselResponse[] | YouTubeErrorResponse> {
    const userId = requireUserId(req);
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
        watched: v.watched,
        durationSeconds: v.durationSeconds,
        isShort: isShortDuration(v.durationSeconds),
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
    const userId = requireUserId(req);
    const settings = await youtubeSyncService.getNotificationSettings(userId);
    return toNotificationSettingsResponse(settings);
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
    const userId = requireUserId(req);
    try {
      const updated = await youtubeSyncService.updateNotificationSettings(
        userId,
        body,
      );
      return toNotificationSettingsResponse(updated);
    } catch (error) {
      this.setStatus(400);
      return {
        message:
          error instanceof Error
            ? error.message
            : 'Invalid notification settings.',
      };
    }
  }

  /**
   * Turns the weekly digest off from the link carried by every digest email.
   * Unauthenticated by design — the opaque token is the only credential a
   * mail client can present.
   */
  @Post('/digest/unsubscribe')
  public async unsubscribeFromDigest(
    @Body() body: UnsubscribeBody,
  ): Promise<UnsubscribeResponse | YouTubeErrorResponse> {
    const ok = await youTubeDigestService.unsubscribe(body.token);
    if (!ok) {
      this.setStatus(404);
      return { message: 'Unknown unsubscribe link.' };
    }
    return { ok: true };
  }

  /**
   * Cron-only endpoint: runs one bounded pass of the metadata sync worker.
   * Authenticated via X-Cron-Secret header instead of JWT.
   */
  @Post('/cron/sync')
  @Security('cron-secret')
  public async cronSync(): Promise<CronSyncResponse | YouTubeErrorResponse> {
    const result = await youTubeSyncWorkerService.runSyncWorker();
    return {
      ran: result.ran,
      processed: result.processed,
      usersSynced: result.usersSynced,
      failed: result.failed,
      done: result.done,
    };
  }

  /**
   * Cron-only endpoint: runs one bounded pass of the weekly digest worker.
   * Separate from `/cron/sync` so neither job can starve or fail the other.
   */
  @Post('/cron/digest')
  @Security('cron-secret')
  public async cronDigest(): Promise<
    CronDigestResponse | YouTubeErrorResponse
  > {
    const result = await youTubeDigestService.runDigestWorker();
    return {
      ran: result.ran,
      processed: result.processed,
      sent: result.sent,
      skippedEmpty: result.skippedEmpty,
      notDue: result.notDue,
      duplicates: result.duplicates,
      failed: result.failed,
      done: result.done,
    };
  }
}
