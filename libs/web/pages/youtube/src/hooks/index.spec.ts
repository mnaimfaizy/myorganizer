/* eslint-disable import/first */
const mockGetAccessToken = jest.fn();
const mockRefresh = jest.fn();
const mockClearAuthSession = jest.fn();
const mockGetApiBaseUrl = jest.fn(() => 'http://api.test');

jest.mock('@myorganiser/auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
  refresh: () => mockRefresh(),
  clearAuthSession: () => mockClearAuthSession(),
}));

jest.mock('@myorganiser/core', () => ({
  getApiBaseUrl: () => mockGetApiBaseUrl(),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  YouTubeRequestError,
  useYouTubeAcknowledgement,
  useYouTubeConnect,
  useYouTubeSyncStatus,
} from './index';

type MockResponseInit = {
  status: number;
  body?: unknown;
  jsonReject?: boolean;
};

function mockResponse({
  status,
  body = {},
  jsonReject = false,
}: MockResponseInit): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jsonReject
      ? jest.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
      : jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('useYouTubeConnect / apiFetch error paths', () => {
  const fetchMock = jest.fn<
    Promise<Response>,
    [RequestInfo | URL, RequestInit?]
  >();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockReturnValue('test-token');
    mockGetApiBaseUrl.mockReturnValue('http://api.test');
    mockRefresh.mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  function renderDisconnect() {
    const { result } = renderHook(() => useYouTubeConnect());
    return result.current.disconnect;
  }

  describe('throwFromResponse via disconnect non-OK', () => {
    it('H1: rejects YouTubeRequestError with message, status, and code from body', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          mockResponse({
            status: 409,
            body: { message: 'busy', code: 'sync_run_live' },
          }),
        ),
      );

      const disconnect = renderDisconnect();

      try {
        await disconnect();
        throw new Error('expected disconnect to reject');
      } catch (err) {
        expect(err).toBeInstanceOf(YouTubeRequestError);
        expect(err).toMatchObject({
          name: 'YouTubeRequestError',
          message: 'busy',
          status: 409,
          code: 'sync_run_live',
        });
      }
    });

    it('H2: rejects with fallback message when body has no message', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(mockResponse({ status: 500, body: {} })),
      );

      const disconnect = renderDisconnect();

      await expect(disconnect()).rejects.toMatchObject({
        name: 'YouTubeRequestError',
        message: 'Request failed: 500',
        status: 500,
      });
    });

    it('H3: rejects with fallback message when json() rejects', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(mockResponse({ status: 502, jsonReject: true })),
      );

      const disconnect = renderDisconnect();

      await expect(disconnect()).rejects.toMatchObject({
        name: 'YouTubeRequestError',
        message: 'Request failed: 502',
        status: 502,
      });
    });
  });

  describe('apiFetch 401 refresh path', () => {
    it('H4: clears session and rejects original 401 when refresh fails; no retry fetch', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          mockResponse({ status: 401, body: { message: 'expired' } }),
        ),
      );
      mockRefresh.mockRejectedValue(new Error('refresh failed'));

      const disconnect = renderDisconnect();

      await expect(disconnect()).rejects.toMatchObject({
        name: 'YouTubeRequestError',
        message: 'expired',
        status: 401,
      });
      expect(mockClearAuthSession).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('H5: retries once after successful refresh and resolves OK body', async () => {
      let call = 0;
      fetchMock.mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return Promise.resolve(
            mockResponse({ status: 401, body: { message: 'expired' } }),
          );
        }
        return Promise.resolve(
          mockResponse({
            status: 200,
            body: { ok: true, message: 'done' },
          }),
        );
      });
      mockRefresh.mockResolvedValue(undefined);

      const disconnect = renderDisconnect();
      const body = await disconnect();

      expect(body).toEqual({ ok: true, message: 'done' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mockClearAuthSession).not.toHaveBeenCalled();
    });

    it('H6: retries after refresh then rejects non-OK YouTubeRequestError', async () => {
      let call = 0;
      fetchMock.mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return Promise.resolve(
            mockResponse({ status: 401, body: { message: 'expired' } }),
          );
        }
        return Promise.resolve(
          mockResponse({
            status: 409,
            body: { message: 'live', code: 'sync_run_live' },
          }),
        );
      });
      mockRefresh.mockResolvedValue(undefined);

      const disconnect = renderDisconnect();

      await expect(disconnect()).rejects.toMatchObject({
        name: 'YouTubeRequestError',
        message: 'live',
        status: 409,
        code: 'sync_run_live',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mockClearAuthSession).not.toHaveBeenCalled();
    });
  });

  describe('happy disconnect', () => {
    it('H7: DELETE /youtube/disconnect with no request body and returns the parsed response', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          mockResponse({
            status: 200,
            body: { ok: true, message: 'disconnected' },
          }),
        ),
      );

      const disconnect = renderDisconnect();
      const body = await disconnect();

      expect(body).toEqual({ ok: true, message: 'disconnected' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe('http://api.test/youtube/disconnect');
      expect(init?.method).toBe('DELETE');
      expect(init?.body).toBeUndefined();
    });
  });
});

