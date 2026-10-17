/**
 * @jest-environment jsdom
 */
jest.mock('./web-youtube', () => ({
  getYouTubeAvailability: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { getYouTubeAvailability } from './web-youtube';
import { useYouTubeAvailability } from './use-youtube-availability';
import { requestYouTubeAvailabilityRecheck } from './youtube-availability-recheck';

const mockGetYouTubeAvailability = getYouTubeAvailability as jest.Mock;

interface Deferred {
  promise: Promise<boolean>;
  resolve: (value: boolean) => void;
  reject: (reason: unknown) => void;
}

function createDeferred(): Deferred {
  let resolve!: (value: boolean) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<boolean>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useYouTubeAvailability', () => {
  beforeEach(() => {
    mockGetYouTubeAvailability.mockReset();
  });

  it('starts with loading true and calls getYouTubeAvailability once', () => {
    const pending: { resolve?: (value: boolean) => void } = {};
    mockGetYouTubeAvailability.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          pending.resolve = resolve;
        }),
    );

    const { result } = renderHook(() => useYouTubeAvailability());

    expect(result.current).toEqual({
      available: null,
      loading: true,
      error: null,
    });
    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(1);
  });

  it('sets available true when getYouTubeAvailability resolves true', async () => {
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current).toEqual({
      available: true,
      loading: false,
      error: null,
    });
    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(1);
  });

  it('sets available false when getYouTubeAvailability resolves false', async () => {
    mockGetYouTubeAvailability.mockResolvedValue(false);

    const { result } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current).toEqual({
      available: false,
      loading: false,
      error: null,
    });
    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(1);
  });

  it('stores the same Error instance when getYouTubeAvailability rejects with Error', async () => {
    const rejection = new Error('network failure');
    mockGetYouTubeAvailability.mockRejectedValue(rejection);

    const { result } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.available).toBe(false);
    expect(result.current.error).toBe(rejection);
    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(1);
  });

  it('normalizes non-Error rejections into Error instances', async () => {
    mockGetYouTubeAvailability.mockRejectedValue('service unavailable');

    const { result } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.available).toBe(false);
    expect(result.current.error).toEqual(new Error('service unavailable'));
    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(1);
  });

  it('does not call getYouTubeAvailability again on rerender after settled', async () => {
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const { result, rerender } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender();

    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(1);
  });

  it('does not update state after unmount when getYouTubeAvailability resolves late', async () => {
    let resolveAvailability!: (value: boolean) => void;

    mockGetYouTubeAvailability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAvailability = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useYouTubeAvailability());
    expect(result.current).toEqual({
      available: null,
      loading: true,
      error: null,
    });

    unmount();

    resolveAvailability(true);

    await Promise.resolve();

    expect(result.current).toEqual({
      available: null,
      loading: true,
      error: null,
    });
  });

  it('flips to unavailable when a re-check requested after mount answers false', async () => {
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useYouTubeAvailability());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Access is withdrawn after mount: the next availability check answers false.
    mockGetYouTubeAvailability.mockResolvedValue(false);
    await act(async () => {
      requestYouTubeAvailabilityRecheck();
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        available: false,
        loading: false,
        error: null,
      });
    });
    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(2);
  });

  it('keeps available true when an ordinary re-check still answers true', async () => {
    const recheck = createDeferred();
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useYouTubeAvailability());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetYouTubeAvailability.mockReturnValue(recheck.promise);
    act(() => {
      requestYouTubeAvailabilityRecheck();
    });
    await act(async () => {
      recheck.resolve(true);
    });

    expect(result.current).toEqual({
      available: true,
      loading: false,
      error: null,
    });
    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(2);
  });

  it('keeps the current answer, without loading, while a re-check is pending', async () => {
    const recheck = createDeferred();
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useYouTubeAvailability());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetYouTubeAvailability.mockReturnValue(recheck.promise);
    act(() => {
      requestYouTubeAvailabilityRecheck();
    });

    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({
      available: true,
      loading: false,
      error: null,
    });

    await act(async () => {
      recheck.resolve(true);
    });
  });

  it('keeps the previous answer and records the error when a re-check rejects with Error', async () => {
    const rejection = new Error('network blip');
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useYouTubeAvailability());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetYouTubeAvailability.mockRejectedValue(rejection);
    await act(async () => {
      requestYouTubeAvailabilityRecheck();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(rejection);
    });
    expect(result.current).toEqual({
      available: true,
      loading: false,
      error: rejection,
    });
  });

  it('wraps a non-Error re-check rejection in an Error and keeps the previous answer', async () => {
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useYouTubeAvailability());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetYouTubeAvailability.mockRejectedValue('network blip');
    await act(async () => {
      requestYouTubeAvailabilityRecheck();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error('network blip'));
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.available).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('re-checks every mounted instance on one request', async () => {
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const first = renderHook(() => useYouTubeAvailability());
    const second = renderHook(() => useYouTubeAvailability());
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
      expect(second.result.current.loading).toBe(false);
    });

    mockGetYouTubeAvailability.mockResolvedValue(false);
    await act(async () => {
      requestYouTubeAvailabilityRecheck();
    });

    await waitFor(() => {
      expect(first.result.current.available).toBe(false);
      expect(second.result.current.available).toBe(false);
    });
    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(4);
  });

  it('stops re-checking an instance once it is unmounted', async () => {
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const first = renderHook(() => useYouTubeAvailability());
    const second = renderHook(() => useYouTubeAvailability());
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
      expect(second.result.current.loading).toBe(false);
    });

    first.unmount();

    // Access is withdrawn: only the still-mounted instance should learn it.
    mockGetYouTubeAvailability.mockResolvedValue(false);
    await act(async () => {
      requestYouTubeAvailabilityRecheck();
    });

    // Only the still-mounted instance re-checks: 2 initial checks + 1 re-check.
    expect(mockGetYouTubeAvailability).toHaveBeenCalledTimes(3);
    await waitFor(() => {
      expect(second.result.current).toEqual({
        available: false,
        loading: false,
        error: null,
      });
    });
    // The unmounted instance's last rendered answer is left untouched.
    expect(first.result.current.available).toBe(true);
  });

  it('lets the latest requested re-check win over an earlier one that settles later', async () => {
    const rechecks: Deferred[] = [];
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useYouTubeAvailability());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetYouTubeAvailability.mockImplementation(() => {
      const recheck = createDeferred();
      rechecks.push(recheck);
      return recheck.promise;
    });
    act(() => {
      requestYouTubeAvailabilityRecheck();
      requestYouTubeAvailabilityRecheck();
    });
    expect(rechecks).toHaveLength(2);

    // The later-requested re-check answers first; the earlier one settles last.
    await act(async () => {
      rechecks[1].resolve(false);
    });
    await act(async () => {
      rechecks[0].resolve(true);
    });

    expect(result.current).toEqual({
      available: false,
      loading: false,
      error: null,
    });
  });

  it('ignores a stale re-check rejection once a later re-check has answered', async () => {
    const rechecks: Deferred[] = [];
    mockGetYouTubeAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useYouTubeAvailability());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetYouTubeAvailability.mockImplementation(() => {
      const recheck = createDeferred();
      rechecks.push(recheck);
      return recheck.promise;
    });
    act(() => {
      requestYouTubeAvailabilityRecheck();
      requestYouTubeAvailabilityRecheck();
    });
    expect(rechecks).toHaveLength(2);

    await act(async () => {
      rechecks[1].resolve(false);
    });
    await act(async () => {
      rechecks[0].reject(new Error('stale'));
    });

    expect(result.current).toEqual({
      available: false,
      loading: false,
      error: null,
    });
  });
});
