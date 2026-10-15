import type { FilteredUserInterface } from '@myorganiser/app-api-client';
import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { installRefreshOn401, type RefreshOutcome } from './sessionRefresh';
import type { AuthTokens } from './types';
import {
  buildClientHeader,
  CLIENT_HEADER,
  createVersionFloorStore,
  installVersionFloor,
  isVersionFloorRefusal,
  reportRefusedWrite,
} from './versionFloor';

/** The grammar the backend reads `X-Client` against (apps/backend versionFloor). */
const CLIENT_HEADER_GRAMMAR = /^mobile\/(\S+) \((android|ios)\)$/;

/** An Axios error the server answered with `status`. */
function answeredWith(
  status: number,
  config: InternalAxiosRequestConfig,
): AxiosError {
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

/** What the adapter saw of one request, read when it arrived. */
interface Sent {
  authorization: unknown;
  clientHeader: unknown;
}

/**
 * An instance whose adapter records every request and answers each one with
 * `respond`: a status, or `'network'` for a request that got no answer.
 * `headers` are the instance defaults. Each request is recorded as it reaches
 * the adapter, because a retry mutates the config it was built from.
 */
function apiAnswering(
  respond: (config: InternalAxiosRequestConfig) => number | 'network',
  headers: Record<string, string> = {},
) {
  const sent: Sent[] = [];
  const thrown: unknown[] = [];
  const adapter: AxiosAdapter = async (config) => {
    sent.push({
      authorization: config.headers.get('Authorization'),
      clientHeader: config.headers.get(CLIENT_HEADER),
    });
    const answer = respond(config);
    if (answer === 'network') {
      const error = new AxiosError(
        'Network Error',
        AxiosError.ERR_NETWORK,
        config,
      );
      thrown.push(error);
      throw error;
    }
    if (answer >= 400) {
      const error = answeredWith(answer, config);
      thrown.push(error);
      throw error;
    }
    return {
      status: answer,
      statusText: '',
      headers: {},
      config,
      data: { ok: true },
    } as AxiosResponse;
  };
  const client: AxiosInstance = axios.create({ adapter, headers });
  return { client, sent, thrown };
}

describe('buildClientHeader', () => {
  it.each([
    ['1.0.0', 'android', 'mobile/1.0.0 (android)'],
    ['2.3.4', 'ios', 'mobile/2.3.4 (ios)'],
  ])('sends %s on %s as %s', (version, platform, expected) => {
    const header = buildClientHeader(version, platform);

    expect(header).toBe(expected);
    expect(header).toMatch(CLIENT_HEADER_GRAMMAR);
  });

  it.each([null, ''])(
    'sends no header when the build has no version (%p)',
    (version) => {
      expect(buildClientHeader(version, 'android')).toBeNull();
    },
  );

  it.each(['web', 'windows'])(
    'sends no header on %s, which is not a Mobile Release',
    (platform) => {
      expect(buildClientHeader('1.0.0', platform)).toBeNull();
    },
  );
});

describe('isVersionFloorRefusal', () => {
  it('reads a 426 answer as a refusal below the floor', () => {
    expect(isVersionFloorRefusal({ response: { status: 426 } })).toBe(true);
  });

  it.each([400, 401, 500])(
    'does not read a %i answer as a refusal',
    (status) => {
      expect(isVersionFloorRefusal({ response: { status } })).toBe(false);
    },
  );

  it('does not read a request that got no answer as a refusal', () => {
    expect(
      isVersionFloorRefusal(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK),
      ),
    ).toBe(false);
  });

  it.each([null, undefined, 'boom', 42])(
    'does not read a thrown %p as a refusal',
    (thrown) => {
      expect(isVersionFloorRefusal(thrown)).toBe(false);
    },
  );
});

