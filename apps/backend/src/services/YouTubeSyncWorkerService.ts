import winston from 'winston';
import { logErrorWithStack } from '../helpers/describeError';
import { PrismaClient, createPrismaClient } from '../prisma';
import workerLeaseService, {
  WorkerLease,
  WorkerLeaseService,
} from './WorkerLeaseService';
import youtubeSyncService from './YouTubeSyncService';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/** Lease name. Deliberately distinct from the digest worker's — they never block each other. */
export const SYNC_LEASE_NAME = 'youtube-sync';

/** Users read from the database per query. Keeps peak memory flat on shared hosting. */
export const SYNC_BATCH_SIZE = 10;

/** Hard ceiling on Users per cron tick, so a pass always ends well inside the lease. */
export const SYNC_MAX_USERS_PER_RUN = 100;

/** ADR 0129: a YouTube Connection Revoked for this long ends in a YouTube Disconnect. */
export const REVOKED_DISCONNECT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** ADR 0129: disconnect candidates read per pass. Skipped live rows are picked up by a later pass. */
export const SWEEP_MAX_CANDIDATES_PER_RUN = 25;

/**
 * ADR 0129: wall-clock budget for the disconnect sweep. Kept well under the
 * worker lease TTL (DEFAULT_LEASE_TTL_MS, 10 minutes) so the sweep never runs
 * on a lease it could lose; whatever is left waits for the next pass.
 */
export const SWEEP_TIME_BUDGET_MS = 3 * 60 * 1000;

export interface SyncWorkerResult {
  /** False when another pass held the lease; nothing was attempted. */
  ran: boolean;
  processed: number;
  usersSynced: number;
  failed: number;
  /** True when the worker reached the end of the User list this pass. */
  done: boolean;
  /** Resume point handed to the next tick; null once the list is exhausted. */
  cursor: string | null;
  /** Pre-existing Revoked rows stamped with `revokedAt` by this pass's sweep. */
  revokedStamped: number;
  /** Connections disconnected because Revoked for the full window. */
  disconnectedRevoked: number;
  /** Connections disconnected because the User no longer has YouTube Access. */
  disconnectedNoAccess: number;
  /** Candidates with a live Channel Sync or Upload Sync; left for a later pass. */
  skippedLive: number;
  /** Candidates whose disconnect threw; logged and skipped. */
  sweepFailed: number;
}

export interface SyncWorkerOptions {
  batchSize?: number;
  maxUsers?: number;
}

/**
 * Metadata sync for every connected account, as a bounded resumable worker.
 *
 * This worker only refreshes Cached Uploads. Digest delivery moved to
 * {@link YouTubeDigestService} so that a quota stall or one slow account here
 * can no longer swallow a week of mail — the two run on separate cron
 * endpoints and hold separate leases.
 */
export class YouTubeSyncWorkerService {
  constructor(
    private prisma: PrismaClient,
    private leases: WorkerLeaseService,
  ) {}

  /**
   * Sync one bounded slice of the User list. Safe to call on every cron tick:
   * it resumes where the last pass stopped and no-ops while another pass holds
   * the lease.
   */
  async runSyncWorker(
    options: SyncWorkerOptions = {},
  ): Promise<SyncWorkerResult> {
    const batchSize = options.batchSize ?? SYNC_BATCH_SIZE;
    const maxUsers = options.maxUsers ?? SYNC_MAX_USERS_PER_RUN;

    const owner = this.leases.newOwnerId('sync');
    const lease = await this.leases.acquire(SYNC_LEASE_NAME, owner);

    if (!lease) {
      logger.info('YouTube sync worker skipped: lease held by another pass');
      return {
        ran: false,
        processed: 0,
        usersSynced: 0,
        failed: 0,
        done: false,
        cursor: null,
        revokedStamped: 0,
        disconnectedRevoked: 0,
        disconnectedNoAccess: 0,
        skippedLive: 0,
        sweepFailed: 0,
      };
    }

    try {
      const result = await this.drainFrom(lease, batchSize, maxUsers);
      await this.sweepRevokedAndUnentitled(lease, result);
      return result;
    } finally {
      await this.leases.release(lease);
    }
  }

