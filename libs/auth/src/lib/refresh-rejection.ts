// Pure on purpose: no browser global, no Axios import. Re-exported from the
// Portable Entry Point, so the Mobile App reads the same rule as the web.

/**
 * Client-error statuses that are not a ruling on the Refresh Token: the server
 * gave up waiting for the request (408) or is rate-limiting this client (429).
 * Both pass on their own.
 */
const TRANSIENT_CLIENT_ERROR_STATUSES: readonly number[] = [408, 429];

/**
 * Whether a failed token refresh was a refusal by the server rather than a
 * refresh that could not be completed.
 *
 * A refusal is any 4xx other than 408 and 429 — the one status rule web and
 * mobile share: `/auth/refresh` answers a missing, invalid or retired Refresh
 * Token with 401, an Unverified User with 403 and an unusable body with 422,
 * and an older server answered an expired or undecodable Refresh Token with
 * 404; none of those gets a different answer on a second ask. No response at
 * all, a 5xx, 408 or 429 says nothing about the Session (#1000, #1082).
 *
 * A caller with a 4xx that is not a ruling on the Refresh Token — mobile's
 * Version Floor refusal (426) — must sort it out before asking this.
 *
 * Reads the status structurally instead of through `axios.isAxiosError` so a
 * network failure — an error with no `response` at all — can never be taken
 * for a refusal.
 */
export function isRefreshRejectedByServer(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return false;
  const status = (response as { status?: unknown }).status;
  return (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    !TRANSIENT_CLIENT_ERROR_STATUSES.includes(status)
  );
}
