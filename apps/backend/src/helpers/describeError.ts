/**
 * Message and optional stack for a thrown value.
 *
 * An Error keeps its message and stack. Anything else is JSON when it
 * serializes, and `String(error)` when it does not. A rejected string
 * JSON-encodes with quotes.
 */
export function describeError(error: unknown): {
  message: string;
  stack?: string;
} {
  let message = String(error);
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  try {
    message = JSON.stringify(error) ?? message;
  } catch {
    // Keep the string representation when a third-party error is not serializable.
  }
  return { message };
}

/**
 * Logs one failure as `${context}: ${message}`, and `{ stack }` when the
 * thrown value has one.
 *
 * The stored sync code stays a stable bucket (`syncFailed` / `quotaExceeded`).
 * Call this from the handler that records the bucket and returns. A catch that
 * records state and rethrows leaves the log to that caller, so one failure
 * produces one line.
 */
export function logErrorWithStack(
  log: { error: (message: string, meta?: { stack: string }) => unknown },
  context: string,
  error: unknown,
): void {
  const { message, stack } = describeError(error);
  if (stack === undefined) {
    log.error(`${context}: ${message}`);
    return;
  }
  log.error(`${context}: ${message}`, { stack });
}
