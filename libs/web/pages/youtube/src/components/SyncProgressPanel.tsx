'use client';

import { cn } from '@myorganizer/web-ui';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { describeSyncProgress } from '../lib/syncProgress';
import type { YouTubeSyncStatus } from '../types';

interface SyncProgressPanelProps {
  /**
   * Persisted sync status while a run is live.
   * Null or undefined when no run is in progress.
   */
  status: YouTubeSyncStatus | null | undefined;
  className?: string;
}

/**
 * Progress panel for a live Sync Run (ADR 0080, decision 1–2).
 *
 * Renders alongside SyncFreshnessIndicator and shows:
 * - Phase label ("Finding your channels…", "Syncing…", or terminal state)
 * - Progress bar with "N of M channels" label (null during discovering)
 * - Elapsed time and ETA (when available)
 * - "Syncing continues even if you leave this page" — per ADR 0080 decision 1,
 *   the work stays inline and completes regardless of client disconnect, so the
 *   User need not be warned to keep the page open.
 * - On a Partial Sync or Interrupted Sync: list of channels that failed
 *
 * Accessibility:
 * - Progress bar has `role="progressbar"` and `aria-valuenow`/min/max
 * - Phase and failure list are announced via a polite live region that does not
 *   spam on every poll (~2s), avoiding screen reader fatigue
 * - Failure list conveys failure in words, not by colour alone
 */
export function SyncProgressPanel({
  status,
  className,
}: SyncProgressPanelProps) {
  // Local timer ticks every second so the elapsed label advances smoothly
  // between the 2s poll updates from the server.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const reading = describeSyncProgress(status, now);

  // Nothing to show when the panel has no content
  if (!reading.hasSomethingToShow) {
    return null;
  }

  // Announcement for screen readers: phase, completion status, and failure list.
  // We announce only the essential state, not the live-updating elapsed time,
  // to avoid spamming the screen reader every 2 seconds.
  const announcement = [
    reading.phaseLabel,
    reading.total !== null &&
      `${reading.processed} of ${reading.total} channels`,
    reading.isInterrupted && 'This sync was interrupted.',
    reading.failedChannels.length > 0 &&
      `${reading.failedChannels.length} channel${reading.failedChannels.length === 1 ? '' : 's'} failed: ${reading.failedChannels.map((ch) => ch.channelTitle).join(', ')}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-muted p-4 space-y-3',
        className,
      )}
      role="region"
      aria-labelledby="sync-progress-label"
    >
      {/* Phase label */}
      <div>
        <h3
          id="sync-progress-label"
          className="text-sm font-semibold text-foreground"
        >
          {reading.phaseLabel}
        </h3>
      </div>

      {/* Progress bar (only when counts are available) */}
      {reading.total !== null && reading.processed !== null && (
        <div>
          {/* Bar container */}
          <div
            role="progressbar"
            aria-valuenow={reading.processed}
            aria-valuemin={0}
            aria-valuemax={reading.total}
            aria-label={`${reading.processed} of ${reading.total} channels synced`}
            className="mb-1 h-2 w-full overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${reading.percentage}%` }}
            />
          </div>
          {/* Count label */}
          <p className="text-xs font-medium text-foreground">
            {reading.processed} of {reading.total} channels
          </p>
        </div>
      )}

      {/* Elapsed and ETA */}
      <div className="text-xs text-muted-foreground space-y-1">
        {reading.elapsedLabel && <p>Elapsed: {reading.elapsedLabel}</p>}
        {reading.etaLabel && (
          <p className="font-medium text-foreground">{reading.etaLabel}</p>
        )}
      </div>

      {/* Reassurance message (only while run is live) */}
      {reading.isLive && (
        <p className="text-xs text-muted-foreground">
          Syncing continues even if you leave this page.
        </p>
      )}

      {/* Failing channels (Partial or Interrupted Sync) */}
      {reading.failedChannels.length > 0 && (
        <div className="border-t border-secondary pt-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-destructive mb-1.5">
                {reading.failedChannels.length} channel
                {reading.failedChannels.length === 1 ? '' : 's'} didn't sync
              </p>
              <ul className="text-xs text-destructive space-y-1">
                {reading.failedChannels.map((channel) => (
                  <li key={channel.channelId} className="line-clamp-1">
                    <strong>{channel.channelTitle}</strong>: {channel.error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Retry affordance for Interrupted Sync */}
      {reading.isInterrupted && (
        <div className="border-t border-secondary pt-3 text-xs text-muted-foreground">
          <p>The sync ran out of time. Retry to pick up where it left off.</p>
        </div>
      )}

      {/* Screen reader announcement */}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic>
        {announcement}
      </p>
    </div>
  );
}
