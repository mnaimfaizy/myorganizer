jest.mock('@myorganizer/app-api-client');
jest.mock('@myorganizer/core');
jest.mock('axios');

import { AuthenticationApi } from '@myorganizer/app-api-client';
import { getApiBaseUrl } from '@myorganizer/core';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

import {
  createAuthSessionTransportAdapter,
  type AuthSessionTransportAdapter,
} from './auth-session-transport-adapter';
import type { AuthSessionStorageAdapter } from './auth-session-storage-adapter';

describe('createAuthSessionTransportAdapter', () => {
  let mockStorage: jest.Mocked<AuthSessionStorageAdapter>;
  let adapter: AuthSessionTransportAdapter;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    role: 'user' as const,
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {
      getAccessToken: jest.fn().mockReturnValue('current-token'),
      setAccessToken: jest.fn(),
      getCurrentUser: jest.fn().mockReturnValue(mockUser),
      setCurrentUser: jest.fn(),
      clearSession: jest.fn(),
    };

    // Create a callable mock axios instance
    const mockCall = jest.fn().mockResolvedValue({ status: 200, data: {} });
    mockAxiosInstance = Object.assign(mockCall, {
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    }) as unknown as jest.Mocked<AxiosInstance>;

    (getApiBaseUrl as jest.Mock).mockReturnValue('http://api.test');
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    adapter = createAuthSessionTransportAdapter(mockStorage);
  });

  describe('getAuthAxios', () => {
    it('creates axios instance with baseURL and withCredentials', () => {
      const instance = adapter.getAuthAxios();

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://api.test',
        withCredentials: true,
      });
      expect(instance).toBe(mockAxiosInstance);
    });

    it('returns cached instance on second call', () => {
      const instance1 = adapter.getAuthAxios();
      const instance2 = adapter.getAuthAxios();

      expect(instance1).toBe(instance2);
      expect(axios.create).toHaveBeenCalledTimes(1);
    });

    it('sets up response interceptor', () => {
      adapter.getAuthAxios();

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
      );
    });
  });

  describe('401 retry interceptor setup', () => {
    it('interceptor is configured on axios instance', () => {
      adapter.getAuthAxios();

      const interceptorCall = (
        mockAxiosInstance.interceptors.response.use as jest.Mock
      ).mock.calls[0];
      expect(interceptorCall.length).toBe(2);
      expect(typeof interceptorCall[0]).toBe('function'); // onFulfilled
      expect(typeof interceptorCall[1]).toBe('function'); // onRejected
    });

    it('response interceptor fulfillment returns responses unchanged', () => {
      adapter.getAuthAxios();

      const onFulfilled = (
        mockAxiosInstance.interceptors.response.use as jest.Mock
      ).mock.calls[0][0];

      const mockResponse = { status: 200, data: { message: 'ok' } };
      const result = onFulfilled(mockResponse);

      expect(result).toBe(mockResponse);
    });
  });

  describe('401 retry interceptor onRejected behavior', () => {
    let onRejected: (error: any) => Promise<any>;

    beforeEach(() => {
      adapter.getAuthAxios();
      const interceptorCall = (
        mockAxiosInstance.interceptors.response.use as jest.Mock
      ).mock.calls[0];
      onRejected = interceptorCall[1];
    });

    it('401 triggers retry with refresh on non-auth URL', async () => {
      const mockRefreshResponse = {
        data: {
          token: 'new-token',
          expires_in: 3600,
          user: mockUser,
        },
      };

      (AuthenticationApi as jest.Mock).mockImplementationOnce(() => ({
        refreshToken: jest.fn().mockResolvedValue(mockRefreshResponse),
      }));

      const originalRequest = {
        url: '/todos',
        method: 'GET',
        config: {},
        _retry: false,
      } as any;

      const error = new Error('Unauthorized') as any;
      error.response = { status: 401 };
      error.config = originalRequest;

      const retryPromise = onRejected(error);

      expect(mockStorage.clearSession).not.toHaveBeenCalled();

      await retryPromise;

      expect(mockStorage.setAccessToken).toHaveBeenCalledWith('new-token');
      expect(mockStorage.setCurrentUser).toHaveBeenCalledWith(mockUser);
      expect(originalRequest._retry).toBe(true);
      expect(mockAxiosInstance).toHaveBeenCalledWith(originalRequest);
    });

    it('_retry flag guard rejects immediately without refresh', async () => {
      const originalRequest = {
        url: '/todos',
        method: 'GET',
        config: {},
        _retry: true,
      } as any;

      const error = new Error('Unauthorized') as any;
      error.response = { status: 401 };
      error.config = originalRequest;

      const promise = onRejected(error);

      await expect(promise).rejects.toBe(error);
      expect(mockStorage.setAccessToken).not.toHaveBeenCalled();
    });

    it('refreshInFlight deduplication: concurrent 401 errors call refresh once', async () => {
      const mockRefreshResponse = {
        data: {
          token: 'new-token',
          expires_in: 3600,
          user: mockUser,
        },
      };

      const refreshTokenMock = jest.fn().mockResolvedValue(mockRefreshResponse);

      (AuthenticationApi as jest.Mock).mockImplementationOnce(() => ({
        refreshToken: refreshTokenMock,
      }));

      const originalRequest1 = {
        url: '/todos',
        method: 'GET',
        config: {},
        _retry: false,
      } as any;

      const originalRequest2 = {
        url: '/notes',
        method: 'GET',
        config: {},
        _retry: false,
      } as any;

      const error1 = new Error('Unauthorized') as any;
      error1.response = { status: 401 };
      error1.config = originalRequest1;

      const error2 = new Error('Unauthorized') as any;
      error2.response = { status: 401 };
      error2.config = originalRequest2;

      const promise1 = onRejected(error1);
      const promise2 = onRejected(error2);

      await Promise.all([promise1, promise2]);

      expect(refreshTokenMock).toHaveBeenCalledTimes(1);
      expect(originalRequest1._retry).toBe(true);
      expect(originalRequest2._retry).toBe(true);
    });

    it('auth URL exclusion: 401 on /auth/login rejects immediately', async () => {
      const originalRequest = {
        url: '/auth/login',
        method: 'POST',
        config: {},
        _retry: false,
      } as any;

      const error = new Error('Unauthorized') as any;
      error.response = { status: 401 };
      error.config = originalRequest;

      const promise = onRejected(error);

      await expect(promise).rejects.toBe(error);
      expect(mockStorage.setAccessToken).not.toHaveBeenCalled();
    });

    it('auth URL exclusion: 401 on /auth/refresh rejects immediately', async () => {
      const originalRequest = {
        url: '/auth/refresh',
        method: 'POST',
        config: {},
        _retry: false,
      } as any;

      const error = new Error('Unauthorized') as any;
      error.response = { status: 401 };
      error.config = originalRequest;

      const promise = onRejected(error);

      await expect(promise).rejects.toBe(error);
      expect(mockStorage.setAccessToken).not.toHaveBeenCalled();
    });

    it('session clear on refresh failure: clearSession called before reject', async () => {
      const refreshError = new Error('Refresh failed');

      (AuthenticationApi as jest.Mock).mockImplementationOnce(() => ({
        refreshToken: jest.fn().mockRejectedValue(refreshError),
      }));

      const originalRequest = {
        url: '/todos',
        method: 'GET',
        config: {},
        _retry: false,
      } as any;

      const error = new Error('Unauthorized') as any;
      error.response = { status: 401 };
      error.config = originalRequest;

      const promise = onRejected(error);

      await expect(promise).rejects.toBe(refreshError);
      expect(mockStorage.clearSession).toHaveBeenCalled();
      expect(mockStorage.setAccessToken).not.toHaveBeenCalled();
    });

    it('non-401 error rejects immediately', async () => {
      const originalRequest = {
        url: '/todos',
        method: 'GET',
        config: {},
        _retry: false,
      } as any;

      const error = new Error('Server error') as any;
      error.response = { status: 500 };
      error.config = originalRequest;

      const promise = onRejected(error);

      await expect(promise).rejects.toBe(error);
      expect(mockStorage.setAccessToken).not.toHaveBeenCalled();
    });

    it('error with no config rejects immediately', async () => {
      const error = new Error('Network error') as any;
      error.response = { status: 401 };
      error.config = undefined;

      const promise = onRejected(error);

      await expect(promise).rejects.toBe(error);
      expect(mockStorage.setAccessToken).not.toHaveBeenCalled();
    });

    it('error with no response rejects immediately', async () => {
      const originalRequest = {
        url: '/todos',
        method: 'GET',
        config: {},
        _retry: false,
      } as any;

      const error = new Error('Network error') as any;
      error.response = undefined;
      error.config = originalRequest;

      const promise = onRejected(error);

      await expect(promise).rejects.toBe(error);
      expect(mockStorage.setAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('getAuthApi', () => {
    it('returns AuthenticationApi instance', () => {
      const api = adapter.getAuthApi();

      expect(AuthenticationApi).toHaveBeenCalled();
      expect(api).toBeDefined();
    });

    it('passes axios instance to AuthenticationApi', () => {
      adapter.getAuthAxios();
      adapter.getAuthApi();

      const callArgs = (AuthenticationApi as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe(mockAxiosInstance);
    });
  });
});
