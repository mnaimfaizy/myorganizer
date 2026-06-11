import { AuthenticationApi, Configuration } from '@myorganizer/app-api-client';
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { Platform } from 'react-native';
import {
  clearRefreshToken,
  getRefreshToken,
  saveRefreshToken,
} from '../storage/keychain';
import type { AuthTokens, Login200Response } from './types';

// On Android emulators, 10.0.2.2 routes to the host machine's localhost.
// On iOS simulators and physical devices, localhost/127.0.0.1 works directly.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_PATH = `http://${DEV_HOST}:3000/api/v1`;

type TokenRefreshCallback = (tokens: AuthTokens | null) => void;

let accessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];
let tokenRefreshCallback: TokenRefreshCallback | null = null;

function subscribeToTokenRefresh(
  callback: (token: string | null) => void,
): void {
  refreshSubscribers.push(callback);
}

function notifyRefreshSubscribers(token: string | null): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

export function setTokenRefreshCallback(callback: TokenRefreshCallback): void {
  tokenRefreshCallback = callback;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_PATH,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeToTokenRefresh((newToken) => {
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const storedRefreshToken = await getRefreshToken();
      if (!storedRefreshToken) {
        throw new Error('No refresh token available');
      }

      const refreshApi = new AuthenticationApi(
        new Configuration({ basePath: BASE_PATH }),
        BASE_PATH,
        axios,
      );

      const response = await refreshApi.refreshToken({
        refreshTokenRequest: { refresh_token: storedRefreshToken },
      });

      const data: Login200Response = response.data;
      const newAccessToken = data.token;
      const newRefreshToken = data.refresh_token;

      if (!newAccessToken) {
        throw new Error('No access token in refresh response');
      }

      accessToken = newAccessToken;

      if (newRefreshToken) {
        await saveRefreshToken(newRefreshToken);
      }

      const tokens: AuthTokens = {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken || storedRefreshToken,
        expiresIn: data.expires_in,
      };

      if (tokenRefreshCallback) {
        tokenRefreshCallback(tokens);
      }

      notifyRefreshSubscribers(newAccessToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }

      return apiClient(originalRequest);
    } catch (refreshError) {
      await clearRefreshToken();
      accessToken = null;

      if (tokenRefreshCallback) {
        tokenRefreshCallback(null);
      }

      notifyRefreshSubscribers(null);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export function createAuthApi(): AuthenticationApi {
  const config = new Configuration({
    basePath: BASE_PATH,
    accessToken: () => accessToken || '',
  });
  return new AuthenticationApi(config, BASE_PATH, apiClient);
}
