import {
  AuthenticationApi,
  Configuration,
  UsersApi,
} from '@myorganizer/app-api-client';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { MOBILE_ENVIRONMENT, readAppVersion } from '@myorganizer/mobile/core';
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
import {
  buildClientHeader,
  createVersionFloorStore,
  installVersionFloor,
} from './versionFloor';

// Debug builds reach the development machine and release builds reach
// Production; the environment module decides which.
const BASE_PATH = MOBILE_ENVIRONMENT.apiBasePath;

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

/**
 * Whether the backend has refused this build as below the Version Floor. The
 * app shows Update required once it is set (ADR 0114 decision 1).
 */
export const versionFloorRefusal = createVersionFloorStore();

// Every request names this build — the version the native bundle reports and
// the platform — so the backend can refuse one below the Version Floor.
const versionFloorWiring = {
  clientHeader: buildClientHeader(
    readAppVersion()?.version ?? null,
    Platform.OS,
  ),
  onRefused: () => versionFloorRefusal.report(),
};

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

// The refresh goes out on its own Axios instance, not `apiClient`: it carries
// no Access Token, and a 401 answering it must reach the classifier as a
// rejection rather than re-enter the refresh-on-401 interceptor below. It
// still names this build, and a 426 answering it is still a refusal.
const refreshClient = axios.create();
installVersionFloor(refreshClient, versionFloorWiring);
const refreshApi = new AuthenticationApi(
  new Configuration({ basePath: BASE_PATH }),
  BASE_PATH,
  refreshClient,
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

// A 426 never starts a refresh: the 401 interceptor passes it through.
installVersionFloor(apiClient, versionFloorWiring);
installRefreshOn401(apiClient, refreshSession);

/**
 * `/users/*` on `apiClient`, so a request carries the Access Token and rides
 * the 401 refresh and Version Floor interceptors.
 */
export function createUsersApi(): UsersApi {
  return new UsersApi(
    new Configuration({ basePath: BASE_PATH }),
    BASE_PATH,
    apiClient,
  );
}

export function createAuthApi(): AuthenticationApi {
  const config = new Configuration({
    basePath: BASE_PATH,
    accessToken: () => accessToken || '',
  });
  return new AuthenticationApi(config, BASE_PATH, apiClient);
}
