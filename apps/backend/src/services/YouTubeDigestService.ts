import { randomBytes } from 'crypto';
import winston from 'winston';
import { isoWeekKey, localWeekday } from '../helpers/localCalendar';
import { isUniqueViolation } from '../helpers/prismaErrors';
import { videoKindWhere } from '../helpers/videoKind';
import { PrismaClient, createPrismaClient } from '../prisma';
import sendEmail from './EmailService';
import workerLeaseService, {
  WorkerLease,
  WorkerLeaseService,
} from './WorkerLeaseService';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/** Lease name. Deliberately distinct from the sync worker's — they never block each other. */
export const DIGEST_LEASE_NAME = 'youtube-digest';

/** Users read from the database per query. Keeps peak memory flat on shared hosting. */
export const DIGEST_BATCH_SIZE = 25;

/** Hard ceiling on Users per cron tick, so a pass always ends well inside the lease. */
export const DIGEST_MAX_USERS_PER_RUN = 200;

/** Upper bound on Cached Uploads listed in one email (PRD: ~20-30). */
export const DIGEST_ITEM_CAP = 25;

export type DigestOutcome =
  | 'sent'
  | 'skipped_empty'
  | 'not_due'
  | 'duplicate'
  | 'failed';

export interface DigestWorkerResult {
  /** False when another pass held the lease; nothing was attempted. */
  ran: boolean;
  processed: number;
  sent: number;
  skippedEmpty: number;
  notDue: number;
  duplicates: number;
  failed: number;
  /** True when the worker reached the end of the User list this pass. */
  done: boolean;
  /** Resume point handed to the next tick; null once the list is exhausted. */
  cursor: string | null;
}

export interface DigestWorkerOptions {
  now?: Date;
  batchSize?: number;
  maxUsers?: number;
}

interface DigestVideo {
  videoId: string;
  channelId: string;
  title: string;
  thumbnail: string | null;
  publishedAt: Date;
  subscription: { channelTitle: string };
}

function frontendUrl(): string {
  return (process.env.APP_FRONTEND_URL ?? 'http://localhost:4200').replace(
    /\/+$/,
    '',
  );
}

/**
 * Weekly New-only digest delivery, running as its own bounded, resumable
 * worker.
 *
 * Kept apart from {@link YouTubeSyncWorkerService} on purpose: metadata sync
 * burns YouTube quota and can stall on one slow account, and when the two
 * shared a cron tick a sync failure silently swallowed that week's mail. The
 * two now hold separate leases, separate cursors, and separate cron endpoints,
 * so neither can starve the other.
 *
 * Every delivery is claimed in a ledger keyed by User + local ISO week before
 * anything reaches SMTP. A pass that dies mid-send therefore leaves a claimed
 * row that no later pass will re-send: losing one week's digest is the
 * deliberate trade against mailing the same week twice. An empty Window does
 * not create a Digest Delivery (ADR 0016).
 */
export class YouTubeDigestService {
  constructor(
    private prisma: PrismaClient,
    private leases: WorkerLeaseService,
  ) {}

  /**
   * Process one bounded slice of the User list. Safe to call on every cron
   * tick: it resumes where the last pass stopped and no-ops while another
   * pass holds the lease.
   */
  async runDigestWorker(
    options: DigestWorkerOptions = {},
  ): Promise<DigestWorkerResult> {
    const now = options.now ?? new Date();
    const batchSize = options.batchSize ?? DIGEST_BATCH_SIZE;
    const maxUsers = options.maxUsers ?? DIGEST_MAX_USERS_PER_RUN;

    const owner = this.leases.newOwnerId('digest');
    const lease = await this.leases.acquire(DIGEST_LEASE_NAME, owner);

    if (!lease) {
      logger.info('YouTube digest worker skipped: lease held by another pass');
      return {
        ran: false,
        processed: 0,
        sent: 0,
        skippedEmpty: 0,
        notDue: 0,
        duplicates: 0,
        failed: 0,
        done: false,
        cursor: null,
      };
    }

    try {
      return await this.drainFrom(lease, now, batchSize, maxUsers);
    } finally {
      await this.leases.release(lease);
    }
  }

