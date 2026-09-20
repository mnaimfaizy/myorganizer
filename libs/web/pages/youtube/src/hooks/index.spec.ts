/* eslint-disable import/first */
const mockGetAccessToken = jest.fn();
const mockRefresh = jest.fn();
const mockClearAuthSession = jest.fn();
const mockGetApiBaseUrl = jest.fn(() => 'http://api.test');

jest.mock('@myorganizer/auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
  refresh: () => mockRefresh(),
  clearAuthSession: () => mockClearAuthSession(),
}));

jest.mock('@myorganizer/core', () => ({
  getApiBaseUrl: () => mockGetApiBaseUrl(),
}));

import { renderHook } from '@testing-library/react';
import { YouTubeRequestError, useYouTubeConnect } from './index';

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
    it('H7: DELETE /youtube/disconnect with deleteWatchedMarks true', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          mockResponse({
            status: 200,
            body: { ok: true, message: 'disconnected' },
          }),
        ),
      );

      const disconnect = renderDisconnect();
      const body = await disconnect({ deleteWatchedMarks: true });

      expect(body).toEqual({ ok: true, message: 'disconnected' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe('http://api.test/youtube/disconnect');
      expect(init?.method).toBe('DELETE');
      expect(JSON.parse(String(init?.body))).toEqual({
        deleteWatchedMarks: true,
      });
    });
  });
});
