import { beforeEach, describe, expect, test } from '@jest/globals';

import { GoogleDriveCloudBackupProvider } from './googleDriveProvider';
import {
  GisErrorResponse,
  GisTokenClient,
  GisTokenResponse,
  GoogleAccountsOauth2,
  GoogleNamespace,
} from './googleIdentity.types';
import { isCloudBackupPromptError } from './promptError';

interface FakeFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  appProperties?: Record<string, string>;
  body?: string;
}

interface FakeGoogleHandle {
  google: GoogleNamespace;
  invokeErrorCallback: (err: GisErrorResponse) => void;
}

function makeFakeGoogle(opts: {
  tokenResponse: GisTokenResponse;
  onRevoke?: (token: string) => void;
}): FakeGoogleHandle {
  let activeCallback: ((r: GisTokenResponse) => void) | null = null;
  let activeErrorCallback: ((err: GisErrorResponse) => void) | null = null;
  let pendingRequest = false;

  const tokenClient: GisTokenClient = {
    callback: () => undefined,
    requestAccessToken: () => {
      pendingRequest = true;
      // Defer callback invocation to allow test to invoke error_callback first
      Promise.resolve().then(() => {
        if (pendingRequest) {
          activeCallback?.(opts.tokenResponse);
        }
      });
    },
  };

  const google: GoogleNamespace = {
    accounts: {
      oauth2: {
        initTokenClient: ({ callback, error_callback }) => {
          activeCallback = callback;
          activeErrorCallback = error_callback ?? null;
          tokenClient.callback = callback;
          return tokenClient;
        },
        revoke: (token, done) => {
          opts.onRevoke?.(token);
          done?.();
        },
      },
    },
  };

  return {
    google,
    invokeErrorCallback: (err: GisErrorResponse) => {
      pendingRequest = false;
      activeErrorCallback?.(err);
    },
  };
}

interface MockFetchOptions {
  files: FakeFile[];
}

function makeResponse(
  body: string,
  status: number,
  contentType?: string,
): Response {
  const headerEntries: [string, string][] = [];
  if (contentType) headerEntries.push(['content-type', contentType]);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: {
      get: (name: string) => {
        const lower = name.toLowerCase();
        const found = headerEntries.find(([k]) => k.toLowerCase() === lower);
        return found ? found[1] : null;
      },
    },
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

function makeFetchMock(state: MockFetchOptions): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();

    // Create empty file with metadata.
    if (
      method === 'POST' &&
      url.startsWith('https://www.googleapis.com/drive/v3/files') &&
      !url.includes('/files/')
    ) {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        name?: string;
        appProperties?: Record<string, string>;
      };
      const file: FakeFile = {
        id: `file-${state.files.length + 1}`,
        name: body.name ?? 'unnamed',
        createdTime: new Date(2026, 0, state.files.length + 1).toISOString(),
        appProperties: body.appProperties,
      };
      state.files.push(file);
      return makeResponse(
        JSON.stringify({ id: file.id, name: file.name }),
        200,
        'application/json',
      );
    }

    // Upload media.
    if (
      method === 'PATCH' &&
      url.startsWith('https://www.googleapis.com/upload/drive/v3/files/')
    ) {
      const id = decodeURIComponent(url.split('/files/')[1].split('?')[0]);
      const file = state.files.find((f) => f.id === id);
      if (!file) return makeResponse('', 404);
      file.body = String(init?.body ?? '');
      file.size = String(file.body.length);
      return makeResponse('', 200);
    }

    // Patch metadata (finalize).
    if (
      method === 'PATCH' &&
      url.startsWith('https://www.googleapis.com/drive/v3/files/')
    ) {
      const id = decodeURIComponent(url.split('/files/')[1].split('?')[0]);
      const file = state.files.find((f) => f.id === id);
      if (!file) return makeResponse('', 404);
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        appProperties?: Record<string, string>;
      };
      file.appProperties = {
        ...(file.appProperties ?? {}),
        ...(body.appProperties ?? {}),
      };
      return makeResponse(
        JSON.stringify({
          id: file.id,
          name: file.name,
          createdTime: file.createdTime,
          size: file.size,
          appProperties: file.appProperties,
        }),
        200,
        'application/json',
      );
    }

    // Download media.
    if (
      method === 'GET' &&
      url.startsWith('https://www.googleapis.com/drive/v3/files/') &&
      url.includes('alt=media')
    ) {
      const id = decodeURIComponent(url.split('/files/')[1].split('?')[0]);
      const file = state.files.find((f) => f.id === id);
      if (!file) return makeResponse('', 404);
      return makeResponse(file.body ?? '', 200);
    }

    // List files.
    if (
      method === 'GET' &&
      url.startsWith('https://www.googleapis.com/drive/v3/files') &&
      url.includes('spaces=appDataFolder')
    ) {
      return makeResponse(
        JSON.stringify({
          files: state.files.map((f) => ({
            id: f.id,
            name: f.name,
            createdTime: f.createdTime,
            size: f.size,
            appProperties: f.appProperties,
          })),
        }),
        200,
        'application/json',
      );
    }

    // Delete.
    if (
      method === 'DELETE' &&
      url.startsWith('https://www.googleapis.com/drive/v3/files/')
    ) {
      const id = decodeURIComponent(url.split('/files/')[1]);
      state.files = state.files.filter((f) => f.id !== id);
      return makeResponse('', 204);
    }

    return makeResponse('', 404);
  }) as unknown as typeof fetch;
}

