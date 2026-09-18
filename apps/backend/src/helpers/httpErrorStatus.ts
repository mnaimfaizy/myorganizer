type HttpLikeError = Error & {
  status?: unknown;
  statusCode?: unknown;
};

/**
 * Treat an thrown value as an HTTP error only when it carries an integer
 * status in [400, 599]. Anything else is an unhandled 500 in the caller.
 */
export function getHttpErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;

  const maybeErr = err as HttpLikeError;
  const rawStatus = maybeErr.status ?? maybeErr.statusCode;
  if (typeof rawStatus !== 'number') return undefined;
  if (!Number.isInteger(rawStatus)) return undefined;
  if (rawStatus < 400 || rawStatus > 599) return undefined;

  return rawStatus;
}

/**
 * Body message for an HTTP-status error. Prefer a string `message` on the
 * thrown value so helpers like MyError still surface their title when
 * `instanceof Error` is unreliable.
 */
export function getHttpErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const { message } = err as { message: unknown };
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return 'Request failed';
}
