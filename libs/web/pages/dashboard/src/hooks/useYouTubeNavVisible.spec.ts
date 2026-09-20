/* eslint-disable import/first */
const mockGetAvailability = jest.fn();

jest.mock('@myorganizer/core', () => ({
  getApiBaseUrl: jest.fn(),
}));

jest.mock('@myorganizer/app-api-client', () => ({
  Configuration: jest.fn(function Configuration(config) {
    return config;
  }),
  YouTubeApi: jest.fn(function YouTubeApi() {
    return {
      getAvailability: mockGetAvailability,
    };
  }),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { Configuration, YouTubeApi } from '@myorganizer/app-api-client';
import { getApiBaseUrl } from '@myorganizer/core';
import { useYouTubeNavVisible } from './useYouTubeNavVisible';

const API_BASE = 'http://api.test';

describe('useYouTubeNavVisible', () => {
  beforeEach(() => {
    (getApiBaseUrl as jest.Mock).mockReset();
    (getApiBaseUrl as jest.Mock).mockReturnValue(API_BASE);
    mockGetAvailability.mockReset();
    (Configuration as jest.Mock).mockClear();
    (YouTubeApi as jest.Mock).mockClear();
  });

  it('starts false before getAvailability settles and constructs the generated client once', () => {
    mockGetAvailability.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useYouTubeNavVisible());

    expect(result.current).toBe(false);
    expect(getApiBaseUrl).toHaveBeenCalledTimes(1);
    expect(Configuration).toHaveBeenCalledTimes(1);
    expect(Configuration).toHaveBeenCalledWith({ basePath: API_BASE });
    expect(YouTubeApi).toHaveBeenCalledTimes(1);
    expect(YouTubeApi).toHaveBeenCalledWith({ basePath: API_BASE });
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
  });

  it('becomes true when getAvailability resolves with available true', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: true } });

    const { result } = renderHook(() => useYouTubeNavVisible());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
  });

  it('stays false when getAvailability resolves with available false', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: false } });

    const { result } = renderHook(() => useYouTubeNavVisible());

    await waitFor(() => {
      expect(mockGetAvailability).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });

  it('stays false when getAvailability rejects', async () => {
    mockGetAvailability.mockRejectedValue(new Error('network failure'));

    const { result } = renderHook(() => useYouTubeNavVisible());

    await waitFor(() => {
      expect(mockGetAvailability).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });

  it('stays false when available is not strictly true', async () => {
    mockGetAvailability.mockResolvedValue({
      data: { available: 'yes' as unknown as boolean },
    });

    const { result } = renderHook(() => useYouTubeNavVisible());

    await waitFor(() => {
      expect(mockGetAvailability).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });

  it('does not update state after unmount when getAvailability resolves late', async () => {
    let resolveAvailability!: (value: { data: { available: boolean } }) => void;

    mockGetAvailability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAvailability = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useYouTubeNavVisible());
    expect(result.current).toBe(false);

    unmount();

    resolveAvailability({ data: { available: true } });

    await Promise.resolve();

    expect(result.current).toBe(false);
  });
});