  private async drainFrom(
    lease: WorkerLease,
    now: Date,
    batchSize: number,
    maxUsers: number,
  ): Promise<DigestWorkerResult> {
    const result: DigestWorkerResult = {
      ran: true,
      processed: 0,
      sent: 0,
      skippedEmpty: 0,
      notDue: 0,
      duplicates: 0,
      failed: 0,
      done: false,
      cursor: lease.cursor,
    };

    while (result.processed < maxUsers) {
      const take = Math.min(batchSize, maxUsers - result.processed);
      const batch = await this.prisma.youTubeIntegration.findMany({
        where: {
          status: 'connected',
          ...(result.cursor ? { userId: { gt: result.cursor } } : {}),
        },
        orderBy: { userId: 'asc' },
        take,
        select: { userId: true, createdAt: true },
      });

      if (batch.length === 0) {
        result.done = true;
        result.cursor = null;
        break;
      }

      for (const integration of batch) {
        const outcome = await this.deliverDigestForUser(
          integration.userId,
          integration.createdAt,
          now,
        );
        this.tally(result, outcome);
        result.cursor = integration.userId;
        result.processed++;
      }

      await this.leases.saveCursor(lease, result.cursor);
    }

    await this.leases.saveCursor(lease, result.cursor);
    return result;
  }

  private tally(result: DigestWorkerResult, outcome: DigestOutcome): void {
    if (outcome === 'sent') result.sent++;
    else if (outcome === 'skipped_empty') result.skippedEmpty++;
    else if (outcome === 'not_due') result.notDue++;
    else if (outcome === 'duplicate') result.duplicates++;
    else result.failed++;
  }

