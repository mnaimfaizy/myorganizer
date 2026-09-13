import type { YouTubeSyncStatus, FailingChannelInfo } from '../types';

/**
 * Progress model for a live Sync Run (ADR 0080, decision 1–2).
 *
 * The backend tracks per-channel outcomes (lastSyncedAt, lastSyncError) as a
 * run proceeds, so this file derives the counts and the view model from that
 * persisted state. Progress is computed here as a pure function rather than
 * inline in the component so the state machine is testable on its own and the
 * panel stays a renderer.
 *
 * Like syncFreshness.ts, the injected `now` parameter exists for testability.
 */

export type SyncPhase = 'discovering' | 'running' | 'done';

export interface SyncProgressReading {
  /** The current phase: "Finding your channels…" or "Syncing…" or terminal state label. */
  phaseLabel: string;
  /** Total Enabled Channels in this run. Null during discovering. */
  total: number | null;
  /** Channels processed so far (succeeded + failed). Null during discovering. */
  processed: number | null;
  /** Percentage complete. Null during discovering. */
  percentage: number | null;
  /** Elapsed time label like "1m 12s" or "48s". */
  elapsedLabel: string;
  /** Estimated time remaining, rounded to coarse buckets. Null if not available. */
  etaLabel: string | null;
  /** Whether this is an Interrupted Sync (run TTL exceeded). */
  isInterrupted: boolean;
  /** Whether the run is still in progress (discovering or running). */
  isLive: boolean;
  /** List of channels that failed this run. */
  failedChannels: FailingChannelInfo[];
  /**
   * Whether the panel should be rendered. True while a run is live or when the
   * run is terminal with failures to report. False when the run succeeded or
   * never ran.
   */
  hasSomethingToShow: boolean;
}

/**
 * True while a Sync Run is actively processing channels.
 */
export function isRunLive(
  status: YouTubeSyncStatus | null | undefined,
): boolean {
  if (!status) return false;
  return status.status === 'discovering' || status.status === 'running';
}

/**
 * True if the polling loop should continue.
 *
 * Stops when the run is terminal (not discovering/running).
 */
export function shouldPoll(
  status: YouTubeSyncStatus | null | undefined,
): boolean {
  return isRunLive(status);
}

/**
 * Elapsed time label.
 *
 * @param startedAt ISO timestamp when the run started.
 * @param now injected so tests do not rely on real time.
 */
function formatElapsed(startedAt: string, now: Date): string {
  try {
    const started = Date.parse(startedAt);
    if (Number.isNaN(started)) return '';
    const elapsedMs = now.getTime() - started;
    if (elapsedMs < 0) return '';

    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  } catch {
    return '';
  }
}

/**
 * Estimated time remaining, rounded to coarse buckets.
 *
 * ETA requires processed >= 5 to be meaningful — at one or two samples per
 * channel, the average swings wildly and reads as the app not knowing what
 * it is doing. VIDEO_SNAPSHOT_LIMIT = 100 in the backend caps each channel
 * at ~2 playlist pages plus 2 detail batches, so per-channel cost is uniform
 * once enough channels have completed.
 *
 * @param processed channels completed so far.
 * @param total channels to process.
 * @param startedAt ISO timestamp when the run started.
 * @param now injected so tests do not rely on real time.
 */
function estimateTimeRemaining(
  processed: number,
  total: number,
  startedAt: string,
  now: Date,
): string | null {
  if (processed < 5 || total <= processed) return null;

  try {
    const started = Date.parse(startedAt);
    if (Number.isNaN(started)) return null;

    const elapsedMs = now.getTime() - started;
    if (elapsedMs <= 0) return null;

    const remaining = total - processed;
    const timePerChannel = elapsedMs / processed;
    const remainingMs = remaining * timePerChannel;
    const remainingSeconds = Math.round(remainingMs / 1000);

    if (remainingSeconds < 60) {
      return 'less than a minute left';
    }

    const remainingMinutes = Math.round(remainingSeconds / 60);
    if (remainingMinutes === 1) {
      return 'about a minute left';
    }
    return `about ${remainingMinutes} minutes left`;
  } catch {
    return null;
  }
}