describe('GoogleDriveCloudBackupProvider', () => {
  let state: MockFetchOptions;

  beforeEach(() => {
    state = { files: [] };
    // Clear localStorage for each test to ensure clean state
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  // =========================================================================
  // Connection State Tests
  // =========================================================================

  test('getConnectionState returns not-linked when storage is empty', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });

    const state_ = await provider.getConnectionState();
    expect(state_.status).toBe('not-linked');
  });

  test('getConnectionState returns linked when linked flag is set', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    await provider.connect();

    const state_ = await provider.getConnectionState();
    expect(state_.status).toBe('linked');
  });

  test('getConnectionState returns reconnect-needed when both flags are set', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    // Connect to set linked flag
    await provider.connect();
    // Manually set reconnect flag to simulate a failed token acquisition
    window.localStorage.setItem(
      'myorganizer.cloudBackup.googleDrive.reconnectNeeded',
      '1',
    );

    const state_ = await provider.getConnectionState();
    expect(state_.status).toBe('reconnect-needed');
  });

  test('reconnect-needed flag persists across provider instances', async () => {
    const { google: google1 } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider1 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: google1,
      fetchImpl: makeFetchMock(state),
    });
    await provider1.connect();
    window.localStorage.setItem(
      'myorganizer.cloudBackup.googleDrive.reconnectNeeded',
      '1',
    );

    // Create a new provider instance
    const { google: google2 } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-2', expires_in: 3600 },
    });
    const provider2 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: google2,
      fetchImpl: makeFetchMock(state),
    });

    const state_ = await provider2.getConnectionState();
    expect(state_.status).toBe('reconnect-needed');
  });

  // =========================================================================
  // Connect Tests
  // =========================================================================

  test('connect acquires token and sets linked flag', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: {
        access_token: 'tok-1',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });

    const result = await provider.connect();
    expect(result.status).toBe('linked');
    expect((await provider.getConnectionState()).status).toBe('linked');
  });

  test('failed first connect does NOT write reconnect-needed flag', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { error: 'access_denied' },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });

    await expect(provider.connect()).rejects.toThrow(/access_denied/);
    const state_ = await provider.getConnectionState();
    expect(state_.status).toBe('not-linked');
  });

  test('failed token acquisition on linked provider writes reconnect-needed flag', async () => {
    const { google: google1 } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider1 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: google1,
      fetchImpl: makeFetchMock(state),
    });
    // First connect succeeds
    await provider1.connect();
    expect((await provider1.getConnectionState()).status).toBe('linked');

    // Now create a provider with a failing token response
    const { google: google2 } = makeFakeGoogle({
      tokenResponse: {
        error: 'consent_required',
        error_description: 'User consent required',
      },
    });
    const provider2 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: google2,
      fetchImpl: makeFetchMock(state),
    });

    // Try to upload (which calls acquireToken non-interactively)
    await expect(
      provider2.uploadBackup({
        text: 'test',
        exportId: 'e1',
        schemaVersion: 1,
      }),
    ).rejects.toThrow(/User consent required/);

    // Should now be in reconnect-needed state
    const state_ = await provider2.getConnectionState();
    expect(state_.status).toBe('reconnect-needed');
  });

  test('connect while reconnect-needed clears the flag', async () => {
    const { google: google1 } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider1 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: google1,
      fetchImpl: makeFetchMock(state),
    });
    await provider1.connect();
    window.localStorage.setItem(
      'myorganizer.cloudBackup.googleDrive.reconnectNeeded',
      '1',
    );
    expect((await provider1.getConnectionState()).status).toBe(
      'reconnect-needed',
    );

    // Create new provider and try connecting again
    const { google: google2 } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-2', expires_in: 3600 },
    });
    const provider2 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: google2,
      fetchImpl: makeFetchMock(state),
    });
    await provider2.connect();

    const state_ = await provider2.getConnectionState();
    expect(state_.status).toBe('linked');
  });

  // =========================================================================
  // Disconnect Tests
  // =========================================================================

  test('disconnect clears linked and reconnect-needed flags', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    await provider.connect();
    window.localStorage.setItem(
      'myorganizer.cloudBackup.googleDrive.reconnectNeeded',
      '1',
    );

    await provider.disconnect();

    const state_ = await provider.getConnectionState();
    expect(state_.status).toBe('not-linked');
  });

  test('disconnect revokes the held token', async () => {
    let revokedToken: string | null = null;
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
      onRevoke: (token) => {
        revokedToken = token;
      },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    await provider.connect();

    await provider.disconnect();

    expect(revokedToken).toBe('tok-1');
  });

  // =========================================================================
  // canRunWithoutPrompt Tests
  // =========================================================================

  test('canRunWithoutPrompt returns false when no token is held', () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });

    expect(provider.canRunWithoutPrompt()).toBe(false);
  });

  test('canRunWithoutPrompt returns true when usable token is held', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    await provider.connect();

    expect(provider.canRunWithoutPrompt()).toBe(true);
  });

  test('canRunWithoutPrompt returns false when token is expired', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 1 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
      tokenSkewMs: 1000,
    });
    await provider.connect();

    // Wait for token to be considered expired (1s + 1000ms skew)
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(provider.canRunWithoutPrompt()).toBe(false);
  });

  test('canRunWithoutPrompt never calls requestAccessToken', async () => {
    let requestAccessTokenCalled = false;
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const origInitTokenClient = google.accounts.oauth2.initTokenClient;
    google.accounts.oauth2.initTokenClient = (
      config: Parameters<GoogleAccountsOauth2['initTokenClient']>[0],
    ) => {
      const client = origInitTokenClient(config);
      const origRequest = client.requestAccessToken;
      client.requestAccessToken = () => {
        requestAccessTokenCalled = true;
        origRequest.call(client);
      };
      return client;
    };

    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });

    // Check when no token held
    provider.canRunWithoutPrompt();
    expect(requestAccessTokenCalled).toBe(false);
  });

  // =========================================================================
  // Error Callback Tests
  // =========================================================================

  test('error_callback popup_failed_to_open rejects with CloudBackupPromptError', async () => {
    const handle = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: handle.google,
      fetchImpl: makeFetchMock(state),
    });

    // Start connect and invoke error callback
    const connectPromise = provider.connect();
    handle.invokeErrorCallback({ type: 'popup_failed_to_open' });

    await expect(connectPromise).rejects.toThrow();
    const err = await connectPromise.catch((e) => e);
    expect(isCloudBackupPromptError(err)).toBe(true);
    expect(err.failure).toBe('popup-blocked');
  });

  test('error_callback popup_closed rejects with CloudBackupPromptError', async () => {
    const handle = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: handle.google,
      fetchImpl: makeFetchMock(state),
    });

    const connectPromise = provider.connect();
    handle.invokeErrorCallback({ type: 'popup_closed' });

    await expect(connectPromise).rejects.toThrow();
    const err = await connectPromise.catch((e) => e);
    expect(isCloudBackupPromptError(err)).toBe(true);
    expect(err.failure).toBe('popup-closed');
  });

  test('error_callback unknown type rejects with CloudBackupPromptError', async () => {
    const handle = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: handle.google,
      fetchImpl: makeFetchMock(state),
    });

    const connectPromise = provider.connect();
    handle.invokeErrorCallback({ type: 'unknown' });

    await expect(connectPromise).rejects.toThrow();
    const err = await connectPromise.catch((e) => e);
    expect(isCloudBackupPromptError(err)).toBe(true);
    expect(err.failure).toBe('unknown');
  });

  test('error_callback does NOT change connection state', async () => {
    const { google: google1 } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider1 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: google1,
      fetchImpl: makeFetchMock(state),
    });
    await provider1.connect();

    // Create new provider with error callback invocation
    const handle = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-2', expires_in: 3600 },
    });
    const provider2 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: handle.google,
      fetchImpl: makeFetchMock(state),
    });

    const connectPromise = provider2.connect();
    handle.invokeErrorCallback({ type: 'popup_closed' });

    await expect(connectPromise).rejects.toThrow();
    expect((await provider2.getConnectionState()).status).toBe('linked');
  });

  // =========================================================================
  // 401 Response Tests
  // =========================================================================

  test('401 response drops held token for next attempt', async () => {
    const { google: google1 } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider1 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: google1,
      fetchImpl: makeFetchMock(state),
    });
    await provider1.connect();
    expect(provider1.canRunWithoutPrompt()).toBe(true);

    // Create mock fetch that returns 401
    const fetch401: typeof fetch = async (input, init) => {
      return makeResponse(
        JSON.stringify({ error: { message: 'Unauthorized' } }),
        401,
        'application/json',
      );
    };

    const { google: google2 } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-2', expires_in: 3600 },
    });
    const provider2 = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google: google2,
      fetchImpl: fetch401,
    });
    await provider2.connect();
    expect(provider2.canRunWithoutPrompt()).toBe(true);

    // Try to upload which will hit 401
    await expect(
      provider2.uploadBackup({
        text: 'test',
        exportId: 'e1',
        schemaVersion: 1,
      }),
    ).rejects.toThrow(/Drive request failed/);

    // Token should be dropped
    expect(provider2.canRunWithoutPrompt()).toBe(false);
  });

  // =========================================================================
  // Upload/Download/Prune Tests (existing functionality kept)
  // =========================================================================

  test('uploadBackup creates pending then finalizes status=complete', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    await provider.connect();

    const result = await provider.uploadBackup({
      text: '{"a":1}',
      exportId: 'exp-1',
      schemaVersion: 1,
    });

    expect(result.metadata.status).toBe('complete');
    expect(result.metadata.exportId).toBe('exp-1');
    expect(state.files).toHaveLength(1);
    expect(state.files[0].appProperties?.status).toBe('complete');
    expect(state.files[0].body).toBe('{"a":1}');
  });

  test('downloadLatestBackup returns latest completed file body', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    await provider.connect();
    await provider.uploadBackup({
      text: 'first',
      exportId: 'a',
      schemaVersion: 1,
    });
    await provider.uploadBackup({
      text: 'second',
      exportId: 'b',
      schemaVersion: 1,
    });

    const latest = await provider.downloadLatestBackup();
    expect(latest?.text).toBe('second');
    expect(latest?.metadata.exportId).toBe('b');
  });

  test('downloadLatestBackup returns null when no completed files exist', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    await provider.connect();

    const latest = await provider.downloadLatestBackup();
    expect(latest).toBeNull();
  });

  test('pruneBackups deletes oldest completed beyond keepCount', async () => {
    const { google } = makeFakeGoogle({
      tokenResponse: { access_token: 'tok-1', expires_in: 3600 },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    await provider.connect();
    for (let i = 0; i < 4; i++) {
      await provider.uploadBackup({
        text: `t${i}`,
        exportId: `e${i}`,
        schemaVersion: 1,
      });
    }
    expect(state.files).toHaveLength(4);
    const summary = await provider.pruneBackups({
      keepCount: 2,
      stalePendingMs: 0,
    });
    expect(summary.deletedCompleted).toBe(2);
    expect(state.files).toHaveLength(2);
  });
});
