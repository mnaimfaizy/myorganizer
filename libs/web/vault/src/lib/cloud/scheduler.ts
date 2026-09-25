import { EscapeCopyAgeLimit } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const ESCAPE_COPY_AGE_LIMIT_MS = {
  off: null,
  '1-day': 1 * MS_PER_DAY,
  '1-week': 7 * MS_PER_DAY,
  '1-month': 30 * MS_PER_DAY,
} as const satisfies Record<EscapeCopyAgeLimit, number | null>;

/**
 * True when the newest Escape Copy is older than the User's Escape Copy Age
 * Limit, or when there is no Escape Copy at all. Always false when the limit
 * is `off`: with no limit set, no age is too old.
 */
export function isEscapeCopyOverdue(input: {
  ageLimit: EscapeCopyAgeLimit;
  newestCopyMs: number | null;
  nowMs: number;
}): boolean {
  const limit = ESCAPE_COPY_AGE_LIMIT_MS[input.ageLimit];
  if (limit === null) return false;
  if (input.newestCopyMs === null) return true;
  return input.nowMs - input.newestCopyMs >= limit;
}

export interface SchedulerCallbacks {
  /**
   * Resolve the time (ms since epoch) the newest confirmed Escape Copy was
   * made at this provider, or `null` when there is none.
   */
  getNewestCopyMs(): Promise<number | null>;
  /** Returns the User's current Escape Copy Age Limit. */
  getAgeLimit(): EscapeCopyAgeLimit;
  /**
   * True when a backup can run without asking the User for anything. MUST NOT
   * attempt to obtain a token: this runs with nobody present, and a prompt
   * outside a user gesture is blocked by the browser.
   */
  canRunWithoutPrompt(): boolean;
  /** Run an actual backup attempt. */
  runBackup(): Promise<void>;
  /** Optional `now` provider for tests. */
  now?: () => number;
}

export type SchedulerCheckResult = {
  ranBackup: boolean;
  /**
   * Why no backup ran. `needs-prompt` means the copy is overdue but making one
   * would need the User — the vault page shows the Overdue state instead.
   */
  skipped?: 'off' | 'not-overdue' | 'needs-prompt' | 'in-flight';
};

export interface SchedulerHandle {
  /** Run a one-shot overdue check. */
  checkOnce(): Promise<SchedulerCheckResult>;
  /** Stop background timers and listeners. */
  stop(): void;
}

export interface StartSchedulerOptions extends SchedulerCallbacks {
  /** How often to poll while the session is active. Default: 15 minutes. */
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Client-only Escape Copy Age Limit check. Only runs while the app is open.
 *
 * It listens for `visibilitychange` and `online` events and additionally
 * polls on a timer. It calls `runBackup` only when:
 *
 * 1. The Escape Copy Age Limit is not `off`.
 * 2. The newest Escape Copy is older than the limit, or there is none.
 * 3. `canRunWithoutPrompt()` is true — a token is already held.
 * 4. No prior `runBackup` is still in flight.
 *
 * It never prompts, so it never makes a copy on a clock; an overdue copy that
 * needs the User is reported by the vault page, not produced here
 * (ADR 0062).
 */
export function startScheduler(
  options: StartSchedulerOptions,
): SchedulerHandle {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());

  let inFlight = false;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function checkOnce(): Promise<SchedulerCheckResult> {
    if (stopped) return { ranBackup: false, skipped: 'in-flight' };
    if (inFlight) return { ranBackup: false, skipped: 'in-flight' };
    const ageLimit = options.getAgeLimit();
    if (ageLimit === 'off') return { ranBackup: false, skipped: 'off' };

    const newestCopyMs = await options.getNewestCopyMs();
    if (!isEscapeCopyOverdue({ ageLimit, newestCopyMs, nowMs: now() })) {
      return { ranBackup: false, skipped: 'not-overdue' };
    }

    if (!options.canRunWithoutPrompt()) {
      return { ranBackup: false, skipped: 'needs-prompt' };
    }

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
