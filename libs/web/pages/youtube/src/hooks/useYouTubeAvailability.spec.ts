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
import { useYouTubeAvailability } from './index';

const API_BASE = 'http://api.test';

describe('useYouTubeAvailability', () => {
  beforeEach(() => {
    (getApiBaseUrl as jest.Mock).mockReset();
    (getApiBaseUrl as jest.Mock).mockReturnValue(API_BASE);
    mockGetAvailability.mockReset();
    (Configuration as jest.Mock).mockClear();
    (YouTubeApi as jest.Mock).mockClear();
  });

  it('starts with loading true and constructs the generated client once', () => {
    mockGetAvailability.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useYouTubeAvailability());

    expect(result.current).toEqual({
      available: null,
      loading: true,
      error: null,
    });
    expect(getApiBaseUrl).toHaveBeenCalledTimes(1);
    expect(Configuration).toHaveBeenCalledTimes(1);
    expect(Configuration).toHaveBeenCalledWith({ basePath: API_BASE });
    expect(YouTubeApi).toHaveBeenCalledTimes(1);
    expect(YouTubeApi).toHaveBeenCalledWith({ basePath: API_BASE });
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
  });

  it('sets available true when getAvailability resolves with available true', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: true } });

    const { result } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current).toEqual({
      available: true,
      loading: false,
      error: null,
    });
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
  });

  it('sets available false when getAvailability resolves with available false', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: false } });

    const { result } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current).toEqual({
      available: false,
      loading: false,
      error: null,
    });
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
  });

  it('stores the same Error instance when getAvailability rejects with Error', async () => {
    const rejection = new Error('network failure');
    mockGetAvailability.mockRejectedValue(rejection);

    const { result } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.available).toBe(false);
    expect(result.current.error).toBe(rejection);
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
  });

  it('normalizes non-Error rejections into Error instances', async () => {
    mockGetAvailability.mockRejectedValue('service unavailable');

    const { result } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.available).toBe(false);
    expect(result.current.error).toEqual(new Error('service unavailable'));
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
  });

  it('does not call getAvailability again on rerender after settled', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: true } });

    const { result, rerender } = renderHook(() => useYouTubeAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender();

    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
    expect(Configuration).toHaveBeenCalledTimes(1);
    expect(YouTubeApi).toHaveBeenCalledTimes(1);
  });
});
