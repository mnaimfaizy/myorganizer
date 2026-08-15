import winston from 'winston';
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
}

export interface SyncWorkerOptions {
  batchSize?: number;
  maxUsers?: number;
}

function isRevokedTokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('invalid_grant') ||
    message.includes('Token has been expired or revoked')
  );
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
      };
    }

    try {
      return await this.drainFrom(lease, batchSize, maxUsers);
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
          logger.error(`YouTube sync failed for user ${userId}: ${error}`);

          if (isRevokedTokenError(error)) {
            await this.prisma.youTubeIntegration.update({
              where: { userId },
              data: { status: 'revoked' },
            });
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
}

const youTubeSyncWorkerService = new YouTubeSyncWorkerService(
  createPrismaClient(),
  workerLeaseService,
);
export default youTubeSyncWorkerService;
