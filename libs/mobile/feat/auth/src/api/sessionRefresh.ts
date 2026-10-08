// Refreshing the Session, and what a failed refresh means for it.
//
// Pure on purpose: no `react-native`, no keychain, no module state. The
// keychain, the HTTP call and the in-memory Access Token are handed in, so
// this project's Node-environment Jest suite can drive every failure kind
// without a device. `client.ts` is the wiring.
import type {
  RefreshToken200Response,
  RefreshTokenBody,
} from '@myorganizer/app-api-client';
import {
  buildRefreshTokenRequest,
  resolveRefreshTokenAfterRefresh,
} from '@myorganizer/auth/portable';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { AuthTokens, FilteredUserInterface } from './types';

/**
 * Why a refresh did not produce an Access Token.
 *
 * - `rejected` — the server answered, and the answer was no: this Refresh
 *   Token does not obtain an Access Token (invalid, expired, retired by
 *   Logout or Force Logout, a Disabled User, an Unverified User).
 * - `no_refresh_token` — the keychain holds nothing to present. There is no
 *   Restorable Session; the User is a Guest.
 * - `no_response` — the request got no answer: offline, DNS, timeout, a
 *   connection reset. Says nothing about the Session.
 * - `server_failed` — the server answered without ruling on the Refresh
 *   Token: a 5xx, a rate limit, a request timeout.
 * - `malformed_response` — a success answer that carried no Access Token.
 * - `unexpected` — anything else, the keychain refusing a read among them.
 */
export type RefreshFailureKind =
  | 'rejected'
  | 'no_refresh_token'
  | 'no_response'
  | 'server_failed'
  | 'malformed_response'
  | 'unexpected';

/**
 * Whether each failure ends the Session — clears the stored Refresh Token and
 * takes the User to sign-in.
 *
 * Only the server refusing the Refresh Token does, plus having none to
 * present. Every other kind is a refresh that could not be completed, which
 * is not evidence about the Session: the Refresh Token is kept and the
 * refresh is asked again later (#1000). The reverse mistake is not available
 * either — a `rejected` refresh is never retried as if it were transient.
 *
 * Pinned with `satisfies` so a new kind cannot compile without a ruling here.
 */
export const REFRESH_FAILURE_ENDS_SESSION = {
  rejected: true,
  no_refresh_token: true,
  no_response: false,
  server_failed: false,
  malformed_response: false,
  unexpected: false,
} as const satisfies Record<RefreshFailureKind, boolean>;

/**
 * Client-error statuses that are not a ruling on the Refresh Token: the
 * server gave up waiting for the request (408) or is rate-limiting this
 * client (429). Both pass on their own.
 */
const TRANSIENT_CLIENT_ERROR_STATUSES: readonly number[] = [408, 429];

/** Thrown when the keychain holds no Refresh Token to present. */
export class NoRefreshTokenError extends Error {
  constructor() {
    super('No refresh token available');
    this.name = 'NoRefreshTokenError';
  }
}

/** Thrown when a refresh succeeded on the wire but carried no Access Token. */
export class MalformedRefreshResponseError extends Error {
  constructor() {
    super('No access token in refresh response');
    this.name = 'MalformedRefreshResponseError';
  }
}

/**
 * Sorts whatever a refresh attempt threw into a {@link RefreshFailureKind}.
 *
 * Reads the error's shape — an HTTP status, or the absence of a response on
 * an Axios error — and never its message.
 *
 * Every 4xx other than 408 and 429 is `rejected`, not only 401 and 403:
 * `/auth/refresh` answers an expired or undecodable Refresh Token with 404
 * and an unusable body with 422, and none of those gets a different answer on
 * a second ask.
 */
export function classifyRefreshFailure(error: unknown): RefreshFailureKind {
  if (error instanceof NoRefreshTokenError) {
    return 'no_refresh_token';
  }
  if (error instanceof MalformedRefreshResponseError) {
    return 'malformed_response';
  }

  const shape = error as {
    response?: { status?: unknown };
    isAxiosError?: unknown;
    code?: unknown;
  } | null;

  if (shape?.response) {
    const status = shape.response.status;
    if (
      typeof status === 'number' &&
      status >= 400 &&
      status < 500 &&
      !TRANSIENT_CLIENT_ERROR_STATUSES.includes(status)
    ) {
      return 'rejected';
    }
    return 'server_failed';
  }

  if (shape?.isAxiosError === true || shape?.code === 'ERR_NETWORK') {
    return 'no_response';
  }

  return 'unexpected';
}

