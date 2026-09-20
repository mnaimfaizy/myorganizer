/* eslint-disable import/first */
jest.mock('@myorganizer/core', () => ({
  getApiBaseUrl: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { getApiBaseUrl } from '@myorganizer/core';
import { useYouTubeNavVisible } from './useYouTubeNavVisible';

const API_BASE = 'http://api.test';

describe('useYouTubeNavVisible', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    (getApiBaseUrl as jest.Mock).mockReset();
    (getApiBaseUrl as jest.Mock).mockReturnValue(API_BASE);
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it('starts false before fetch settles and calls availability endpoint once', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useYouTubeNavVisible());

    expect(result.current).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/youtube/availability`, {
      credentials: 'include',
    });
  });

  it('becomes true when availability responds ok with available true', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ available: true }),
    });

    const { result } = renderHook(() => useYouTubeNavVisible());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/youtube/availability`, {
      credentials: 'include',
    });
  });

  it('stays false when availability responds ok with available false', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ available: false }),
    });

    const { result } = renderHook(() => useYouTubeNavVisible());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });

  it('stays false when availability responds not ok without parsing json', async () => {
    const json = jest.fn();
    mockFetch.mockResolvedValue({
      ok: false,
      json,
    });

    const { result } = renderHook(() => useYouTubeNavVisible());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
    expect(json).not.toHaveBeenCalled();
  });

  it('stays false when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network failure'));

    const { result } = renderHook(() => useYouTubeNavVisible());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });

  it('stays false when available is not strictly true', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ available: 'yes' }),
    });

    const { result } = renderHook(() => useYouTubeNavVisible());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });

  it('does not update state after unmount when fetch resolves late', async () => {
    let resolveFetch!: (value: {
      ok: boolean;
      json: () => Promise<{ available: boolean }>;
    }) => void;

    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useYouTubeNavVisible());
    expect(result.current).toBe(false);

    unmount();

    resolveFetch({
      ok: true,
      json: async () => ({ available: true }),
    });

    await Promise.resolve();

    expect(result.current).toBe(false);
  });
});