  /**
   * Decide and deliver one User's digest for the local week containing `now`.
   * Never throws: one bad account must not end the pass.
   */
  async deliverDigestForUser(
    userId: string,
    connectedAt: Date,
    now: Date = new Date(),
  ): Promise<DigestOutcome> {
    const settings = await this.prisma.youTubeNotificationSettings.findUnique({
      where: { userId },
    });

    // Opt-in only: no settings row, or the toggle off, means no mail.
    if (!settings || !settings.enabled) return 'not_due';

    const timeZone = settings.timeZone ?? null;
    if (localWeekday(now, timeZone) !== settings.preferredWeekday) {
      return 'not_due';
    }

    const periodKey = isoWeekKey(now, timeZone);
    // Window runs from the last successful send, falling back to when the
    // User opted in, then to when they connected — never further back.
    const windowStart =
      settings.lastNotifiedAt ?? settings.optedInAt ?? connectedAt;

    const videos = (await this.prisma.youTubeVideo.findMany({
      where: {
        userId,
        watched: false,
        publishedAt: { gt: windowStart },
        subscription: { enabled: true },
        // Long-form only. Shorts live behind the Daily Budget on their own
        // page, and the digest's per-item link is the long-form channel
        // page — mailing a Short would land the reader somewhere it is not
        // shown.
        ...videoKindWhere('long'),
      },
      orderBy: { publishedAt: 'desc' },
      take: DIGEST_ITEM_CAP,
      include: { subscription: { select: { channelTitle: true } } },
    })) as DigestVideo[];

    // An empty Window is not a send attempt. Do not claim the Period, so a
    // later tick the same local day (for example after sync catches up) can
    // still send. See ADR 0016.
    if (videos.length === 0) return 'skipped_empty';

    const claim = await this.claimPeriod(userId, periodKey);
    if (!claim) return 'duplicate';

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, first_name: true },
      });

      if (!user) {
        await this.finishPeriod(userId, periodKey, 'failed', 0, 'user_missing');
        return 'failed';
      }

      const token = await this.ensureUnsubscribeToken(userId, settings);
      const html = this.buildDigestHtml(user.first_name, videos, token);

      await sendEmail(
        user.email,
        `${videos.length} new video${videos.length > 1 ? 's' : ''} waiting in MyOrganizer`,
        html,
      );

      await this.finishPeriod(userId, periodKey, 'sent', videos.length);
      await this.prisma.youTubeNotificationSettings.update({
        where: { userId },
        data: { lastNotifiedAt: now },
      });

      logger.info(
        `Sent YouTube digest for ${periodKey} to user ${userId} with ${videos.length} Cached Uploads`,
      );
      return 'sent';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.finishPeriod(userId, periodKey, 'failed', 0, message);
      logger.error(`YouTube digest failed for user ${userId}: ${message}`);
      return 'failed';
    }
  }

  /**
   * Reserve this User + period. The unique constraint is the idempotency
   * guard, so a losing writer sees P2002 rather than sending a second copy.
   */
  private async claimPeriod(
    userId: string,
    periodKey: string,
  ): Promise<boolean> {
    try {
      await this.prisma.youTubeDigestDelivery.create({
        data: { userId, periodKey, status: 'claimed' },
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  private async finishPeriod(
    userId: string,
    periodKey: string,
    status: 'sent' | 'failed',
    itemCount: number,
    error?: string,
  ): Promise<void> {
    await this.prisma.youTubeDigestDelivery.update({
      where: { userId_periodKey: { userId, periodKey } },
      data: {
        status,
        itemCount,
        sentAt: status === 'sent' ? new Date() : null,
        error: error ?? null,
      },
    });
  }

  /** Mint the unsubscribe secret on first use and reuse it thereafter. */
  private async ensureUnsubscribeToken(
    userId: string,
    settings: { unsubscribeToken: string | null },
  ): Promise<string> {
    if (settings.unsubscribeToken) return settings.unsubscribeToken;

    const token = randomBytes(32).toString('hex');
    await this.prisma.youTubeNotificationSettings.update({
      where: { userId },
      data: { unsubscribeToken: token },
    });
    return token;
  }

  /** Turn the digest opt-in off from an email link. Unknown tokens are a no-op. */
  async unsubscribe(token: string): Promise<boolean> {
    if (!token) return false;

    const updated = await this.prisma.youTubeNotificationSettings.updateMany({
      where: { unsubscribeToken: token },
      data: { enabled: false },
    });

    return updated.count > 0;
  }

  private buildDigestHtml(
    firstName: string,
    videos: DigestVideo[],
    unsubscribeToken: string,
  ): string {
    const base = frontendUrl();
    const homeUrl = `${base}/dashboard/youtube`;
    const settingsUrl = `${base}/dashboard/youtube`;
    const unsubscribeUrl = `${base}/youtube/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

    const rows = videos
      .map((video) => {
        // Every link lands back in MyOrganizer, never on youtube.com — the
        // digest exists to return the User to the focused experience.
        const watchUrl = `${base}/dashboard/youtube/channel/${encodeURIComponent(video.channelId)}`;
        return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <a href="${watchUrl}" style="text-decoration: none; color: #1a1a1a;">
            ${video.thumbnail ? `<img src="${this.escapeHtml(video.thumbnail)}" alt="" width="168" height="94" style="border-radius: 4px; margin-bottom: 4px; display: block;" />` : ''}
            <strong>${this.escapeHtml(video.title)}</strong>
          </a>
          <br/>
          <span style="color: #666; font-size: 13px;">
            ${this.escapeHtml(video.subscription.channelTitle)} &middot; ${video.publishedAt.toLocaleDateString()}
          </span>
        </td>
      </tr>`;
      })
      .join('');

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Hi ${this.escapeHtml(firstName)},</h2>
        <p style="color: #444;">Here is what is still new from your enabled channels. Watched uploads are left out.</p>
        <p style="margin: 20px 0;">
          <a href="${homeUrl}" style="background: #1a1a1a; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Open MyOrganizer
          </a>
        </p>
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          ${rows}
        </table>
        <p style="margin-top: 24px; color: #666; font-size: 13px;">
          MyOrganizer stores YouTube metadata only — never video files.
          <a href="${settingsUrl}" style="color: #666;">Digest settings</a> &middot;
          <a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe</a>
        </p>
      </div>
    `;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

const youTubeDigestService = new YouTubeDigestService(
  createPrismaClient(),
  workerLeaseService,
);
export default youTubeDigestService;
