const mockGetAvailability = jest.fn();
const mockGetAccess = jest.fn();

jest.mock('@myorganizer/core', () => ({
  getApiBaseUrl: jest.fn(),
}));

jest.mock('@myorganizer/auth', () => ({
  getAccessToken: jest.fn(),
  getAuthAxios: jest.fn(),
}));

jest.mock('@myorganizer/app-api-client', () => ({
  Configuration: jest.fn(function Configuration(config) {
    return config;
  }),
  YouTubeApi: jest.fn(function YouTubeApi() {
    return {
      getAvailability: mockGetAvailability,
      getAccess: mockGetAccess,
    };
  }),
}));

import { Configuration, YouTubeApi } from '@myorganizer/app-api-client';
import { getAccessToken, getAuthAxios } from '@myorganizer/auth';
import { getApiBaseUrl } from '@myorganizer/core';
import { getYouTubeAvailability } from './web-youtube';

const API_BASE = 'http://api.test';

describe('getYouTubeAvailability', () => {
  const authAxios = { name: 'auth-axios' };

  beforeEach(() => {
    (getApiBaseUrl as jest.Mock).mockReset();
    (getApiBaseUrl as jest.Mock).mockReturnValue(API_BASE);
    (getAccessToken as jest.Mock).mockReset();
    (getAccessToken as jest.Mock).mockReturnValue('access-token');
    (getAuthAxios as jest.Mock).mockReset();
    (getAuthAxios as jest.Mock).mockReturnValue(authAxios);
    mockGetAvailability.mockReset();
    mockGetAccess.mockReset();
    (Configuration as jest.Mock).mockClear();
    (YouTubeApi as jest.Mock).mockClear();
  });

  it('constructs the public availability client first, then the access client, and calls each endpoint once', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: true } });
    mockGetAccess.mockResolvedValue({ data: { granted: true } });

    await getYouTubeAvailability();

    expect(Configuration).toHaveBeenCalledTimes(2);
    expect(Configuration).toHaveBeenNthCalledWith(1, { basePath: API_BASE });
    expect(YouTubeApi).toHaveBeenCalledTimes(2);
    expect(YouTubeApi).toHaveBeenNthCalledWith(1, { basePath: API_BASE });
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
    expect(mockGetAccess).toHaveBeenCalledTimes(1);
  });

  it('returns true when the switch is on and YouTube Access is granted', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: true } });
    mockGetAccess.mockResolvedValue({ data: { granted: true } });

    await expect(getYouTubeAvailability()).resolves.toBe(true);
  });

  it.each([
    ['false', false],
    ['a non-boolean value ("yes")', 'yes'],
  ])(
    'returns false when the switch is on but granted is %s',
    async (_label, granted) => {
      mockGetAvailability.mockResolvedValue({ data: { available: true } });
      mockGetAccess.mockResolvedValue({ data: { granted } });

      await expect(getYouTubeAvailability()).resolves.toBe(false);
    },
  );

  it('returns false and never calls the access endpoint when the switch is off, even for a granted User', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: false } });
    mockGetAccess.mockResolvedValue({ data: { granted: true } });

    await expect(getYouTubeAvailability()).resolves.toBe(false);

    expect(mockGetAccess).not.toHaveBeenCalled();
    expect(YouTubeApi).toHaveBeenCalledTimes(1);
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
      expect(mockGetAccess).not.toHaveBeenCalled();
    },
  );

  it('propagates getAvailability rejection unchanged', async () => {
    const rejection = new Error('network failure');
    mockGetAvailability.mockRejectedValue(rejection);

    await expect(getYouTubeAvailability()).rejects.toBe(rejection);
  });

  it('propagates getAccess rejection unchanged, so the hook fails closed on it', async () => {
    const rejection = new Error('access lookup failed');
    mockGetAvailability.mockResolvedValue({ data: { available: true } });
    mockGetAccess.mockRejectedValue(rejection);

    await expect(getYouTubeAvailability()).rejects.toBe(rejection);
  });

  it('builds the access client with a bearer token provider and the auth axios instance', async () => {
    mockGetAvailability.mockResolvedValue({ data: { available: true } });
    mockGetAccess.mockResolvedValue({ data: { granted: true } });

    await getYouTubeAvailability();

    expect(Configuration).toHaveBeenNthCalledWith(2, {
      basePath: API_BASE,
      accessToken: expect.any(Function),
    });
    expect(YouTubeApi).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ basePath: API_BASE }),
      undefined,
      authAxios,
    );

    const accessConfig = (YouTubeApi as jest.Mock).mock.calls[1][0];
    expect(accessConfig.accessToken()).toBe('access-token');

    (getAccessToken as jest.Mock).mockReturnValue(undefined);
    expect(accessConfig.accessToken()).toBe('');
  });
});
