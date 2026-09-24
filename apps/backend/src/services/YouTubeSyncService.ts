import { google, youtube_v3 } from 'googleapis';
import winston from 'winston';
import { describeError } from '../helpers/describeError';
import {
  parseIso8601DurationSeconds,
  videoKindWhere,
  type VideoKind,
} from '../helpers/videoKind';
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

/** Channel Sync manual cooldown (ADR 0096 decision 3). */
export const CHANNEL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
/**
 * Channel Sync run TTL must equal the channel cooldown (ADR 0096 decision 3).
 * Same construction as ADR 0080 decision 3, applied per attempt.
 */
export const CHANNEL_SYNC_TTL_MS = CHANNEL_SYNC_COOLDOWN_MS;

/** Manual Upload Sync cooldown (ADR 0096 decision 3). */
export const UPLOAD_SYNC_COOLDOWN_MS = 15 * 60 * 1000;
/**
 * Upload Sync run TTL must equal the upload cooldown (ADR 0096 decision 3).
 * Same construction as ADR 0080 decision 3, applied per attempt.
 */
export const UPLOAD_SYNC_TTL_MS = UPLOAD_SYNC_COOLDOWN_MS;

/** @deprecated Use {@link UPLOAD_SYNC_COOLDOWN_MS}. Kept for existing imports. */
export const MANUAL_REFRESH_COOLDOWN_MS = UPLOAD_SYNC_COOLDOWN_MS;
/**
 * @deprecated Use {@link UPLOAD_SYNC_TTL_MS}. Kept for existing imports.
 *
 * Exported so test suites can assert the coupling with
 * `expect(RUN_TTL_MS).toBe(MANUAL_REFRESH_COOLDOWN_MS)`, not for external consumption.
 */
export const RUN_TTL_MS = UPLOAD_SYNC_TTL_MS;

/**
 * Upload statuses that count as an in-flight Upload Sync (ADR 0096).
 * `discovering` is legacy — rows written before the channel/upload split.
 */
export const LIVE_UPLOAD_SYNC_STATUSES = ['running', 'discovering'] as const;
export type LiveUploadSyncStatus = (typeof LIVE_UPLOAD_SYNC_STATUSES)[number];

/** Cooldown stamp column for one manual attempt kind. */
type ManualSyncStampField = 'lastChannelSyncAt' | 'lastManualRefreshAt';

/** @deprecated Use {@link LIVE_UPLOAD_SYNC_STATUSES}. */
export const LIVE_SYNC_STATUSES = LIVE_UPLOAD_SYNC_STATUSES;
/** @deprecated Use {@link LiveUploadSyncStatus}. */
export type LiveSyncStatus = LiveUploadSyncStatus;

export function isLiveUploadSyncStatus(
  status: string | null | undefined,
): status is LiveUploadSyncStatus {
  return status === 'running' || status === 'discovering';
}

/** @deprecated Use {@link isLiveUploadSyncStatus}. */
export function isLiveSyncStatus(
  status: string | null | undefined,
): status is LiveSyncStatus {
  return isLiveUploadSyncStatus(status);
}

function isUploadSyncLive(
  integration: {
    lastSyncStatus: string | null;
    lastSyncAttemptAt: Date | null;
  },
  at: Date,
): boolean {
  if (!isLiveUploadSyncStatus(integration.lastSyncStatus)) {
    return false;
  }
  if (!integration.lastSyncAttemptAt) {
    return true;
  }
  return (
    at.getTime() - integration.lastSyncAttemptAt.getTime() <= UPLOAD_SYNC_TTL_MS
  );
}

function isChannelSyncLive(
  integration: {
    lastChannelSyncStatus?: string | null;
    lastChannelSyncAt?: Date | null;
  },
  at: Date,
): boolean {
  if (integration.lastChannelSyncStatus !== 'discovering') {
    return false;
  }
  if (!integration.lastChannelSyncAt) {
    return true;
  }
  return (
    at.getTime() - integration.lastChannelSyncAt.getTime() <=
    CHANNEL_SYNC_TTL_MS
  );
}

/**
 * ADR 0096 live-run predicate: true while either a Channel Sync or an Upload
 * Sync attempt is in flight — {@link youtubeSyncClaimableWhere} would refuse a claim.
 */
