'use client';

import { useCallback, useEffect, useRef } from 'react';
import { shouldPoll } from '../lib/syncProgress';
import type { YouTubeSyncStatus } from '../types';

/**
 * Poll interval for the Sync Run (2 seconds).
 *
 * ADR 0080 decision 1: polling starts on mount as well as on click, so the
 * User can leave and return to a run in flight. This interval is deliberate —
 * not too fast to become chatty on shared hosting, not too slow to lag
 * progress updates.
 */
const POLL_INTERVAL_MS = 2000;

interface UseSyncRunOptions {
  /**
   * Callback when the run transitions to a terminal state.
   * Used to refresh the subscription and carousel lists on completion.
   */
  onRunComplete?: () => void;
  /**
   * The poll function to call for /sync-status.
   * Must be a stable function that calls the real endpoint with real auth.
   * Typically `syncStatus.refresh` from `useYouTubeSyncStatus`.
   */
  poll: () => Promise<YouTubeSyncStatus>;
}

/**
 * Polls /sync-status while a Sync Run is live.
 *
 * The poll loop:
 * - Starts on mount when the mount fetch reports a live run (ADR 0080, decision 1)
 * - Continues every 2 seconds while shouldPoll returns true
 * - Pauses when the tab is hidden, resumes with an immediate poll on visible
 * - Stops when the run becomes terminal
 * - Calls onRunComplete on the terminal transition
 * - Cleans up timers and listeners on unmount
 *
 * The elapsed label advances smoothly because SyncProgressPanel renders
 * describeSyncProgress with the current time; the 2s poll updates the
 * progress counts while the component's own re-renders advance the clock.
 *
 * @param currentStatus the current polled status (from useYouTubeSyncStatus)
 * @param options.onRunComplete callback on terminal transition
 * @param options.poll the function to call to fetch sync status
 */
export function useSyncRun(
  currentStatus: YouTubeSyncStatus | null | undefined,
  options: UseSyncRunOptions,
): void {
  const { onRunComplete, poll } = options;
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLiveRef = useRef(false);
  const hasCompletedRef = useRef(false);

  // Schedule the next poll (recursive via ref to avoid linting issues).
  const scheduleNextPollRef = useRef<((delayMs?: number) => void) | undefined>(
    undefined,
  );

  const scheduleNextPoll = useCallback(
    (delayMs: number = POLL_INTERVAL_MS) => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = setTimeout(async () => {
        try {
          // Await the poll before scheduling the next one — do not queue them up
          await poll();
        } catch {
          // Swallow errors during polling — the component will keep trying.
          // Real API errors are logged server-side; a network hiccup is temporary.
        }
        scheduleNextPollRef.current?.(POLL_INTERVAL_MS);
      }, delayMs);
    },
    [poll],
  );

  // Keep the ref in sync with the callback.
  useEffect(() => {
    scheduleNextPollRef.current = scheduleNextPoll;
  }, [scheduleNextPoll]);

  // Handle visibility changes: pause polling when tab is hidden, resume when visible.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden — stop polling.
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
      } else {
        // Tab is now visible — resume with an immediate poll if still live.
        if (wasLiveRef.current) {
          void poll();
          scheduleNextPoll();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [poll, scheduleNextPoll]);

  // Update polling state based on run status.
  useEffect(() => {
    const nowLive = shouldPoll(currentStatus);
    const wasLive = wasLiveRef.current;

    if (!wasLive && nowLive) {
      // Transition from not-live to live — start polling if visible.
      wasLiveRef.current = true;
      hasCompletedRef.current = false;
      if (!document.hidden) {
        void poll();
        scheduleNextPoll();
      }
    } else if (wasLive && !nowLive) {
      // Transition to terminal — stop polling and call completion callback.
      wasLiveRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onRunComplete?.();
      }
    }
  }, [currentStatus, poll, scheduleNextPoll, onRunComplete]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);
}
