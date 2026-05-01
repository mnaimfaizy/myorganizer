import { CloudBackupAutoInterval } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const INTERVAL_MS: Record<CloudBackupAutoInterval, number | null> = {
  off: null,
  daily: 1 * MS_PER_DAY,
  weekly: 7 * MS_PER_DAY,
  monthly: 30 * MS_PER_DAY,
};

/**
 * Returns true when `nowMs - lastSuccessMs >= interval threshold`. When
 * `lastSuccessMs` is `null` the result is always true (the user has no
 * recorded successful cloud backup yet).
 *
 * Returns false when `interval === 'off'`.
 */
export function isBackupDue(input: {
  interval: CloudBackupAutoInterval;
  lastSuccessMs: number | null;
  nowMs: number;
}): boolean {
  const threshold = INTERVAL_MS[input.interval];
  if (threshold === null) return false;
  if (input.lastSuccessMs === null) return true;
  return input.nowMs - input.lastSuccessMs >= threshold;
}

export interface SchedulerCallbacks {
  /**
   * Resolve the timestamp (ms since epoch) of the latest successful cloud
   * backup for the configured provider, or `null` when none exists. The
   * scheduler uses this as the source of truth for due-time calculation.
   */
  getLastSuccessMs(): Promise<number | null>;
  /** Returns the configured auto-backup interval (`off | daily | …`). */
  getInterval(): CloudBackupAutoInterval;
  /** Returns true when the provider can run a backup right now. */
  canRunNow(): Promise<boolean>;
  /** Run an actual backup attempt. */
  runBackup(): Promise<void>;
  /** Optional `now` provider for tests. */
  now?: () => number;
}

export interface SchedulerHandle {
  /** Run a one-shot due-check. */
  checkOnce(): Promise<{
    ranBackup: boolean;
    skipped?: 'off' | 'not-due' | 'cannot-run' | 'in-flight';
  }>;
  /** Stop background timers and listeners. */
  stop(): void;
}

export interface StartSchedulerOptions extends SchedulerCallbacks {
  /** How often to poll while the session is active. Default: 15 minutes. */
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Lightweight client-only scheduler. Only runs while the app is open.
 *
 * The scheduler listens for `visibilitychange` and `online` events and
 * additionally polls on a timer. It calls `runBackup` only when:
 *
 * 1. The configured interval is not `off`.
 * 2. `getLastSuccessMs()` shows the interval has elapsed (or is `null`).
 * 3. `canRunNow()` returns true (e.g. token is silently available).
 * 4. No prior `runBackup` is still in flight.
 *
 * The scheduler MUST NEVER trigger an interactive OAuth prompt; that is the
 * provider's responsibility, and the provider's `canRunNow` should return
 * `false` when consent must be reacquired.
 */
export function startScheduler(
  options: StartSchedulerOptions,
): SchedulerHandle {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());

  let inFlight = false;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function checkOnce(): Promise<{
    ranBackup: boolean;
    skipped?: 'off' | 'not-due' | 'cannot-run' | 'in-flight';
  }> {
    if (stopped) return { ranBackup: false, skipped: 'in-flight' };
    if (inFlight) return { ranBackup: false, skipped: 'in-flight' };
    const interval = options.getInterval();
    if (interval === 'off') return { ranBackup: false, skipped: 'off' };

    const last = await options.getLastSuccessMs();
    if (
      !isBackupDue({
        interval,
        lastSuccessMs: last,
        nowMs: now(),
      })
    ) {
      return { ranBackup: false, skipped: 'not-due' };
    }

    const canRun = await options.canRunNow();
    if (!canRun) return { ranBackup: false, skipped: 'cannot-run' };

    inFlight = true;
    try {
      await options.runBackup();
      return { ranBackup: true };
    } finally {
      inFlight = false;
    }
  }

  // Wire up listeners only in browser-like environments.
  const onVisibility = () => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible'
    ) {
      void checkOnce();
    }
  };
  const onOnline = () => {
    void checkOnce();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }

  if (typeof setInterval !== 'undefined') {
    timer = setInterval(() => {
      void checkOnce();
    }, pollIntervalMs);
  }

  return {
    checkOnce,
    stop: () => {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
      }
    },
  };
}
