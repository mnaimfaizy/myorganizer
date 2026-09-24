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
