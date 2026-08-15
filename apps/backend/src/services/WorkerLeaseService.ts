import { randomUUID } from 'crypto';
import { isUniqueViolation } from '../helpers/prismaErrors';
import { PrismaClient, createPrismaClient } from '../prisma';

/**
 * A lease currently held by this process, plus the cursor the previous pass
 * left behind. `cursor` is null when the last pass finished the whole list.
 */
export interface WorkerLease {
  name: string;
  owner: string;
  cursor: string | null;
}

/** Default lease lifetime. A pass that outlives it is treated as crashed. */
export const DEFAULT_LEASE_TTL_MS = 10 * 60 * 1000;

/**
 * Database-backed mutual exclusion and resume point for the bounded YouTube
 * workers.
 *
 * The cron wrapper takes a host `flock` first, which is enough while a single
 * box runs the job. This lease is the second belt: it survives a stale lock
 * file, covers a second host, and — unlike flock — carries the cursor, so a
 * pass that runs out of budget hands its position to the next tick instead of
 * restarting from the top.
 */
export class WorkerLeaseService {
  constructor(private prisma: PrismaClient) {}

  /** Mint an id identifying one worker pass. */
  newOwnerId(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
  }

  /**
   * Take the named lease, or return null when another live pass holds it.
   * An expired lease is stolen rather than waited on.
   */
  async acquire(
    name: string,
    owner: string,
    ttlMs: number = DEFAULT_LEASE_TTL_MS,
    now: Date = new Date(),
  ): Promise<WorkerLease | null> {
    const expiresAt = new Date(now.getTime() + ttlMs);

    const claimed = await this.prisma.youTubeWorkerLease.updateMany({
      where: { name, expiresAt: { lte: now } },
      data: { owner, acquiredAt: now, expiresAt },
    });

    if (claimed.count === 0) {
      // Either nobody has ever run this worker, or a live pass holds it.
      try {
        const created = await this.prisma.youTubeWorkerLease.create({
          data: { name, owner, acquiredAt: now, expiresAt },
        });
        return { name, owner, cursor: created.cursor ?? null };
      } catch (error) {
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    }

    const lease = await this.prisma.youTubeWorkerLease.findUnique({
      where: { name },
    });

    // Lost a race between the update and the read.
    if (!lease || lease.owner !== owner) return null;

    return { name, owner, cursor: lease.cursor ?? null };
  }

  /**
   * Persist the resume point and push the expiry out, so a long pass is not
   * declared dead while it is still working.
   */
  async saveCursor(
    lease: WorkerLease,
    cursor: string | null,
    ttlMs: number = DEFAULT_LEASE_TTL_MS,
    now: Date = new Date(),
  ): Promise<void> {
    await this.prisma.youTubeWorkerLease.updateMany({
      where: { name: lease.name, owner: lease.owner },
      data: { cursor, expiresAt: new Date(now.getTime() + ttlMs) },
    });
  }

  /** Expire the lease immediately so the next tick can start without waiting. */
  async release(lease: WorkerLease, now: Date = new Date()): Promise<void> {
    await this.prisma.youTubeWorkerLease.updateMany({
      where: { name: lease.name, owner: lease.owner },
      data: { expiresAt: now },
    });
  }
}

const workerLeaseService = new WorkerLeaseService(createPrismaClient());
export default workerLeaseService;
