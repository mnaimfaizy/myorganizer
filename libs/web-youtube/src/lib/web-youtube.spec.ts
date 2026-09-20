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

import { Configuration, YouTubeApi } from '@myorganizer/app-api-client';
import { getApiBaseUrl } from '@myorganizer/core';
import { getYouTubeAvailability } from './web-youtube';

const API_BASE = 'http://api.test';

describe('getYouTubeAvailability', () => {
  beforeEach(() => {
    (getApiBaseUrl as jest.Mock).mockReset();
    (getApiBaseUrl as jest.Mock).mockReturnValue(API_BASE);
    mockGetAvailability.mockReset();
    (Configuration as jest.Mock).mockClear();
    (YouTubeApi as jest.Mock).mockClear();
  });

  it('constructs the API client once and calls getAvailability exactly once', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: true } });

    await getYouTubeAvailability();

    expect(getApiBaseUrl).toHaveBeenCalledTimes(1);
    expect(Configuration).toHaveBeenCalledTimes(1);
    expect(Configuration).toHaveBeenCalledWith({ basePath: API_BASE });
    expect(YouTubeApi).toHaveBeenCalledTimes(1);
    expect(YouTubeApi).toHaveBeenCalledWith({ basePath: API_BASE });
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
  });

  it('returns true when getAvailability resolves with available true', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: true } });

    await expect(getYouTubeAvailability()).resolves.toBe(true);
  });

  it('returns false when getAvailability resolves with available false', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: false } });

    await expect(getYouTubeAvailability()).resolves.toBe(false);
  });

  it.each([
    ['string "yes"', 'yes'],
    ['number 1', 1],
    ['null', null],
    ['undefined', undefined],
  ])(
    'returns false when available is a non-boolean value (%s)',
    async (_label, available) => {
      mockGetAvailability.mockResolvedValue({ data: { available } });

      await expect(getYouTubeAvailability()).resolves.toBe(false);
    },
  );

  it('propagates getAvailability rejection unchanged', async () => {
    const rejection = new Error('network failure');
    mockGetAvailability.mockRejectedValue(rejection);

    await expect(getYouTubeAvailability()).rejects.toBe(rejection);
  });
});
