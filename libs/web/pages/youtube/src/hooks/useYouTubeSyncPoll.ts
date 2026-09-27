'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { startPollLoop } from '../lib/pollLoop';
import { isRunLive, shouldPoll } from '../lib/syncProgress';
import type { YouTubeSyncStatus } from '../types';

/**
 * Poll interval while a Channel Sync or an Upload Sync is live (2 seconds).
 *
 * ADR 0080 decision 1: polling starts on mount as well as on click, so the
 * User can leave and return to a run in flight. This interval is deliberate —
 * not too fast to become chatty on shared hosting, not too slow to lag
 * progress updates.
 */
const POLL_INTERVAL_MS = 2000;

/**
 * How often the claim-wait loop polls for a live status (1 second).
 * The claim wait is started by runUserSync and ends on whichever comes first:
 * the User's request resolves, a poll sees a live status, or 30 seconds pass.
 */
const CLAIM_POLL_INTERVAL_MS = 1000;

/**
 * Maximum time the claim-wait loop runs before giving up (30 seconds).
 * The claim wait is started by runUserSync and ends on whichever comes first:
 * the User's request resolves, a poll sees a live status, or 30 seconds pass.
 */
const CLAIM_WAIT_MS = 30000;

interface UseYouTubeSyncPollOptions {
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

export interface YouTubeSyncPollControls {
  /**
   * Runs a sync the User started. `trigger` sends the User's own sync request
   * and resolves whether the run did work. The response is the completion
   * signal for that run (issue #753): when it did work, `onRunComplete` fires
   * unless the live → terminal transition already fired it for this run, so a
   * run seen both ways refreshes once. A response to an earlier click is
   * inert. Does not reject; a long run is left to the live-poll and claim-wait
   * paths.
   */
  runUserSync: (trigger: () => Promise<boolean>) => Promise<void>;
  /**
   * True from a User's sync click until the request resolves, a live status
   * is seen, or 30 seconds pass — the page shows it as in-flight.
   */
  waitingForClaim: boolean;
}

/**
 * Polls /sync-status while a Channel Sync or an Upload Sync is live.
 *
 * Two shared polling loops (startPollLoop) drive live-poll and claim-wait:
 * - Both await each poll before scheduling the next; poll errors are swallowed
 * - Both guard against post-cancel work
 *
 * The live-poll loop:
 * - Starts on mount when the mount fetch reports a live run (ADR 0080, decision 1)
 * - Continues every 2 seconds while shouldPoll returns true
 * - Pauses when the tab is hidden, resumes with an immediate poll on visible
 * - Stops when the run becomes terminal
 * - Calls onRunComplete on the terminal transition
 * - Calls onRunComplete when the User's own sync request reports a run that
 *   finished before any poll saw it live (via runUserSync), at most once per run
 * - Cleans up timers and listeners on unmount
 *
 * The claim-wait loop (when runUserSync is called):
 * - Starts when the User clicks a sync button (runUserSync sets waitingForClaim)
 * - Polls every 1 second while waiting for a live status
 * - Stops when a live status is seen or 30 seconds elapse
 * - Does not reject on request error, leaving long runs to the live-poll path
 *
 * The elapsed label advances smoothly because SyncProgressPanel renders
 * describeSyncProgress with the current time; the 2s poll updates the
 * progress counts while the component's own re-renders advance the clock.
 *
 * @param currentStatus the current polled status (from useYouTubeSyncStatus)
 * @param options.onRunComplete callback on terminal transition
 * @param options.poll the function to call to fetch sync status
 * @returns controls for a run the User starts from this page
 */
export function useYouTubeSyncPoll(
  currentStatus: YouTubeSyncStatus | null | undefined,
  options: UseYouTubeSyncPollOptions,
): YouTubeSyncPollControls {
  const { onRunComplete, poll } = options;
  const [waitingForClaim, setWaitingForClaim] = useState(false);
  const cancelLivePollRef = useRef<(() => void) | null>(null);
  const wasLiveRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const userRunIdRef = useRef(0);
  const onRunCompleteRef = useRef(onRunComplete);

  useEffect(() => {
    onRunCompleteRef.current = onRunComplete;
  }, [onRunComplete]);

  // Start the live-poll loop: cancel any existing loop, do immediate poll, start new loop.
  const startLivePoll = useCallback(() => {
    cancelLivePollRef.current?.();
    void poll();
    cancelLivePollRef.current = startPollLoop({
      poll,
      intervalMs: POLL_INTERVAL_MS,
    });
  }, [poll]);

  // Stop the live-poll loop.
  const stopLivePoll = useCallback(() => {
    cancelLivePollRef.current?.();
    cancelLivePollRef.current = null;
  }, []);

  // Handle visibility changes: pause polling when tab is hidden, resume when visible.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden — stop polling.
        stopLivePoll();
      } else {
        // Tab is now visible — resume with an immediate poll if still live.
        if (wasLiveRef.current) {
          startLivePoll();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startLivePoll, stopLivePoll]);

  // Update polling state based on run status.
  useEffect(() => {
    const nowLive = shouldPoll(currentStatus);
    const wasLive = wasLiveRef.current;

    if (!wasLive && nowLive) {
      // Transition from not-live to live — start polling if visible.
      wasLiveRef.current = true;
      hasCompletedRef.current = false;
      if (!document.hidden) {
        startLivePoll();
      }
    } else if (wasLive && !nowLive) {
      // Transition to terminal — stop polling and call completion callback.
      wasLiveRef.current = false;
      stopLivePoll();
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onRunComplete?.();
      }
    }
  }, [currentStatus, startLivePoll, stopLivePoll, onRunComplete]);

  // Claim-wait loop: poll for a live status after the User clicks a sync button.
  useEffect(() => {
    if (!waitingForClaim) return;

    let elapsedMs = 0;
    return startPollLoop({
      poll,
      intervalMs: CLAIM_POLL_INTERVAL_MS,
      leading: true,
      onResult: (status) => {
        if (status && isRunLive(status)) {
          setWaitingForClaim(false);
          return false;
        }
        elapsedMs += CLAIM_POLL_INTERVAL_MS;
        if (elapsedMs <= CLAIM_WAIT_MS) return true;
        setWaitingForClaim(false);
        return false;
      },
    });
  }, [waitingForClaim, poll]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopLivePoll();
    };
  }, [stopLivePoll]);

  const runUserSync = useCallback(async (trigger: () => Promise<boolean>) => {
    setWaitingForClaim(true);
    const runId = ++userRunIdRef.current;
    hasCompletedRef.current = false;
    let ran: boolean;
    try {
      ran = await trigger();
    } catch {
      // A rejected request (e.g. a 504 on a long run) keeps the claim wait
      // going and leaves the run to the live-poll path.
      return;
    }
    setWaitingForClaim(false);
    if (!ran || runId !== userRunIdRef.current || hasCompletedRef.current) {
      return;
    }
    hasCompletedRef.current = true;
    onRunCompleteRef.current?.();
  }, []);

  return { runUserSync, waitingForClaim };
}