describe('useYouTubeSyncStatus triggers (#753)', () => {
  const beforeStamp = '2026-08-18T12:00:00.000Z';
  const afterStamp = '2026-08-18T12:01:00.000Z';
  const fetchMock = jest.fn<
    Promise<Response>,
    [RequestInfo | URL, RequestInit?]
  >();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockReturnValue('test-token');
    mockGetApiBaseUrl.mockReturnValue('http://api.test');
    mockRefresh.mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('triggerUploadSync resolves true when run did work (success with advanced timestamp)', async () => {
    // Mount-time fetch (called by useEffect)
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    // Pre-request read: lastSyncAttemptAt is beforeStamp
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    // PUT response: status is success with advanced timestamp
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: afterStamp,
            synced: 5,
            videosSynced: 20,
          },
        }),
      ),
    );

    // Re-read after PUT
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: afterStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    const { result } = renderHook(() => useYouTubeSyncStatus());

    // Wait for mount-time fetch to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let ran: boolean | undefined;
    await act(async () => {
      ran = await result.current.triggerUploadSync();
    });

    expect(ran).toBe(true);
  });

  it('triggerUploadSync resolves false when lost-mutex (success with unchanged timestamp)', async () => {
    // Mount-time fetch
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    // Pre-request read: lastSyncAttemptAt is beforeStamp
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    // PUT response: status is success but timestamp unchanged (lost mutex)
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            synced: 0,
            videosSynced: 0,
          },
        }),
      ),
    );

    // Re-read after PUT
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    const { result } = renderHook(() => useYouTubeSyncStatus());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let ran: boolean | undefined;
    await act(async () => {
      ran = await result.current.triggerUploadSync();
    });

    expect(ran).toBe(false);
  });

  it('triggerUploadSync resolves false when cooldown (non-ran status)', async () => {
    // Mount-time fetch
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    // Pre-request read: lastSyncAttemptAt is beforeStamp
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    // PUT response: cooldown status
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'cooldown',
            lastSyncAttemptAt: beforeStamp,
            synced: 0,
            videosSynced: 0,
            retryAt: afterStamp,
          },
        }),
      ),
    );

    // Re-read after PUT
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'cooldown',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            retryAt: afterStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    const { result } = renderHook(() => useYouTubeSyncStatus());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let ran: boolean | undefined;
    await act(async () => {
      ran = await result.current.triggerUploadSync();
    });

    expect(ran).toBe(false);
  });

  it('triggerChannelSync resolves true when run did work (success with advanced timestamp)', async () => {
    // Mount-time fetch
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: beforeStamp,
          },
        }),
      ),
    );

    // Pre-request read: channelLastAttemptAt is beforeStamp
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: beforeStamp,
          },
        }),
      ),
    );

    // PUT response: status is success with advanced lastAttemptAt
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastAttemptAt: afterStamp,
            synced: 5,
          },
        }),
      ),
    );

    // Re-read after PUT
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            channelStatus: 'success',
            channelLastAttemptAt: afterStamp,
          },
        }),
      ),
    );

    const { result } = renderHook(() => useYouTubeSyncStatus());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let ran: boolean | undefined;
    await act(async () => {
      ran = await result.current.triggerChannelSync();
    });

    expect(ran).toBe(true);
  });

  it('triggerChannelSync resolves false when lost-mutex (success with unchanged timestamp)', async () => {
    // Mount-time fetch
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: beforeStamp,
          },
        }),
      ),
    );

    // Pre-request read: channelLastAttemptAt is beforeStamp
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: beforeStamp,
          },
        }),
      ),
    );

    // PUT response: status is success but lastAttemptAt unchanged
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastAttemptAt: beforeStamp,
            synced: 0,
          },
        }),
      ),
    );

    // Re-read after PUT
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            channelStatus: 'success',
            channelLastAttemptAt: beforeStamp,
          },
        }),
      ),
    );

    const { result } = renderHook(() => useYouTubeSyncStatus());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let ran: boolean | undefined;
    await act(async () => {
      ran = await result.current.triggerChannelSync();
    });

    expect(ran).toBe(false);
  });

  it('triggerUploadSync resolves true even when re-read fails (failed re-read must not hide a run)', async () => {
    // Mock sequence: mount-time fetch, pre-request read, PUT, re-read (fails)
    // Mount-time fetch
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    // Pre-request read: lastSyncAttemptAt is beforeStamp
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: beforeStamp,
            lastSyncedAt: beforeStamp,
            channelStatus: 'never',
            channelLastAttemptAt: null,
          },
        }),
      ),
    );

    // PUT response: status is success with advanced timestamp
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: {
            status: 'success',
            lastSyncAttemptAt: afterStamp,
            synced: 5,
            videosSynced: 20,
          },
        }),
      ),
    );

    // Re-read after PUT fails, but hook swallows with .catch(() => undefined)
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new Error('Network error')),
    );

    const { result } = renderHook(() => useYouTubeSyncStatus());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let ran: boolean | undefined;
    await act(async () => {
      ran = await result.current.triggerUploadSync();
    });

    // Should still return true because PUT response showed a run did work
    expect(ran).toBe(true);
  });
});