/**
 * Turns persisted sync state into what the User should see on the progress panel.
 *
 * During discovering: no count is meaningful, just a phase label.
 * During running: show processed/total, percentage, elapsed, and ETA when available.
 * On terminal states: show what was completed and whether it was interrupted.
 *
 * @param status the persisted sync status, or null while it is still loading.
 * @param now injected so the elapsed label advances smoothly between 2s polls.
 */
export function describeSyncProgress(
  status: YouTubeSyncStatus | null | undefined,
  now: Date = new Date(),
): SyncProgressReading {
  if (!status) {
    return {
      phaseLabel: 'Syncing…',
      total: null,
      processed: null,
      percentage: null,
      elapsedLabel: '',
      etaLabel: null,
      isInterrupted: false,
      isLive: false,
      failedChannels: [],
      hasSomethingToShow: false,
    };
  }

  const { progress } = status;
  const isDiscovering = status.status === 'discovering';
  const isRunning = status.status === 'running';
  const isLive = isDiscovering || isRunning;
  const isTerminal =
    status.status === 'partial' ||
    status.status === 'failed' ||
    status.status === 'quota_exceeded';

  // Nothing to show on success or never
  if (status.status === 'success' || status.status === 'never') {
    return {
      phaseLabel: '',
      total: null,
      processed: null,
      percentage: null,
      elapsedLabel: '',
      etaLabel: null,
      isInterrupted: false,
      isLive: false,
      failedChannels: [],
      hasSomethingToShow: false,
    };
  }

  if (isDiscovering) {
    return {
      phaseLabel: 'Finding your channels…',
      total: null,
      processed: null,
      percentage: null,
      elapsedLabel: '',
      etaLabel: null,
      isInterrupted: false,
      isLive: true,
      failedChannels: [],
      hasSomethingToShow: true,
    };
  }

  if (!progress) {
    // No progress data. Derive isLive from status, not from absence of progress —
    // absence means "nothing to report", not "still running". cooldown and running
    // with no progress yet should show as live; terminal states with no progress
    // (quota_exceeded if it fails before reaching any channels, etc.) should not.
    const isLiveNow = isRunning || isDiscovering;
    return {
      phaseLabel: isRunning ? 'Syncing…' : '',
      total: null,
      processed: null,
      percentage: null,
      elapsedLabel: '',
      etaLabel: null,
      isInterrupted: false,
      isLive: isLiveNow,
      failedChannels: [],
      hasSomethingToShow: isLiveNow,
    };
  }

  const { total, processed, succeeded, failed, startedAt, failedChannels } =
    progress;

  // Check for interrupted sync early so it can inform hasSomethingToShow.
  const isInterrupted =
    status.status === 'failed' && status.lastSyncError === 'syncInterrupted';

  const elapsedLabel = formatElapsed(startedAt, now);
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
  const etaLabel = isRunning
    ? estimateTimeRemaining(processed, total, startedAt, now)
    : null;

  // Determine phase label based on terminal status
  let phaseLabel = 'Syncing…';
  if (isTerminal) {
    if (status.status === 'partial') {
      // Show succeeded + failed to make it clear how many actually synced vs didn't
      phaseLabel = `${succeeded} of ${total} synced, ${failed} didn't`;
    } else if (status.status === 'failed') {
      phaseLabel = `Sync failed after ${processed} of ${total}`;
    } else if (status.status === 'quota_exceeded') {
      phaseLabel = 'YouTube quota reached';
    }
  }

  if (isInterrupted) {
    phaseLabel = `Interrupted after ${processed} of ${total}`;
  }

  // Show the panel while a run is live (discovering/running), when it was
  // interrupted (terminal state with no Failing Channels but counts to report),
  // or when there are Failing Channels to list. quota_exceeded leaves a
  // Failing Channel on the channel that hit the limit, so it is covered by
  // failedChannels.length > 0. A plain failed (auth error before the loop
  // starts) has neither counts nor channels, so it stays hidden (freshness
  // indicator already reports "Last sync failed").
  const hasSomethingToShow =
    isRunning || isDiscovering || isInterrupted || failedChannels.length > 0;

  return {
    phaseLabel,
    total,
    processed,
    percentage,
    elapsedLabel,
    etaLabel,
    isInterrupted,
    isLive,
    failedChannels,
    hasSomethingToShow,
  };
}
