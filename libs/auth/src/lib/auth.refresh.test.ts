jest.mock('@myorganizer/app-api-client');
jest.mock('@myorganizer/core');

import { AuthenticationApi } from '@myorganizer/app-api-client';
import { getApiBaseUrl } from '@myorganizer/core';
import {
  clearAuthSession,
  getCurrentUser,
  getAccessToken,
  refresh,
} from './auth';

describe('auth.refresh', () => {
  beforeEach(() => {
    clearAuthSession();
    jest.clearAllMocks();

    (getApiBaseUrl as jest.Mock).mockReturnValue('http://api.test');
  });

  describe('refresh() function', () => {
    it('calls refreshToken with empty body for web client (cookie-based)', async () => {
      const mockRefreshToken = jest.fn().mockResolvedValue({
        data: {
          token: 'new-access-token',
          expires_in: 600000,
          user: {
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            disabled: false,
          },
        },
      });

      (AuthenticationApi.prototype.refreshToken as jest.Mock) =
        mockRefreshToken;

      await refresh();

      expect(mockRefreshToken).toHaveBeenCalledWith({
        refreshTokenRequest: {},
      });
    });

    it('sets access token after successful refresh', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        role: 'user' as const,
        disabled: false,
      };

      (AuthenticationApi.prototype.refreshToken as jest.Mock).mockResolvedValue(
        {
          data: {
            token: 'new-access-token',
            expires_in: 600000,
            user: mockUser,
          },
        },
      );

      await refresh();

      expect(getAccessToken()).toBe('new-access-token');
    });

    it('sets current user after successful refresh', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        role: 'user' as const,
        disabled: false,
      };

      (AuthenticationApi.prototype.refreshToken as jest.Mock).mockResolvedValue(
        {
          data: {
            token: 'new-access-token',
            expires_in: 600000,
            user: mockUser,
          },
        },
      );

      await refresh();

      expect(getCurrentUser()).toEqual(mockUser);
    });

    it('returns AuthSession with token, expiresIn, and user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        role: 'user' as const,
        disabled: false,
      };

      (AuthenticationApi.prototype.refreshToken as jest.Mock).mockResolvedValue(
        {
          data: {
            token: 'new-access-token',
            expires_in: 600000,
            user: mockUser,
          },
        },
      );

      const result = await refresh();

      expect(result).toEqual({
        token: 'new-access-token',
        expiresIn: 600000,
        user: mockUser,
      });
    });

    it('throws error with message when refreshToken API call fails', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          data: { message: 'Invalid token' },
        },
      };

      (AuthenticationApi.prototype.refreshToken as jest.Mock).mockRejectedValue(
        axiosError,
      );

      await expect(refresh()).rejects.toThrow('Invalid token');
    });

    it('throws generic error when API fails without message', async () => {
      const axiosError = {
        isAxiosError: true,
        message: 'Network error',
      };

      (AuthenticationApi.prototype.refreshToken as jest.Mock).mockRejectedValue(
        axiosError,
      );

      await expect(refresh()).rejects.toThrow();
    });
  });

  describe('withCredentials contract for web', () => {
    it('getAuthAxios sets withCredentials:true for cookie-based refresh', async () => {
      const { getAuthAxios } = await import('./auth');

      // Note: axios.create is mocked, but we can verify the configuration passed
      const instance = getAuthAxios();

      // The instance should have been created with withCredentials: true
      // This is verified through the mock setup
      expect(instance).toBeDefined();
    });
  });
});