export type RefreshOutcome =
  | { kind: 'refreshed'; tokens: AuthTokens; user: FilteredUserInterface }
  | { kind: 'failed'; failure: RefreshFailureKind; error: unknown };

export interface SessionRefresherDeps {
  readRefreshToken: () => Promise<string | null>;
  saveRefreshToken: (refreshToken: string) => Promise<void>;
  clearRefreshToken: () => Promise<void>;
  /** `POST /auth/refresh`. Rejects the way Axios does. */
  requestRefresh: (
    body: RefreshTokenBody | undefined,
  ) => Promise<RefreshToken200Response>;
  /** A refresh produced a new Access Token. */
  onRefreshed: (tokens: AuthTokens) => void;
  /**
   * A refresh failed in a way that ends the Session. Called after the stored
   * Refresh Token is cleared, and for no other failure.
   */
  onSessionEnded: () => void;
}

async function attemptRefresh(
  deps: SessionRefresherDeps,
): Promise<RefreshOutcome> {
  try {
    const storedRefreshToken = await deps.readRefreshToken();
    if (!storedRefreshToken) {
      throw new NoRefreshTokenError();
    }

    const data = await deps.requestRefresh(
      buildRefreshTokenRequest('mobile', storedRefreshToken),
    );

    const accessToken = data?.token;
    if (!accessToken) {
      throw new MalformedRefreshResponseError();
    }

    const refreshToken =
      resolveRefreshTokenAfterRefresh('mobile', data, storedRefreshToken) ??
      storedRefreshToken;
    if (refreshToken !== storedRefreshToken) {
      await deps.saveRefreshToken(refreshToken);
    }

    return {
      kind: 'refreshed',
      tokens: { accessToken, refreshToken, expiresIn: data.expires_in },
      user: data.user,
    };
  } catch (error) {
    return { kind: 'failed', failure: classifyRefreshFailure(error), error };
  }
}

/**
 * Builds the one function that refreshes the Session.
 *
 * Concurrent callers share a single attempt, so a burst of 401s presents the
 * Refresh Token once. Nothing is remembered between attempts: after a failure
 * that keeps the Session, the next call simply asks the server again, which
 * is the whole retry mechanism.
 */
export function createSessionRefresher(
  deps: SessionRefresherDeps,
): () => Promise<RefreshOutcome> {
  let inFlight: Promise<RefreshOutcome> | null = null;

  async function run(): Promise<RefreshOutcome> {
    const outcome = await attemptRefresh(deps);

    if (outcome.kind === 'refreshed') {
      deps.onRefreshed(outcome.tokens);
      return outcome;
    }

    if (REFRESH_FAILURE_ENDS_SESSION[outcome.failure]) {
      try {
        await deps.clearRefreshToken();
      } catch {
        // A keychain that refused the delete must not leave the User in a
        // Session the server has ended.
      }
      deps.onSessionEnded();
    }

    return outcome;
  }

  return () => {
    if (!inFlight) {
      inFlight = run().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}

/**
 * Makes `client` answer a 401 by refreshing the Session and replaying the
 * request once.
 *
 * When the refresh fails the request rejects with the refresh's own error
 * rather than with the 401 that prompted it. For a refresh that got no answer
 * that is an Axios error with no `response` — exactly what the screens' load
 * and save notices already read as a network error and offer to retry.
 */
export function installRefreshOn401(
  client: AxiosInstance,
  refresh: () => Promise<RefreshOutcome>,
): void {
  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const failed = error as {
        config?: InternalAxiosRequestConfig & { _retry?: boolean };
        response?: { status?: number };
      } | null;
      const originalRequest = failed?.config;

      if (
        !originalRequest ||
        failed?.response?.status !== 401 ||
        originalRequest._retry
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const outcome = await refresh();
      if (outcome.kind === 'failed') {
        return Promise.reject(outcome.error);
      }

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${outcome.tokens.accessToken}`;
      }
      return client(originalRequest);
    },
  );
}