export function isAnyYouTubeSyncLive(
  integration: {
    lastSyncStatus: string | null;
    lastSyncAttemptAt: Date | null;
    lastChannelSyncStatus?: string | null;
    lastChannelSyncAt?: Date | null;
  },
  at: Date = new Date(),
): boolean {
  return (
    isUploadSyncLive(integration, at) || isChannelSyncLive(integration, at)
  );
}

/**
 * Prisma where for rows that may accept a new Channel Sync or Upload Sync
 * claim — upload not live AND channel not live (ADR 0096 decision 2).
 */
export function youtubeSyncClaimableWhere(
  userId: string,
  at: Date,
): Prisma.YouTubeIntegrationWhereInput {
  const uploadDeadline = new Date(at.getTime() - UPLOAD_SYNC_TTL_MS);
  const channelDeadline = new Date(at.getTime() - CHANNEL_SYNC_TTL_MS);
  return {
    userId,
    AND: [
      {
        OR: [
          { lastSyncStatus: { notIn: [...LIVE_UPLOAD_SYNC_STATUSES] } },
          { lastSyncAttemptAt: { lt: uploadDeadline } },
        ],
      },
      {
        OR: [
          { lastChannelSyncStatus: { not: 'discovering' } },
          { lastChannelSyncAt: { lt: channelDeadline } },
        ],
      },
    ],
  };
}

const DISABLED_VIDEO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Watched Ledger TTL — aligned with disabled-channel retention (ADR 0092). */
const WATCHED_LEDGER_TTL_MS = DISABLED_VIDEO_RETENTION_MS;
export const GOOGLE_PERMISSIONS_URL =
  'https://myaccount.google.com/permissions';

/** Thrown inside the disconnect transaction when a Channel Sync or an Upload Sync is claimed before commit. */
class YouTubeSyncBecameLiveError extends Error {
  constructor() {
    super('YOUTUBE_SYNC_LIVE');
    this.name = 'YouTubeSyncBecameLiveError';
  }
}

const YOUTUBE_SYNC_LIVE_MESSAGE =
  'Disconnect is not available while a sync is in progress. Wait for the sync to finish or cancel it, then try again.';
/** Monday, matching the ISO week the digest period key is built from. */
const DEFAULT_DIGEST_WEEKDAY = 1;

/**
 * Shape returned by the digest settings accessors, defaults included.
 *
 * The legacy `intervalDays` column still exists on the row but is deliberately
 * absent here: the digest is weekly and fires on `preferredWeekday`, so an
 * interval knob would be a control that silently does nothing.
 */
export interface NotificationSettings {
  enabled: boolean;
  lastNotifiedAt: Date | null;
  preferredWeekday: number;
  timeZone: string | null;
}

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

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
  watched: boolean;
}

export type YouTubeSyncStatus =
  | 'never'
  | 'discovering'
  | 'running'
  | 'success'
  | 'partial'
  | 'failed'
  | 'quota_exceeded'
  | 'cooldown';

export type YouTubeChannelSyncStatus =
  | 'never'
  | 'discovering'
  | 'success'
  | 'failed'
  | 'quota_exceeded'
  | 'cooldown';

export interface YouTubeSyncProgressDTO {
  /** Enabled Channels total. */
  total: number;
  /** Channels where lastSyncAttemptAt == run stamp. */
  processed: number;
  /** Processed channels where lastSyncedAt == run stamp. */
  succeeded: number;
  /** Processed channels where lastSyncError != null. */
  failed: number;
  /** The integration's run stamp. */
  startedAt: Date;
  /** Channels that were processed in this run and failed. */
  failedChannels: Array<{
    channelId: string;
    channelTitle: string;
    error: string;
  }>;
}

export interface YouTubeSyncStatusDTO {
  status: YouTubeSyncStatus;
  lastSyncedAt: Date | null;
  lastSyncAttemptAt: Date | null;
  lastSyncError: string | null;
  retryAt: Date | null;
  progress: YouTubeSyncProgressDTO | null;
  channelStatus: YouTubeChannelSyncStatus;
  channelLastAttemptAt: Date | null;
  channelLastError: string | null;
  channelRetryAt: Date | null;
}

export interface YouTubeRefreshResult extends YouTubeSyncStatusDTO {
  subscriptionsSynced: number;
  videosSynced: number;
}

export interface YouTubeChannelSyncResult {
  synced: number;
  status: YouTubeChannelSyncStatus;
  lastAttemptAt: Date | null;
  lastError: string | null;
  retryAt: Date | null;
}