describe('useYouTubeAcknowledgement (ADR 0129)', () => {
  const acknowledgementUrl = 'http://api.test/youtube/acknowledgement';
  const fetchMock = jest.fn<
    Promise<Response>,
    [RequestInfo | URL, RequestInit?]
  >();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockReturnValue('test-token');
    mockGetApiBaseUrl.mockReturnValue('http://api.test');
    mockRefresh.mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('reads acknowledged as true when acknowledgedAt is stored', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        mockResponse({
          status: 200,
          body: { acknowledgedAt: '2026-10-01T10:00:00.000Z' },
        }),
      ),
    );

    const { result } = renderHook(() => useYouTubeAcknowledgement());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.acknowledged).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe(acknowledgementUrl);
  });

  it('reads acknowledged as false when acknowledgedAt is null', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        mockResponse({ status: 200, body: { acknowledgedAt: null } }),
      ),
    );

    const { result } = renderHook(() => useYouTubeAcknowledgement());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.acknowledged).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('leaves acknowledged null with an error when the read fails', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(mockResponse({ status: 500, body: {} })),
    );

    const { result } = renderHook(() => useYouTubeAcknowledgement());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.acknowledged).toBeNull();
    expect(result.current.error).toBe('Request failed: 500');
  });

  it('accept POSTs the acknowledgement and flips acknowledged to true', async () => {
    fetchMock.mockImplementation((_url, init) =>
      Promise.resolve(
        init?.method === 'POST'
          ? mockResponse({
              status: 200,
              body: { acknowledgedAt: '2026-10-14T09:00:00.000Z' },
            })
          : mockResponse({ status: 200, body: { acknowledgedAt: null } }),
      ),
    );

    const { result } = renderHook(() => useYouTubeAcknowledgement());
    await waitFor(() => expect(result.current.acknowledged).toBe(false));

    await act(async () => {
      await result.current.accept();
    });

    expect(result.current.acknowledged).toBe(true);
    const postCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(postCall?.[0]).toBe(acknowledgementUrl);
  });

  it('accept rejects with the server error and leaves acknowledged false', async () => {
    fetchMock.mockImplementation((_url, init) =>
      Promise.resolve(
        init?.method === 'POST'
          ? mockResponse({ status: 500, body: { message: 'Save failed' } })
          : mockResponse({ status: 200, body: { acknowledgedAt: null } }),
      ),
    );

    const { result } = renderHook(() => useYouTubeAcknowledgement());
    await waitFor(() => expect(result.current.acknowledged).toBe(false));

    await act(async () => {
      await expect(result.current.accept()).rejects.toMatchObject({
        name: 'YouTubeRequestError',
        message: 'Save failed',
        status: 500,
      });
    });

    expect(result.current.acknowledged).toBe(false);
  });
});
