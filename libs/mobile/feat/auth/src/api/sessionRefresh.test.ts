import type {
  FilteredUserInterface,
  RefreshToken200Response,
} from '@myorganizer/app-api-client';
import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  classifyRefreshFailure,
  createSessionRefresher,
  installRefreshOn401,
  MalformedRefreshResponseError,
  NoRefreshTokenError,
  REFRESH_FAILURE_ENDS_SESSION,
  type RefreshFailureKind,
  type SessionRefresherDeps,
} from './sessionRefresh';
import type { AuthTokens } from './types';

const USER = { id: 'user-1' } as FilteredUserInterface;
const STORED = 'stored-refresh';

/** An Axios error the server answered with `status`. */
function answered(status: number): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data: { message: 'refused' },
  } as AxiosResponse;
  return new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    response,
  );
}

/** An Axios error for a request that got no answer at all. */
function unanswered(code: string, message = 'Network Error'): AxiosError {
  return new AxiosError(message, code, {
    headers: {},
  } as InternalAxiosRequestConfig);
}

function refreshed(token = 'access-2'): RefreshToken200Response {
  return { token, expires_in: 900, user: USER };
}

/**
 * A refresher over an in-memory keychain. `answers` are consumed one per
 * refresh request: a value resolves it, an `Error` rejects it.
 */
function harness(answers: unknown[], stored: string | null = STORED) {
  const keychain = { refreshToken: stored };
  const refreshedWith: AuthTokens[] = [];
  let sessionsEnded = 0;
  const sentBodies: unknown[] = [];

  const deps: SessionRefresherDeps = {
    readRefreshToken: jest.fn(async () => keychain.refreshToken),
    saveRefreshToken: jest.fn(async (token: string) => {
      keychain.refreshToken = token;
    }),
    clearRefreshToken: jest.fn(async () => {
      keychain.refreshToken = null;
    }),
    requestRefresh: jest.fn(async (body) => {
      sentBodies.push(body);
      const answer = answers.shift();
      if (answer instanceof Error) throw answer;
      return answer as RefreshToken200Response;
    }),
    onRefreshed: (tokens) => {
      refreshedWith.push(tokens);
    },
    onSessionEnded: () => {
      sessionsEnded += 1;
    },
  };

  return {
    deps,
    keychain,
    refreshedWith,
    sentBodies,
    sessionsEnded: () => sessionsEnded,
    refresh: createSessionRefresher(deps),
  };
}

describe('classifyRefreshFailure', () => {
  it.each([400, 401, 403, 404, 410, 422])(
    'reads a %i answer as the server rejecting the Refresh Token',
    (status) => {
      expect(classifyRefreshFailure(answered(status))).toBe('rejected');
    },
  );

  it.each([408, 429, 500, 502, 503, 504])(
    'reads a %i answer as a server failure, not a rejection',
    (status) => {
      expect(classifyRefreshFailure(answered(status))).toBe('server_failed');
    },
  );

  it.each([
    ['offline', AxiosError.ERR_NETWORK],
    ['a timeout', AxiosError.ECONNABORTED],
    ['a transitional timeout', AxiosError.ETIMEDOUT],
    ['a DNS failure', 'ENOTFOUND'],
    ['a connection reset', 'ECONNRESET'],
  ])('reads %s as no response', (_name, code) => {
    expect(classifyRefreshFailure(unanswered(code))).toBe('no_response');
  });

  it('reads a bare ERR_NETWORK code as no response without the Axios flag', () => {
    expect(classifyRefreshFailure({ code: 'ERR_NETWORK' })).toBe('no_response');
  });

  it('names the two failures this module throws itself', () => {
    expect(classifyRefreshFailure(new NoRefreshTokenError())).toBe(
      'no_refresh_token',
    );
    expect(classifyRefreshFailure(new MalformedRefreshResponseError())).toBe(
      'malformed_response',
    );
  });

  it('does not read a status out of an error message', () => {
    expect(
      classifyRefreshFailure(new Error('Request failed with status code 401')),
    ).toBe('unexpected');
    expect(
      classifyRefreshFailure(
        unanswered(AxiosError.ERR_NETWORK, '401 Unauthorized'),
      ),
    ).toBe('no_response');
  });

  it.each([undefined, null, 'boom', 42])(
    'reads a thrown %p as unexpected',
    (thrown) => {
      expect(classifyRefreshFailure(thrown)).toBe('unexpected');
    },
  );
});

describe('REFRESH_FAILURE_ENDS_SESSION', () => {
  it('ends the Session only when the server refused or nothing is stored', () => {
    const ending = (
      Object.keys(REFRESH_FAILURE_ENDS_SESSION) as RefreshFailureKind[]
    ).filter((kind) => REFRESH_FAILURE_ENDS_SESSION[kind]);

    expect(ending.sort()).toEqual(['no_refresh_token', 'rejected']);
  });
});