  private async drainFrom(
    lease: WorkerLease,
    batchSize: number,
    maxUsers: number,
  ): Promise<SyncWorkerResult> {
    const result: SyncWorkerResult = {
      ran: true,
      processed: 0,
      usersSynced: 0,
      failed: 0,
      done: false,
      cursor: lease.cursor,
      revokedStamped: 0,
      disconnectedRevoked: 0,
      disconnectedNoAccess: 0,
      skippedLive: 0,
      sweepFailed: 0,
    };

    while (result.processed < maxUsers) {
      const take = Math.min(batchSize, maxUsers - result.processed);
      const batch = await this.prisma.youTubeIntegration.findMany({
        where: {
          status: 'connected',
          // ADR 0129: Users without YouTube Access are skipped.
          user: { youtube_access: true },
          ...(result.cursor ? { userId: { gt: result.cursor } } : {}),
        },
        orderBy: { userId: 'asc' },
        take,
        select: { userId: true },
      });

      if (batch.length === 0) {
        result.done = true;
        result.cursor = null;
        break;
      }

      for (const { userId } of batch) {
        try {
          const synced = await youtubeSyncService.syncVideosForUser(userId);
          if (synced > 0) result.usersSynced++;
        } catch (error) {
          result.failed++;
          logErrorWithStack(
            logger,
            `YouTube sync failed for user ${userId}`,
            error,
          );

          if (await youtubeSyncService.markRevokedIfTokenError(userId, error)) {
            logger.info(`Marked integration as revoked for user ${userId}`);
          }
        }

        result.cursor = userId;
        result.processed++;
      }

      await this.leases.saveCursor(lease, result.cursor);
    }

    await this.leases.saveCursor(lease, result.cursor);
    return result;
  }

  /**
   * ADR 0129: runs after the normal sync work, under the same lease, and only
   * ever touches a bounded slice. It:
   *
   * 1. stamps `revokedAt` on pre-existing Revoked rows. The migration does not
   *    backfill, so those rows are treated as Revoked from the first pass after
   *    deploy, which starts their seven-day clock now;
   * 2. disconnects up to SWEEP_MAX_CANDIDATES_PER_RUN Connections that were
   *    Revoked for the full window, or whose User lost YouTube Access.
   *
   * It stops when the time budget is spent or the lease is no longer ours.
   */
  private async sweepRevokedAndUnentitled(
    lease: WorkerLease,
    result: SyncWorkerResult,
  ): Promise<void> {
    const startedAt = Date.now();
    const now = new Date(startedAt);
    const cutoff = new Date(startedAt - REVOKED_DISCONNECT_AFTER_MS);

    const stamped = await this.prisma.youTubeIntegration.updateMany({
      where: { status: 'revoked', revokedAt: null },
      data: { revokedAt: now },
    });
    result.revokedStamped = stamped.count;

    const candidates = await this.prisma.youTubeIntegration.findMany({
      where: {
        OR: [
          { status: 'revoked', revokedAt: { lte: cutoff } },
          { user: { youtube_access: false } },
        ],
      },
      orderBy: { userId: 'asc' },
      take: SWEEP_MAX_CANDIDATES_PER_RUN,
      select: { userId: true, status: true, revokedAt: true },
    });

    for (const candidate of candidates) {
      if (Date.now() - startedAt >= SWEEP_TIME_BUDGET_MS) break;
      if (!(await this.stillHoldsLease(lease))) break;

      const expiredRevoked =
        candidate.status === 'revoked' &&
        candidate.revokedAt !== null &&
        candidate.revokedAt <= cutoff;

      try {
        const outcome = await youtubeSyncService.disconnect(candidate.userId, {
          expectRevokeFailure: candidate.status === 'revoked',
        });

        if (outcome.ok === false) {
          // A live Channel Sync or Upload Sync is picked up by a later pass. Any other refusal means
          // the Connection was removed between the read and the disconnect.
          if (outcome.code === 'sync_run_live') {
            result.skippedLive++;
          }
          continue;
        }

        if (expiredRevoked) {
          result.disconnectedRevoked++;
        } else {
          result.disconnectedNoAccess++;
        }
      } catch (error) {
        result.sweepFailed++;
        logErrorWithStack(
          logger,
          `YouTube disconnect sweep failed for user ${candidate.userId}`,
          error,
        );
      }
    }

    logger.info('YouTube disconnect sweep finished', {
      revokedStamped: result.revokedStamped,
      disconnectedRevoked: result.disconnectedRevoked,
      disconnectedNoAccess: result.disconnectedNoAccess,
      skippedLive: result.skippedLive,
      sweepFailed: result.sweepFailed,
      candidatesRead: candidates.length,
    });
  }

  /** True while this pass still owns the lease and the lease has not expired. */
  private async stillHoldsLease(lease: WorkerLease): Promise<boolean> {
    const current = await this.prisma.youTubeWorkerLease.findUnique({
      where: { name: lease.name },
      select: { owner: true, expiresAt: true },
    });
    return (
      current !== null &&
      current.owner === lease.owner &&
      current.expiresAt > new Date()
    );
  }
}

const youTubeSyncWorkerService = new YouTubeSyncWorkerService(
  createPrismaClient(),
  workerLeaseService,
);
export default youTubeSyncWorkerService;
