/**
 * Options for startPollLoop.
 *
 * @template T The type of value the poll function returns.
 */
export interface PollLoopOptions<T> {
  /**
   * The poll function to call repeatedly.
   */
  poll: () => Promise<T>;
  /**
   * Interval between polls, in milliseconds.
   */
  intervalMs: number;
  /**
   * Run the first poll now rather than after one interval.
   * Default: false.
   */
  leading?: boolean;
  /**
   * Called after each poll completes (result undefined when the poll rejected);
   * return false to stop looping. Omitted → keep polling until cancelled.
   * After cancel is called, onResult is never called again.
   */
  onResult?: (result: T | undefined) => boolean;
}

/**
 * Starts a poll loop that awaits each poll before scheduling the next.
 *
 * Poll errors are swallowed — the loop continues after any rejection,
 * passing undefined to onResult. After cancel is called, no further polls
 * run and onResult is never called, including for any poll in flight.
 *
 * @template T The type returned by the poll function.
 * @param options Poll loop configuration.
 * @returns A cancel function. Calling it stops the loop and prevents any
 *          further polls or onResult calls.
 */
export function startPollLoop<T>(options: PollLoopOptions<T>): () => void {
  const { poll, intervalMs, leading = false, onResult } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isCancelled = false;

  const tick = async () => {
    if (isCancelled) return;
    let result: T | undefined;
    try {
      result = await poll();
    } catch {
      result = undefined;
    }
    if (isCancelled) return;
    if (onResult && !onResult(result)) return;
    timeoutId = setTimeout(tick, intervalMs);
  };

  if (leading) {
    void tick();
  } else {
    timeoutId = setTimeout(tick, intervalMs);
  }

  return () => {
    isCancelled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}