export type YouTubeDisconnectResult =
  | {
      ok: true;
      message: string;
      revokeFailed?: true;
      googlePermissionsUrl?: string;
    }
  | {
      ok: false;
      message: string;
      code?: 'sync_run_live';
    };

interface YouTubeVideoSnapshot {
  videoId: string;
  channelId: string;
  title: string;
  thumbnail: string | null;
  publishedAt: Date;
  durationSeconds: number | null;
}

// Runtime classification lives in a shared helper so the digest worker can use
// the same definition of long-form without importing this service.
export {
  SHORTS_MAX_DURATION_SECONDS,
  isShortDuration,
  parseIso8601DurationSeconds,
  videoKindWhere,
} from '../helpers/videoKind';
export type { VideoKind } from '../helpers/videoKind';

function isQuotaExceededError(error: unknown): boolean {
  return /quotaExceeded/i.test(describeError(error).message);
}

function getSyncErrorCode(error: unknown): string {
  return isQuotaExceededError(error) ? 'quotaExceeded' : 'syncFailed';
}

/**
 * A Channel Sync or Upload Sync attempt can fail before its work finishes.
 * The stored code stays a stable bucket (`syncFailed` / `quotaExceeded`); the
 * message and stack are logged here. Call this from the handler that records
 * the bucket and returns. A catch that records state and rethrows leaves the
 * log to that caller, so one failure produces one line.
 */
