import type { YouTubeSyncStatus } from '../types';

/**
 * Freshness reading for the Cached Upload library (PRD #264, user story 27).
 *
 * The backend already persists everything needed to tell a User whether their
 * library is current — `status`, `lastSyncedAt`, and a `lastSyncError` code —
 * but the page only ever rendered the timestamp. A failed or quota-stalled
 * nightly sync therefore looked identical to a healthy one: a stale "Last
 * synced" line and no hint that anything was wrong.
 *
 * The reading is derived here as a pure function rather than inline in the
 * page so the state machine is testable on its own and the component stays a
 * renderer. Deliberately no per-video staleness: story 27 asks for one library
 * level indicator, not stale badges scattered across uploads.
 */

/**
 * How stale a successful sync may get before the library is called delayed.
 *
 * Automatic sync is daily (user story 22), and the cron sweep is cursor-based
 * across every connected account, so a healthy account can legitimately land
 * slightly past the 24-hour mark. Half a day of grace on top keeps a merely
 * late sweep from crying wolf while still catching a sync that has actually
 * stopped running.
 */
export const SYNC_DELAYED_AFTER_MS = 36 * 60 * 60 * 1000;

/**
 * How loudly the indicator should present itself.
 *
 * `pending` is deliberately distinct from `ok`: "we do not know yet" and
 * "everything is current" must not look the same, or a slow status fetch reads
 * as a healthy library.
 */
export type SyncFreshnessTone = 'ok' | 'pending' | 'warning' | 'error';

export interface SyncFreshnessReading {
  tone: SyncFreshnessTone;
  /**
   * Short state label. Null while the library is current and healthy — a
   * working sync should not add chrome to the page.
   */
  label: string | null;
  /** The "Last synced …" line. Always present, whatever the state. */
  lastSyncedLabel: string;
  /** One sentence on what happened and what happens next. Null when current. */
  detail: string | null;
  /**
   * Whether retrying now would plausibly help. False for a quota stall — the
   * project quota is exhausted for everyone, so retrying only burns the
   * User's manual-refresh cooldown for nothing (user story 41).
   */
  suggestRetry: boolean;
}

function formatTimestamp(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function lastSyncedLine(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return 'Never synced';
  const formatted = formatTimestamp(lastSyncedAt);
  return formatted ? `Last synced ${formatted}` : 'Never synced';
}

/**
 * True once a successful sync is older than {@link SYNC_DELAYED_AFTER_MS}.
 * An unparseable or absent timestamp is not treated as delayed — "no reading"
 * is handled by the `never` branch rather than reported as a stall.
 */
function isDelayed(lastSyncedAt: string | null, now: Date): boolean {
  if (!lastSyncedAt) return false;
  const synced = Date.parse(lastSyncedAt);
  if (Number.isNaN(synced)) return false;
  return now.getTime() - synced > SYNC_DELAYED_AFTER_MS;
}

/**
 * Turns persisted sync state into what the User should be told.
 *
 * Failure states are read before staleness: a library that is both stale and
 * failing should say why it is failing, not merely that it is old. Within the
 * failure states, a quota stall outranks an ordinary failure because the
 * remedy differs — waiting versus retrying.
 *
 * @param status the persisted sync status, or null while it is still loading.
 * @param now injected so the delayed threshold is testable without fake timers.
 */
export function describeSyncFreshness(
  status: YouTubeSyncStatus | null | undefined,
  now: Date = new Date(),
): SyncFreshnessReading {
  if (!status) {
    return {
      tone: 'pending',
      label: null,
      lastSyncedLabel: 'Checking sync status…',
      detail: null,
      suggestRetry: false,
    };
  }

  const lastSyncedLabel = lastSyncedLine(status.lastSyncedAt);

  switch (status.status) {
    case 'quota_exceeded':
      return {
        tone: 'error',
        label: 'Sync paused — YouTube quota reached',
        lastSyncedLabel,
        detail:
          'The daily YouTube quota is used up, so syncing stopped. Your cached uploads stay available and sync resumes on its own once the quota resets.',
        suggestRetry: false,
      };

    case 'failed':
      return {
        tone: 'error',
        label: 'Last sync failed',
        lastSyncedLabel,
        detail:
          'No channel synced on the last attempt, so you are seeing the last good snapshot. Retry to try again now.',
        suggestRetry: true,
      };

    case 'partial':
      return {
        tone: 'warning',
        label: 'Some channels did not sync',
        lastSyncedLabel,
        detail:
          'At least one channel failed on the last attempt. Those channels still show their last good snapshot.',
        suggestRetry: true,
      };

    case 'running':
      return {
        tone: 'pending',
        label: 'Syncing…',
        lastSyncedLabel,
        detail: null,
        suggestRetry: false,
      };

    case 'never':
      return {
        tone: 'pending',
        label: null,
        lastSyncedLabel: 'Never synced',
        detail:
          'Enable a channel and refresh to cache its recent uploads here.',
        suggestRetry: false,
      };

    // 'cooldown' is a manual-refresh outcome rather than a health state — the
    // Retry control already reports its own cooldown, so the library reading
    // falls through to the ordinary success/delayed check.
    case 'cooldown':
    case 'success':
    default:
      break;
  }

  if (isDelayed(status.lastSyncedAt, now)) {
    return {
      tone: 'warning',
      label: 'Sync delayed',
      lastSyncedLabel,
      detail:
        'Automatic sync has not completed in over a day, so newer uploads may be missing. Retry to sync now.',
      suggestRetry: true,
    };
  }

  return {
    tone: 'ok',
    label: null,
    lastSyncedLabel,
    detail: null,
    suggestRetry: false,
  };
}