describe('createSessionRefresher', () => {
  it('presents the stored Refresh Token and reports the new Access Token', async () => {
    const h = harness([refreshed('access-2')]);

    const outcome = await h.refresh();

    expect(h.sentBodies).toEqual([{ refresh_token: STORED }]);
    expect(outcome).toEqual({
      kind: 'refreshed',
      tokens: { accessToken: 'access-2', refreshToken: STORED, expiresIn: 900 },
      user: USER,
    });
    expect(h.refreshedWith).toEqual([
      { accessToken: 'access-2', refreshToken: STORED, expiresIn: 900 },
    ]);
    expect(h.keychain.refreshToken).toBe(STORED);
    expect(h.deps.saveRefreshToken).not.toHaveBeenCalled();
    expect(h.sessionsEnded()).toBe(0);
  });

  it('stores a Refresh Token the server rotated', async () => {
    const h = harness([{ ...refreshed(), refresh_token: 'rotated-refresh' }]);

    const outcome = await h.refresh();

    expect(h.keychain.refreshToken).toBe('rotated-refresh');
    expect(outcome).toMatchObject({
      kind: 'refreshed',
      tokens: { refreshToken: 'rotated-refresh' },
    });
  });

  // The regression for #1000: none of these is the server saying the Session
  // is over, so none of them may cost the User their Refresh Token.
  describe.each<[string, RefreshFailureKind, unknown]>([
    [
      'the device is offline',
      'no_response',
      unanswered(AxiosError.ERR_NETWORK),
    ],
    [
      'the request times out',
      'no_response',
      unanswered(AxiosError.ECONNABORTED),
    ],
    ['DNS fails', 'no_response', unanswered('ENOTFOUND')],
    ['the connection resets', 'no_response', unanswered('ECONNRESET')],
    ['the server answers 500', 'server_failed', answered(500)],
    ['the server answers 503', 'server_failed', answered(503)],
    ['the server rate-limits', 'server_failed', answered(429)],
    ['the answer carries no Access Token', 'malformed_response', {}],
    ['something unforeseen throws', 'unexpected', new Error('boom')],
  ])('when %s', (_name, failure, answer) => {
    it('keeps the Refresh Token and the Session', async () => {
      const h = harness([answer]);

      const outcome = await h.refresh();

      expect(outcome).toMatchObject({ kind: 'failed', failure });
      expect(h.keychain.refreshToken).toBe(STORED);
      expect(h.deps.clearRefreshToken).not.toHaveBeenCalled();
      expect(h.sessionsEnded()).toBe(0);
      expect(h.refreshedWith).toEqual([]);
    });

    it('recovers on a later refresh without the User signing in again', async () => {
      const h = harness([answer, refreshed('access-3')]);

      await h.refresh();
      const outcome = await h.refresh();

      expect(outcome).toMatchObject({
        kind: 'refreshed',
        tokens: { accessToken: 'access-3', refreshToken: STORED },
      });
      expect(h.sentBodies).toEqual([
        { refresh_token: STORED },
        { refresh_token: STORED },
      ]);
      expect(h.sessionsEnded()).toBe(0);
    });
  });

  it('hands back the error the refresh failed with', async () => {
    const error = unanswered(AxiosError.ERR_NETWORK);
    const h = harness([error]);

    const outcome = await h.refresh();

    expect(outcome).toEqual({ kind: 'failed', failure: 'no_response', error });
  });

  describe.each([401, 403, 404, 422])(
    'when the server rejects the refresh with %i',
    (status) => {
      it('clears the Refresh Token and ends the Session', async () => {
        const h = harness([answered(status)]);

        const outcome = await h.refresh();

        expect(outcome).toMatchObject({ kind: 'failed', failure: 'rejected' });
        expect(h.keychain.refreshToken).toBeNull();
        expect(h.sessionsEnded()).toBe(1);
        expect(h.refreshedWith).toEqual([]);
      });

      it('does not present the rejected Refresh Token again', async () => {
        const h = harness([answered(status), refreshed()]);

        await h.refresh();
        const outcome = await h.refresh();

        expect(outcome).toMatchObject({
          kind: 'failed',
          failure: 'no_refresh_token',
        });
        expect(h.deps.requestRefresh).toHaveBeenCalledTimes(1);
      });
    },
  );

  it('ends the Session even when the keychain refuses the delete', async () => {
    const h = harness([answered(401)]);
    (h.deps.clearRefreshToken as jest.Mock).mockRejectedValueOnce(
      new Error('keychain'),
    );

    const outcome = await h.refresh();

    expect(outcome).toMatchObject({ kind: 'failed', failure: 'rejected' });
    expect(h.sessionsEnded()).toBe(1);
  });

  it('ends the Session without asking the server when nothing is stored', async () => {
    const h = harness([refreshed()], null);

    const outcome = await h.refresh();

    expect(outcome).toMatchObject({
      kind: 'failed',
      failure: 'no_refresh_token',
    });
    expect(h.deps.requestRefresh).not.toHaveBeenCalled();
    expect(h.sessionsEnded()).toBe(1);
  });

  it('keeps the Session when the keychain cannot be read', async () => {
    const h = harness([refreshed()]);
    (h.deps.readRefreshToken as jest.Mock).mockRejectedValueOnce(
      new Error('keychain locked'),
    );

    const outcome = await h.refresh();

    expect(outcome).toMatchObject({ kind: 'failed', failure: 'unexpected' });
    expect(h.keychain.refreshToken).toBe(STORED);
    expect(h.sessionsEnded()).toBe(0);
  });

  it('shares one attempt between concurrent callers', async () => {
    const h = harness([refreshed('access-2'), refreshed('access-3')]);

    const [first, second] = await Promise.all([h.refresh(), h.refresh()]);

    expect(h.deps.requestRefresh).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(h.refreshedWith).toHaveLength(1);

    await h.refresh();
    expect(h.deps.requestRefresh).toHaveBeenCalledTimes(2);
  });
});

