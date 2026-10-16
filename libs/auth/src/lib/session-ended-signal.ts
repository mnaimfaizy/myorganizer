/**
 * Why a signed-in Session ended without this window asking for it.
 *
 * - `refresh_rejected`: the server refused a token refresh (see
 *   {@link isRefreshRejectedByServer}), so the Session cannot be continued.
 * - `signed_out_elsewhere`: another window of this browser signed out and
 *   removed the user the windows share.
 *
 * Neither covers a refresh that failed for a network reason, and neither
 * covers this window's own `signOut()` — the caller of that already knows.
 */
export type SessionEndedReason = 'refresh_rejected' | 'signed_out_elsewhere';

export interface SessionEndedEvent {
  reason: SessionEndedReason;
}

export type SessionEndedListener = (event: SessionEndedEvent) => void;

export interface SessionEndedSignal {
  /** Subscribe; the returned function unsubscribes and is safe to call twice. */
  subscribe(listener: SessionEndedListener): () => void;
  emit(event: SessionEndedEvent): void;
}

export function createSessionEndedSignal(): SessionEndedSignal {
  const listeners = new Set<SessionEndedListener>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    emit(event) {
      for (const listener of Array.from(listeners)) {
        try {
          listener(event);
        } catch {
          // A listener is a redirect, not part of the request that ended the
          // Session: one that throws must not replace the refresh error the
          // caller is about to receive, nor starve the listeners after it.
        }
      }
    },
  };
}

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
 * A refusal is any 4xx other than 408 and 429, mirroring mobile's status rule
 * (`classifyRefreshFailure`): `/auth/refresh` answers a missing, invalid or
 * retired Refresh Token with 401, an Unverified User with 403 and an unusable
 * body with 422, and none of those gets a different answer on a second ask.
 * No response at all, a 5xx, 408 or 429 says nothing about the Session (#1082).
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
