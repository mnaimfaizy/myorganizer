import { AuthenticationApi, Configuration } from '@myorganizer/app-api-client';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import {
  clearRefreshToken,
  getRefreshToken,
  saveRefreshToken,
} from '../storage/keychain';
import {
  createSessionRefresher,
  installRefreshOn401,
  type RefreshOutcome,
} from './sessionRefresh';
import type { AuthTokens } from './types';

// On Android emulators, 10.0.2.2 routes to the host machine's localhost.
// On iOS simulators and physical devices, localhost/127.0.0.1 works directly.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_PATH = `http://${DEV_HOST}:3000/api/v1`;

type TokenRefreshCallback = (tokens: AuthTokens | null) => void;

let accessToken: string | null = null;
let tokenRefreshCallback: TokenRefreshCallback | null = null;

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

// The refresh goes out on bare `axios`, not `apiClient`: it carries no Access
// Token, and a 401 answering it must reach the classifier as a rejection
// rather than re-enter the refresh-on-401 interceptor below.
const refreshApi = new AuthenticationApi(
  new Configuration({ basePath: BASE_PATH }),
  BASE_PATH,
  axios,
);

/**
 * Refreshes the Session from the stored Refresh Token.
 *
 * The one refresh path: restoring the Session on launch and answering a 401
 * both come through here, so they agree on what a failure means. Only a
 * refresh the server rejected ends the Session — the stored Refresh Token is
 * cleared and the callback is told `null`. One that could not be completed
 * leaves the Refresh Token and the Session as they were (see
 * `REFRESH_FAILURE_ENDS_SESSION`).
 */
export const refreshSession: () => Promise<RefreshOutcome> =
  createSessionRefresher({
    readRefreshToken: getRefreshToken,
    saveRefreshToken,
    clearRefreshToken,
    requestRefresh: async (refreshTokenBody) =>
      (await refreshApi.refreshToken({ refreshTokenBody })).data,
    onRefreshed: (tokens) => {
      accessToken = tokens.accessToken;
      tokenRefreshCallback?.(tokens);
    },
    onSessionEnded: () => {
      accessToken = null;
      tokenRefreshCallback?.(null);
    },
  });

installRefreshOn401(apiClient, refreshSession);

export function createAuthApi(): AuthenticationApi {
  const config = new Configuration({
    basePath: BASE_PATH,
    accessToken: () => accessToken || '',
  });
  return new AuthenticationApi(config, BASE_PATH, apiClient);
}
