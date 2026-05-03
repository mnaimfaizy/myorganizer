import { beforeEach, describe, expect, test } from '@jest/globals';

import { GoogleDriveCloudBackupProvider } from './googleDriveProvider';
import {
  GisTokenClient,
  GisTokenResponse,
  GoogleNamespace,
} from './googleIdentity.types';

interface FakeFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  appProperties?: Record<string, string>;
  body?: string;
}

function makeFakeGoogle(opts: {
  tokenResponse: GisTokenResponse;
  onRevoke?: (token: string) => void;
}): GoogleNamespace {
  let activeCallback: ((r: GisTokenResponse) => void) | null = null;
  const tokenClient: GisTokenClient = {
    callback: () => undefined,
    requestAccessToken: () => {
      activeCallback?.(opts.tokenResponse);
    },
  };
  return {
    accounts: {
      oauth2: {
        initTokenClient: ({ callback }) => {
          activeCallback = callback;
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
  });

  test('connect acquires token and reports connected state', async () => {
    const google = makeFakeGoogle({
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

    expect((await provider.getConnectionState()).status).toBe('disconnected');
    const result = await provider.connect();
    expect(result.status).toBe('connected');
    expect((await provider.getConnectionState()).status).toBe('connected');
  });

  test('uploadBackup creates pending then finalizes status=complete', async () => {
    const google = makeFakeGoogle({
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
    const google = makeFakeGoogle({
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
    const google = makeFakeGoogle({
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
    const google = makeFakeGoogle({
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

  test('failed token acquisition marks needs-reconnect', async () => {
    const google = makeFakeGoogle({
      tokenResponse: { error: 'access_denied' },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    await expect(provider.connect()).rejects.toThrow();
    expect((await provider.getConnectionState()).status).toBe(
      'needs-reconnect',
    );
  });

  test('canRunSilently returns false when token error occurs', async () => {
    const google = makeFakeGoogle({
      tokenResponse: { error: 'consent_required' },
    });
    const provider = new GoogleDriveCloudBackupProvider({
      clientId: 'client-1',
      google,
      fetchImpl: makeFetchMock(state),
    });
    expect(await provider.canRunSilently()).toBe(false);
    expect((await provider.getConnectionState()).status).toBe(
      'needs-reconnect',
    );
  });
});