describe('installRefreshOn401', () => {
  /**
   * A client whose API answers 401 to any request not carrying
   * `Bearer <valid>`, over a refresher fed `refreshAnswers`.
   */
  function client(refreshAnswers: unknown[], valid = 'access-2') {
    const h = harness(refreshAnswers);
    const seen: Array<string | undefined> = [];

    const adapter: AxiosAdapter = async (config) => {
      const authorization = config.headers?.Authorization as string | undefined;
      seen.push(authorization);
      const status = authorization === `Bearer ${valid}` ? 200 : 401;
      const response: AxiosResponse = {
        status,
        statusText: '',
        headers: {},
        config,
        data: { ok: status === 200 },
      };
      if (status === 200) return response;
      throw new AxiosError(
        'Request failed with status code 401',
        AxiosError.ERR_BAD_REQUEST,
        config,
        {},
        response,
      );
    };

    const instance = axios.create({
      adapter,
      headers: { Authorization: 'Bearer access-1' },
    });
    installRefreshOn401(instance, h.refresh);

    return { ...h, instance, seen };
  }

  it('refreshes on a 401 and replays the request with the new Access Token', async () => {
    const c = client([refreshed('access-2')]);

    const response = await c.instance.get('/vault');

    expect(response.data).toEqual({ ok: true });
    expect(c.seen).toEqual(['Bearer access-1', 'Bearer access-2']);
  });

  it('fails the request with a network error, keeps the Session, and recovers on the next request', async () => {
    const offline = unanswered(AxiosError.ERR_NETWORK);
    const c = client([offline, refreshed('access-2')]);

    const failure = await c.instance.get('/vault').catch((e: unknown) => e);

    // The refresh's own error, which the screens read as a network error:
    // an Axios error with no response.
    expect(failure).toBe(offline);
    expect((failure as AxiosError).response).toBeUndefined();
    expect(c.keychain.refreshToken).toBe(STORED);
    expect(c.sessionsEnded()).toBe(0);

    const response = await c.instance.get('/vault');

    expect(response.data).toEqual({ ok: true });
    expect(c.sessionsEnded()).toBe(0);
    expect(c.keychain.refreshToken).toBe(STORED);
  });

  it('keeps the Session when the refresh meets a server failure', async () => {
    const c = client([answered(503)]);

    const failure = await c.instance.get('/vault').catch((e: unknown) => e);

    expect((failure as AxiosError).response?.status).toBe(503);
    expect(c.keychain.refreshToken).toBe(STORED);
    expect(c.sessionsEnded()).toBe(0);
  });

  it('ends the Session when the server rejects the refresh', async () => {
    const rejection = answered(401);
    const c = client([rejection]);

    const failure = await c.instance.get('/vault').catch((e: unknown) => e);

    expect(failure).toBe(rejection);
    expect(c.keychain.refreshToken).toBeNull();
    expect(c.sessionsEnded()).toBe(1);
  });

  it('fails every request waiting on one refresh the same way', async () => {
    const offline = unanswered(AxiosError.ERR_NETWORK);
    const c = client([offline]);

    const failures = await Promise.all([
      c.instance.get('/a').catch((e: unknown) => e),
      c.instance.get('/b').catch((e: unknown) => e),
    ]);

    expect(failures).toEqual([offline, offline]);
    expect(c.deps.requestRefresh).toHaveBeenCalledTimes(1);
    expect(c.sessionsEnded()).toBe(0);
  });

  it('replays a request once only', async () => {
    // The refresh succeeds, but with an Access Token the API still refuses.
    const c = client([refreshed('access-stale')]);

    const failure = await c.instance.get('/vault').catch((e: unknown) => e);

    expect((failure as AxiosError).response?.status).toBe(401);
    expect(c.seen).toEqual(['Bearer access-1', 'Bearer access-stale']);
    expect(c.deps.requestRefresh).toHaveBeenCalledTimes(1);
  });

  it('leaves an error that is not a 401 alone', async () => {
    const h = harness([]);
    const offline = unanswered(AxiosError.ERR_NETWORK);
    const instance = axios.create({
      adapter: async () => {
        throw offline;
      },
    });
    installRefreshOn401(instance, h.refresh);

    await expect(instance.get('/vault')).rejects.toBe(offline);
    expect(h.deps.readRefreshToken).not.toHaveBeenCalled();
  });
});