function logSyncAttemptFailure(context: string, error: unknown): void {
  const { message, stack } = describeError(error);
  if (stack === undefined) {
    logger.error(`${context}: ${message}`);
    return;
  }
  logger.error(`${context}: ${message}`, { stack });
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
      // Seed the row but leave the digest off — it is opt-in, so connecting an
      // account must never start mailing anyone.
      create: { userId, intervalDays: 7, enabled: false },
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
  async disconnect(
    userId: string,
    options: { deleteWatchedMarks?: boolean } = {},
  ): Promise<YouTubeDisconnectResult> {
    const integration = await this.prisma.youTubeIntegration.findUnique({
      where: { userId },
    });
    if (!integration) {
      return { ok: false, message: 'No YouTube integration found.' };
    }

    if (isAnyYouTubeSyncLive(integration)) {
      return {
        ok: false,
        code: 'sync_run_live',
        message: YOUTUBE_SYNC_LIVE_MESSAGE,
      };
    }

    const deleteWatchedMarks = options.deleteWatchedMarks === true;

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "userId" FROM "YouTubeIntegration" WHERE "userId" = ${userId} FOR UPDATE
        `;
        const current = await transaction.youTubeIntegration.findUnique({
          where: { userId },
        });
        if (!current || isAnyYouTubeSyncLive(current)) {
          throw new YouTubeSyncBecameLiveError();
        }

        if (deleteWatchedMarks) {
          await transaction.youTubeWatchedLedger.deleteMany({
            where: { userId },
          });
        } else {
          const watchedVideos = await transaction.youTubeVideo.findMany({
            where: { userId, watched: true },
            select: { videoId: true },
          });
          if (watchedVideos.length > 0) {
            await transaction.youTubeWatchedLedger.createMany({
              data: watchedVideos.map((video) => ({
                userId,
                videoId: video.videoId,
              })),
              skipDuplicates: true,
            });
          }
          await this.purgeExpiredWatchedLedgerRows(transaction, userId);
        }

        await transaction.youTubeVideo.deleteMany({ where: { userId } });
        await transaction.youTubeSubscription.deleteMany({
          where: { userId },
        });
        await transaction.youTubeNotificationSettings.deleteMany({
          where: { userId },
        });
        await transaction.youTubeDigestDelivery.deleteMany({
          where: { userId },
        });
        await transaction.youTubeIntegration.delete({ where: { userId } });
      });
    } catch (error) {
      if (error instanceof YouTubeSyncBecameLiveError) {
        return {
          ok: false,
          code: 'sync_run_live',
          message: YOUTUBE_SYNC_LIVE_MESSAGE,
        };
      }
      throw error;
    }

    let revokeFailed = false;
    try {
      const oauth2Client = getOAuth2Client();
      const refreshToken = this.decryptRefreshToken(integration);
      await oauth2Client.revokeToken(refreshToken);
    } catch (error) {
      revokeFailed = true;
      logger.warn(
        'Failed to revoke token at Google (may already be revoked)',
        error,
      );
    }

    if (revokeFailed) {
      return {
        ok: true,
        message:
          'YouTube account disconnected locally. Remove Google access at your Google account permissions if needed.',
        revokeFailed: true,
        googlePermissionsUrl: GOOGLE_PERMISSIONS_URL,
      };
    }

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
    options: { claimedAt?: Date } = {},
  ): Promise<YouTubeRefreshResult> {
    const attemptAt = options.claimedAt ?? new Date();

    if (!options.claimedAt) {
      // Cron sync worker path: claim the Upload Sync mutex (ADR 0096 decision 2).
      const claimed = await this.claimUploadSyncRun(userId, attemptAt);

      if (!claimed) {
        return this.noopResult(userId);
      }
    }

    await this.pruneExpiredDisabledVideos(userId);
    const subscriptions = await this.prisma.youTubeSubscription.findMany({
      where: { userId, enabled: true },
    });

    if (subscriptions.length === 0) {
      await this.recordSyncState(userId, attemptAt, 'success', null);
      return this.noopResult(userId);
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

        // On success: update both lastSyncedAt and lastSyncAttemptAt to the run stamp,
        // and clear lastSyncError to stop marking as a Failing Channel.
        await this.prisma.youTubeSubscription.update({
          where: { id: subscription.id },
          data: {
            lastSyncedAt: attemptAt,
            lastSyncAttemptAt: attemptAt,
            lastSyncError: null,
          },
        });
      } catch (error) {
        failedChannels++;
        const channelError = getSyncErrorCode(error);
        lastSyncError = channelError;
        logger.error(
          `Failed to sync videos for channel ${subscription.channelId}: ${error}`,
        );

        // On failure: update lastSyncAttemptAt to the run stamp and set lastSyncError,
        // but leave lastSyncedAt alone to preserve the last good snapshot's freshness.
        await this.prisma.youTubeSubscription.update({
          where: { id: subscription.id },
          data: {
            lastSyncAttemptAt: attemptAt,
            lastSyncError: channelError,
          },
        });

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

  /** Channel Sync: refresh Followed Channels with a per-user 5-minute cooldown. */
  async syncChannels(userId: string): Promise<YouTubeChannelSyncResult> {
    const integration = await this.requireConnectedIntegration(userId);
    return this.runManualSync({
      userId,
      stamp: integration.lastChannelSyncAt,
      cooldownMs: CHANNEL_SYNC_COOLDOWN_MS,
      stampField: 'lastChannelSyncAt',
      onCooldown: (now, retryAt) =>
        this.channelCooldownResult(integration, now, retryAt),
      onCooldownClaimLost: (now) => {
        const channelStatus = this.getChannelSyncStatusFields(integration, now);
        return this.channelCooldownResult(
          integration,
          now,
          channelStatus.channelRetryAt ??
            new Date(now.getTime() + CHANNEL_SYNC_COOLDOWN_MS),
        );
      },
      claimMutex: (at) => this.claimChannelSyncRun(userId, at),
      onMutexLost: async (now) => {
        const current = await this.prisma.youTubeIntegration.findUniqueOrThrow({
          where: { userId },
        });
        const channelStatus = this.getChannelSyncStatusFields(current, now);
        return {
          synced: 0,
          status: channelStatus.channelStatus,
          lastAttemptAt: channelStatus.channelLastAttemptAt,
          lastError: channelStatus.channelLastError,
          retryAt: channelStatus.channelRetryAt,
        };
      },
      work: async (now) => {
        const subscriptions = await this.syncSubscriptions(userId);
        await this.prisma.youTubeIntegration.update({
          where: { userId },
          data: {
            lastChannelSyncStatus: 'success',
            lastChannelSyncError: null,
          },
        });
        const channelStatus = this.getChannelSyncStatusFields(
          await this.prisma.youTubeIntegration.findUniqueOrThrow({
            where: { userId },
          }),
          now,
        );
        return {
          synced: subscriptions.length,
          status: 'success' as const,
          lastAttemptAt: channelStatus.channelLastAttemptAt,
          lastError: null,
          retryAt: channelStatus.channelRetryAt,
        };
      },
      onError: async (now, error) => {
        logSyncAttemptFailure(
          `YouTube channel sync failed for user ${userId}`,
          error,
        );
        const status: YouTubeChannelSyncStatus = isQuotaExceededError(error)
          ? 'quota_exceeded'
          : 'failed';
        await this.prisma.youTubeIntegration.update({
          where: { userId },
          data: {
            lastChannelSyncStatus: status,
            lastChannelSyncError: getSyncErrorCode(error),
          },
        });
        const channelStatus = this.getChannelSyncStatusFields(
          await this.prisma.youTubeIntegration.findUniqueOrThrow({
            where: { userId },
          }),
          now,
        );
        return {
          synced: 0,
          status,
          lastAttemptAt: channelStatus.channelLastAttemptAt,
          lastError: channelStatus.channelLastError,
          retryAt: channelStatus.channelRetryAt,
        };
      },
    });
  }

  /** Upload Sync: refresh Cached Uploads with a per-user 15-minute cooldown. */
  async syncUploads(userId: string): Promise<YouTubeRefreshResult> {
    const integration = await this.requireConnectedIntegration(userId);
    return this.runManualSync({
      userId,
      stamp: integration.lastManualRefreshAt,
      cooldownMs: UPLOAD_SYNC_COOLDOWN_MS,
      stampField: 'lastManualRefreshAt',
      onCooldown: async (_now, retryAt) => ({
        ...(await this.noopResult(userId)),
        status: 'cooldown' as const,
        retryAt,
      }),
      onCooldownClaimLost: async (now) => {
        const currentStatus = await this.getSyncStatus(userId);
        return {
          subscriptionsSynced: 0,
          videosSynced: 0,
          ...currentStatus,
          status: 'cooldown' as const,
          retryAt:
            currentStatus.retryAt ??
            new Date(now.getTime() + UPLOAD_SYNC_COOLDOWN_MS),
        };
      },
      claimMutex: (at) => this.claimUploadSyncRun(userId, at),
      onMutexLost: () => this.noopResult(userId),
      work: (now) =>
        this.syncVideosForUserWithStatus(userId, { claimedAt: now }),
      onError: async (now, error) => {
        logSyncAttemptFailure(
          `YouTube upload sync failed for user ${userId}`,
          error,
        );
        const status: YouTubeSyncStatus = isQuotaExceededError(error)
          ? 'quota_exceeded'
          : 'failed';
        await this.recordSyncState(
          userId,
          now,
          status,
          getSyncErrorCode(error),
        );
        return { ...(await this.noopResult(userId)), status };
      },
    });
  }

  private async requireConnectedIntegration(userId: string) {
    const integration = await this.prisma.youTubeIntegration.findUnique({
      where: { userId },
    });
    if (!integration || integration.status !== 'connected') {
      throw new Error('YouTube account is not connected.');
    }
    return integration;
  }

  /**
   * Shared manual-attempt shape (ADR 0096 decision 3): cooldown check, optimistic
   * stamp claim, mutex claim with stamp restore on loss, then the attempt's work.
   * Channel Sync and Upload Sync differ in columns and the unit of work, not in
   * this sequence.
   */
  private async runManualSync<T>(options: {
    userId: string;
    stamp: Date | null;
    cooldownMs: number;
    stampField: ManualSyncStampField;
    onCooldown: (now: Date, retryAt: Date) => Promise<T> | T;
    onCooldownClaimLost: (now: Date) => Promise<T> | T;
    claimMutex: (at: Date) => Promise<boolean>;
    onMutexLost: (now: Date) => Promise<T> | T;
    work: (now: Date) => Promise<T>;
    onError: (now: Date, error: unknown) => Promise<T>;
  }): Promise<T> {
    const now = new Date();
    const cooldownUntil = options.stamp
      ? new Date(options.stamp.getTime() + options.cooldownMs)
      : null;

    if (cooldownUntil && cooldownUntil > now) {
      return options.onCooldown(now, cooldownUntil);
    }

    const claimedCooldown = await this.claimManualCooldown(
      options.userId,
      options.stampField,
      now,
      options.cooldownMs,
    );
    if (!claimedCooldown) {
      return options.onCooldownClaimLost(now);
    }

    const claimed = await options.claimMutex(now);
    if (!claimed) {
      await this.restoreManualStamp(
        options.userId,
        options.stampField,
        options.stamp,
      );
      return options.onMutexLost(now);
    }

    try {
      return await options.work(now);
    } catch (error) {
      return options.onError(now, error);
    }
  }

  private channelCooldownResult(
    integration: {
      lastChannelSyncStatus: string;
      lastChannelSyncAt: Date | null;
      lastChannelSyncError: string | null;
    },
    now: Date,
    retryAt: Date,
  ): YouTubeChannelSyncResult {
    const channelStatus = this.getChannelSyncStatusFields(integration, now);
    return {
      synced: 0,
      status: 'cooldown',
      lastAttemptAt: channelStatus.channelLastAttemptAt,
      lastError: channelStatus.channelLastError,
      retryAt,
    };
  }

  private async claimManualCooldown(
    userId: string,
    field: ManualSyncStampField,
    now: Date,
    cooldownMs: number,
  ): Promise<boolean> {
    const deadline = new Date(now.getTime() - cooldownMs);
    const stampIsClear =
      field === 'lastChannelSyncAt'
        ? {
            OR: [
              { lastChannelSyncAt: null },
              { lastChannelSyncAt: { lte: deadline } },
            ],
          }
        : {
            OR: [
              { lastManualRefreshAt: null },
              { lastManualRefreshAt: { lte: deadline } },
            ],
          };
    const claim = await this.prisma.youTubeIntegration.updateMany({
      where: { userId, status: 'connected', ...stampIsClear },
      data:
        field === 'lastChannelSyncAt'
          ? { lastChannelSyncAt: now }
          : { lastManualRefreshAt: now },
    });
    return claim.count === 1;
  }

  private async restoreManualStamp(
    userId: string,
    field: ManualSyncStampField,
    previous: Date | null,
  ): Promise<void> {
    await this.prisma.youTubeIntegration.update({
      where: { userId },
      data:
        field === 'lastChannelSyncAt'
          ? { lastChannelSyncAt: previous }
          : { lastManualRefreshAt: previous },
    });
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
        progress: null,
        channelStatus: 'never',
        channelLastAttemptAt: null,
        channelLastError: null,
        channelRetryAt: null,
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
      ? new Date(manualRefreshAt.getTime() + UPLOAD_SYNC_COOLDOWN_MS)
      : null;

    const channelFields = this.getChannelSyncStatusFields(integration, now);

    // Determine the reported upload status: if a persisted live status is past
    // the ADR 0096 upload TTL, project it as 'failed' with 'syncInterrupted'.
    // Read-time only — we do not write the correction back to the row.
    let reportedStatus = (integration.lastSyncStatus ??
      'never') as YouTubeSyncStatus;
    let reportedError = integration.lastSyncError ?? null;

    if (
      isLiveUploadSyncStatus(reportedStatus) &&
      !isUploadSyncLive(integration, now)
    ) {
      reportedStatus = 'failed';
      reportedError = 'syncInterrupted';
    }

    // Compute progress exactly when it has something to say: live runs and failure-bearing outcomes.
    // Success needs no channel breakdown (nothing failed) and never has no run, so the common page
    // load still pays for no aggregates. Every failure-bearing outcome carries its Failing Channels,
    // including Partial Sync (issue #193), Interrupted Sync (read-time recovery), and quota_exceeded
    // where the channel that hit the wall is the whole story of that run.
    let progress: YouTubeSyncProgressDTO | null = null;

    if (
      integration.lastSyncAttemptAt &&
      (reportedStatus === 'discovering' ||
        reportedStatus === 'running' ||
        reportedStatus === 'partial' ||
        reportedStatus === 'failed' ||
        reportedStatus === 'quota_exceeded')
    ) {
      // Fetch all Enabled Channels matching the run stamp in a single query for efficiency.
      const runStamp = integration.lastSyncAttemptAt;
      const channels = await this.prisma.youTubeSubscription.findMany({
        where: { userId, enabled: true },
        select: {
          channelId: true,
          channelTitle: true,
          lastSyncAttemptAt: true,
          lastSyncedAt: true,
          lastSyncError: true,
        },
      });

      const total = channels.length;
      let processed = 0;
      let succeeded = 0;
      let failed = 0;
      const failedChannels: Array<{
        channelId: string;
        channelTitle: string;
        error: string;
      }> = [];

      for (const channel of channels) {
        // A channel is processed if its lastSyncAttemptAt matches the run stamp.
        if (
          channel.lastSyncAttemptAt &&
          channel.lastSyncAttemptAt.getTime() === runStamp.getTime()
        ) {
          processed++;

          if (channel.lastSyncedAt?.getTime() === runStamp.getTime()) {
            succeeded++;
          }

          if (channel.lastSyncError) {
            failed++;
            failedChannels.push({
              channelId: channel.channelId,
              channelTitle: channel.channelTitle,
              error: channel.lastSyncError,
            });
          }
        }
      }

      progress = {
        total,
        processed,
        succeeded,
        failed,
        startedAt: runStamp,
        failedChannels,
      };
    }

    return {
      status: reportedStatus,
      lastSyncedAt: latestSubscription?.lastSyncedAt ?? null,
      lastSyncAttemptAt: integration.lastSyncAttemptAt ?? null,
      lastSyncError: reportedError,
      retryAt: retryAt && retryAt > now ? retryAt : null,
      progress,
      ...channelFields,
    };
  }

  private getChannelSyncStatusFields(
    integration: {
      lastChannelSyncStatus: string;
      lastChannelSyncAt: Date | null;
      lastChannelSyncError: string | null;
    },
    now: Date,
  ): Pick<
    YouTubeSyncStatusDTO,
    | 'channelStatus'
    | 'channelLastAttemptAt'
    | 'channelLastError'
    | 'channelRetryAt'
  > {
    const channelRetryAt = integration.lastChannelSyncAt
      ? new Date(
          integration.lastChannelSyncAt.getTime() + CHANNEL_SYNC_COOLDOWN_MS,
        )
      : null;

    let channelStatus = (integration.lastChannelSyncStatus ??
      'never') as YouTubeChannelSyncStatus;
    let channelLastError = integration.lastChannelSyncError ?? null;

    if (
      channelStatus === 'discovering' &&
      !isChannelSyncLive(integration, now)
    ) {
      channelStatus = 'failed';
      channelLastError = 'syncInterrupted';
    }

    return {
      channelStatus,
      channelLastAttemptAt: integration.lastChannelSyncAt ?? null,
      channelLastError,
      channelRetryAt:
        channelRetryAt && channelRetryAt > now ? channelRetryAt : null,
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
      /** Library slice by runtime. Defaults to `all` so existing callers are unaffected. */
      kind?: VideoKind;
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
      kind = 'all',
    } = options;

    const where: Record<string, unknown> = {
      userId,
      ...videoKindWhere(kind),
    };
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

  /** Set the Watched state for one of the user's Cached Uploads. */
  async setVideoWatched(
    userId: string,
    videoId: string,
    watched: boolean,
  ): Promise<number> {
    const result = await this.prisma.youTubeVideo.updateMany({
      where: { userId, videoId },
      data: { watched },
    });
    return result.count;
  }

  /**
   * Get videos grouped by channel for the channel-first directory.
   *
   * `kind` defaults to `long` here rather than `all`: this feeds the focused
   * long-form home, and the whole point of the separate Shorts page is that
   * short-form never appears on it (PRD #264, user story 14).
   */
  async getVideosGroupedByChannel(userId: string, kind: VideoKind = 'long') {
    const subscriptions = await this.prisma.youTubeSubscription.findMany({
      where: { userId, enabled: true },
      orderBy: { channelTitle: 'asc' },
      include: {
        videos: {
          where: videoKindWhere(kind),
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

  /** Get digest settings for a user. Absent settings read as opted out. */
  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    const settings = await this.prisma.youTubeNotificationSettings.findUnique({
      where: { userId },
    });
    return (
      settings ?? {
        enabled: false,
        lastNotifiedAt: null,
        preferredWeekday: DEFAULT_DIGEST_WEEKDAY,
        timeZone: null,
      }
    );
  }

  /**
   * Update digest settings. Turning the digest on stamps `optedInAt`, which is
   * the window start for the very first send — so opting in never back-fills
   * every Cached Upload the account has ever seen.
   */
  async updateNotificationSettings(
    userId: string,
    data: {
      enabled?: boolean;
      preferredWeekday?: number;
      timeZone?: string | null;
    },
  ): Promise<NotificationSettings> {
    if (data.preferredWeekday !== undefined) {
      if (
        !Number.isInteger(data.preferredWeekday) ||
        data.preferredWeekday < 0 ||
        data.preferredWeekday > 6
      ) {
        throw new Error(
          'Preferred weekday must be an integer from 0 (Sunday) to 6 (Saturday).',
        );
      }
    }

    if (data.timeZone) {
      if (!isSupportedTimeZone(data.timeZone)) {
        throw new Error('Time zone must be a valid IANA identifier.');
      }
    }

    const existing = await this.prisma.youTubeNotificationSettings.findUnique({
      where: { userId },
      select: { optedInAt: true },
    });

    const optedInNow = data.enabled === true && !existing?.optedInAt;

    return this.prisma.youTubeNotificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        enabled: data.enabled ?? false,
        preferredWeekday: data.preferredWeekday ?? DEFAULT_DIGEST_WEEKDAY,
        timeZone: data.timeZone ?? null,
        optedInAt: data.enabled === true ? new Date() : null,
      },
      update: {
        ...data,
        ...(optedInNow ? { optedInAt: new Date() } : {}),
      },
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
        durationSeconds: true,
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
          existing.publishedAt.getTime() !== video.publishedAt.getTime() ||
          // Duration participates in change detection so libraries cached
          // before duration collection are backfilled by the next sync
          // instead of staying permanently unclassified behind an
          // "unchanged" verdict.
          existing.durationSeconds !== video.durationSeconds
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
            durationSeconds: video.durationSeconds,
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

      await this.reapplyWatchedFromLedger(
        transaction,
        userId,
        snapshot.map((video) => video.videoId),
      );
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
        // `contentDetails` rides along on the call that already fetches
        // `snippet` — videos.list costs the same 1 unit either way, so Shorts
        // classification adds no quota against the shared project budget.
        const videoDetails = await youtube.videos.list({
          part: ['snippet', 'contentDetails'],
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
            durationSeconds: parseIso8601DurationSeconds(
              video.contentDetails?.duration,
            ),
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

  private purgeExpiredWatchedLedgerRows(
    transaction: Prisma.TransactionClient,
    userId: string,
  ) {
    return transaction.youTubeWatchedLedger.deleteMany({
      where: {
        userId,
        createdAt: { lt: new Date(Date.now() - WATCHED_LEDGER_TTL_MS) },
      },
    });
  }

  private async reapplyWatchedFromLedger(
    transaction: Prisma.TransactionClient,
    userId: string,
    videoIds: string[],
  ): Promise<void> {
    if (videoIds.length > 0) {
      const ledgerRows = await transaction.youTubeWatchedLedger.findMany({
        where: { userId, videoId: { in: videoIds } },
        select: { videoId: true },
      });

      if (ledgerRows.length > 0) {
        const reapplyIds = ledgerRows.map((row) => row.videoId);
        await transaction.youTubeVideo.updateMany({
          where: { userId, videoId: { in: reapplyIds } },
          data: { watched: true },
        });
        await transaction.youTubeWatchedLedger.deleteMany({
          where: { userId, videoId: { in: reapplyIds } },
        });
      }
    }

    await this.purgeExpiredWatchedLedgerRows(transaction, userId);
  }

  /**
   * Atomically claim the Upload Sync mutex (ADR 0096 decision 2).
   *
   * Returns true if the claim was won, false if a concurrent attempt is live.
   */
  private claimUploadSyncRun(userId: string, at: Date): Promise<boolean> {
    return this.claimSyncAttempt(userId, at, {
      lastSyncAttemptAt: at,
      lastSyncStatus: 'running',
      lastSyncError: null,
    });
  }

  /**
   * Atomically claim the Channel Sync mutex (ADR 0096 decision 2).
   *
   * Returns true if the claim was won, false if a concurrent attempt is live.
   * Does not touch upload sync columns.
   */
  private claimChannelSyncRun(userId: string, at: Date): Promise<boolean> {
    return this.claimSyncAttempt(userId, at, {
      lastChannelSyncAt: at,
      lastChannelSyncStatus: 'discovering',
      lastChannelSyncError: null,
    });
  }

  /** Optimistic mutex claim. The payload is the only per-attempt difference. */
  private async claimSyncAttempt(
    userId: string,
    at: Date,
    data: Prisma.YouTubeIntegrationUpdateManyMutationInput,
  ): Promise<boolean> {
    const runClaim = await this.prisma.youTubeIntegration.updateMany({
      where: youtubeSyncClaimableWhere(userId, at),
      data,
    });
    return runClaim.count === 1;
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

  /**
   * The result shape for a call that did no work: zero counts plus the
   * authoritative current status. Callers that need to override a field
   * (for example `status: 'cooldown'`) spread this and then set it.
   */
  private async noopResult(userId: string): Promise<YouTubeRefreshResult> {
    return {
      subscriptionsSynced: 0,
      videosSynced: 0,
      ...(await this.getSyncStatus(userId)),
    };
  }
}

const youtubeSyncService = new YouTubeSyncService(createPrismaClient());
export default youtubeSyncService;
