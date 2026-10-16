import * as React from 'react';

import { useRetryOnReconnect } from './use-retry-on-reconnect';

export interface UseRetryableCheckOptions {
  /**
   * While true, a retry is also triggered when the browser comes back online,
   * the window regains focus, or the tab becomes visible again.
   */
  retryOnReconnect: boolean;
}

export interface UseRetryableCheckResult {
  /** Re-runs `check`. Ignored while a check is already in flight. */
  retry: () => void;
  /** True from a `retry()` call until that check settles. */
  retrying: boolean;
}

/**
 * Runs `check` once on mount and again on each `retry()`, then hands the
 * settled result to `onResult`. A check that settles after unmount still clears
 * the in-flight flag but does not call `onResult`.
 *
 * `retry()` is ignored while a check is in flight, including the initial mount
 * check. `retrying` is true only for a retry-initiated check, not the mount
 * check. `check` and `onResult` are read through refs, so callers need not
 * memoize them and the check does not re-run when they change.
 */
export function useRetryableCheck<T>(
  check: () => Promise<T>,
  onResult: (result: T) => void,
  options: UseRetryableCheckOptions,
): UseRetryableCheckResult {
  const [attempt, setAttempt] = React.useState(0);
  const [retrying, setRetrying] = React.useState(false);
  // Starts true: the mount check is in flight from the first render.
  const inFlightRef = React.useRef(true);
  const checkRef = React.useRef(check);
  const onResultRef = React.useRef(onResult);

  // Declared before the check effect so the effect sees the latest callbacks.
  React.useEffect(() => {
    checkRef.current = check;
    onResultRef.current = onResult;
  });

  React.useEffect(() => {
    let cancelled = false;

    async function runCheck() {
      const result = await checkRef.current();
      inFlightRef.current = false;
      setRetrying(false);

      if (cancelled) return;

      onResultRef.current(result);
    }

    void runCheck();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = React.useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRetrying(true);
    setAttempt((count) => count + 1);
  }, []);

  useRetryOnReconnect(options.retryOnReconnect, retry);

  return { retry, retrying };
}