describe('createVersionFloorStore', () => {
  it('holds no refusal until one is reported', () => {
    const store = createVersionFloorStore();

    expect(store.get()).toBeNull();
  });

  it('records a refusal and notifies subscribers once', () => {
    const store = createVersionFloorStore();
    const listener = jest.fn();
    store.subscribe(listener);

    store.report();

    expect(store.get()).toEqual({ unsavedChange: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('records an unsaved change reported after the refusal and notifies again', () => {
    const store = createVersionFloorStore();
    const listener = jest.fn();
    store.subscribe(listener);
    store.report();

    store.report({ unsavedChange: true });

    expect(store.get()).toEqual({ unsavedChange: true });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('never clears an unsaved change, and does not notify for a report that changes nothing', () => {
    const store = createVersionFloorStore();
    const listener = jest.fn();
    store.subscribe(listener);
    store.report({ unsavedChange: true });

    store.report();
    store.report();

    expect(store.get()).toEqual({ unsavedChange: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a subscriber once it unsubscribes', () => {
    const store = createVersionFloorStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.report({ unsavedChange: true });

    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toEqual({ unsavedChange: true });
  });

  it('returns the same object while nothing changes', () => {
    const store = createVersionFloorStore();
    store.report();

    expect(store.get()).toBe(store.get());
  });
});

describe('installVersionFloor', () => {
  it('sends the X-Client header on every request', async () => {
    const { client, sent } = apiAnswering(() => 200);
    installVersionFloor(client, {
      clientHeader: 'mobile/1.0.0 (android)',
      onRefused: jest.fn(),
    });

    await client.get('/vault');
    await client.get('/vault/blob');

    expect(sent.map((request) => request.clientHeader)).toEqual([
      'mobile/1.0.0 (android)',
      'mobile/1.0.0 (android)',
    ]);
  });

  it('sends no X-Client header when there is no client header to send', async () => {
    const { client, sent } = apiAnswering(() => 200);
    installVersionFloor(client, { clientHeader: null, onRefused: jest.fn() });

    await client.get('/vault');

    expect(sent[0].clientHeader).toBeUndefined();
  });

  it('reports a 426 once and fails the request with that same error', async () => {
    const { client, thrown } = apiAnswering(() => 426);
    const onRefused = jest.fn();
    installVersionFloor(client, {
      clientHeader: 'mobile/1.0.0 (ios)',
      onRefused,
    });

    const failure = await client.get('/vault').catch((e: unknown) => e);

    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(failure).toBe(thrown[0]);
    expect((failure as AxiosError).response?.status).toBe(426);
  });

  it.each([401, 500])(
    'lets a %i pass through without reporting a refusal',
    async (status) => {
      const { client } = apiAnswering(() => status);
      const onRefused = jest.fn();
      installVersionFloor(client, {
        clientHeader: 'mobile/1.0.0 (ios)',
        onRefused,
      });

      const failure = await client.get('/vault').catch((e: unknown) => e);

      expect(onRefused).not.toHaveBeenCalled();
      expect((failure as AxiosError).response?.status).toBe(status);
    },
  );

  it('lets a network failure pass through without reporting a refusal', async () => {
    const { client } = apiAnswering(() => 'network');
    const onRefused = jest.fn();
    installVersionFloor(client, {
      clientHeader: 'mobile/1.0.0 (ios)',
      onRefused,
    });

    const failure = await client.get('/vault').catch((e: unknown) => e);

    expect(onRefused).not.toHaveBeenCalled();
    expect((failure as AxiosError).response).toBeUndefined();
    expect((failure as AxiosError).code).toBe(AxiosError.ERR_NETWORK);
  });
});

describe('installVersionFloor with installRefreshOn401 on the same client', () => {
  /** A refresh that always produces a new Access Token. */
  function refreshing() {
    const user = { id: 'user-1' } as FilteredUserInterface;
    const tokens: AuthTokens = {
      accessToken: 'access-2',
      refreshToken: 'stored-refresh',
      expiresIn: 900,
    };
    const outcome: RefreshOutcome = { kind: 'refreshed', tokens, user };
    return jest.fn(async (): Promise<RefreshOutcome> => outcome);
  }

  /** Answers 401 to `access-1` and 200 to `access-2`, unless `answerAfterRefresh` says otherwise. */
  function refreshedApi(answerAfterRefresh: 200 | 426 = 200) {
    return apiAnswering(
      (config) =>
        config.headers.get('Authorization') === 'Bearer access-2'
          ? answerAfterRefresh
          : 401,
      { Authorization: 'Bearer access-1' },
    );
  }

  it('reports a 426 without starting a refresh, and fails the request', async () => {
    const { client, thrown } = apiAnswering(() => 426);
    const refresh = refreshing();
    const onRefused = jest.fn();
    installVersionFloor(client, {
      clientHeader: 'mobile/1.0.0 (android)',
      onRefused,
    });
    installRefreshOn401(client, refresh);

    const failure = await client.get('/vault').catch((e: unknown) => e);

    expect(refresh).not.toHaveBeenCalled();
    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(failure).toBe(thrown[0]);
  });

  it('still refreshes and replays a 401 without reporting a refusal', async () => {
    const { client, sent } = refreshedApi(200);
    const refresh = refreshing();
    const onRefused = jest.fn();
    installVersionFloor(client, {
      clientHeader: 'mobile/1.0.0 (android)',
      onRefused,
    });
    installRefreshOn401(client, refresh);

    const response = await client.get('/vault');

    expect(response.data).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sent.map((request) => request.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('reports a 426 on the replay after a refresh and fails the request', async () => {
    const { client, thrown } = refreshedApi(426);
    const refresh = refreshing();
    const onRefused = jest.fn();
    installVersionFloor(client, {
      clientHeader: 'mobile/1.0.0 (android)',
      onRefused,
    });
    installRefreshOn401(client, refresh);

    const failure = await client.get('/vault').catch((e: unknown) => e);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(failure).toBe(thrown[1]);
  });
});

describe('reportRefusedWrite', () => {
  const config = { headers: {} } as InternalAxiosRequestConfig;

  it('records an unsaved change when the write was refused with a 426', () => {
    const store = createVersionFloorStore();
    const listener = jest.fn();
    store.subscribe(listener);

    reportRefusedWrite(store, answeredWith(426, config));

    expect(store.get()).toEqual({ unsavedChange: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('upgrades a plain refusal already on record to an unsaved change', () => {
    const store = createVersionFloorStore();
    store.report();
    const listener = jest.fn();
    store.subscribe(listener);

    reportRefusedWrite(store, answeredWith(426, config));

    expect(store.get()).toEqual({ unsavedChange: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a 500', () => answeredWith(500, config)],
    ['a 401', () => answeredWith(401, config)],
    [
      'a network failure',
      () => new AxiosError('Network Error', AxiosError.ERR_NETWORK, config),
    ],
  ])('leaves the store alone for %s', (_name, failure) => {
    const store = createVersionFloorStore();
    const listener = jest.fn();
    store.subscribe(listener);

    reportRefusedWrite(store, failure());

    expect(store.get()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });
});
