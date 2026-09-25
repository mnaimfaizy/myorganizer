/**
 * @jest-environment jsdom
 */
jest.mock('./web-youtube', () => ({
  getYouTubeAvailability: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { getYouTubeAvailability } from './web-youtube';
import { useYouTubeAvailability } from './use-youtube-availability';

const mockGetYouTubeAvailability = getYouTubeAvailability as jest.Mock;

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
});
