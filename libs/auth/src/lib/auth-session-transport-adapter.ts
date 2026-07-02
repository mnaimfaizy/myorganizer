import { AuthenticationApi, Configuration } from '@myorganizer/app-api-client';
import { getApiBaseUrl } from '@myorganizer/core';
import axios, { type AxiosError, type AxiosInstance } from 'axios';

import type { AuthSessionStorageAdapter } from './auth-session-storage-adapter';
import type { AuthSessionData } from './auth-session-types';
import {
  buildRefreshTokenRequest,
  shouldSendCredentials,
} from './refresh-client-contract';

export interface AuthSessionTransportAdapter {
  getAuthAxios(): AxiosInstance;
  getAuthApi(): AuthenticationApi;
}

function toSessionData(
  response: import('@myorganizer/app-api-client').Login200Response,
): AuthSessionData {
  return {
    token: response.token,
    expiresIn: response.expires_in,
    user: response.user,
  };
}

export function createAuthSessionTransportAdapter(
  storage: AuthSessionStorageAdapter,
): AuthSessionTransportAdapter {
  let sharedAxios: AxiosInstance | null = null;
  let refreshInFlight: Promise<AuthSessionData> | null = null;

  function isAuthUrl(url: string | undefined): boolean {
    if (!url) return false;
    return (
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/register') ||
      url.includes('/auth/verify/resend')
    );
  }

  async function refreshSession(): Promise<AuthSessionData> {
    const api = getAuthApi();
    const res = await api.refreshToken({
      refreshTokenRequest: buildRefreshTokenRequest('web'),
    });
    const session = toSessionData(res.data);
    storage.setAccessToken(session.token);
    storage.setCurrentUser(session.user);
    return session;
  }

  function getAuthAxios(): AxiosInstance {
    if (sharedAxios) return sharedAxios;

    const baseURL = getApiBaseUrl();
    const instance = axios.create({
      baseURL,
      withCredentials: shouldSendCredentials('web'),
    });

    instance.interceptors.response.use(
      (res) => res,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const originalRequest = error.config as
          | (typeof error.config & { _retry?: boolean })
          | null;

        if (!originalRequest || status !== 401) {
          return Promise.reject(error);
        }

        if (originalRequest._retry) {
          return Promise.reject(error);
        }

        if (isAuthUrl(originalRequest.url)) {
          return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
          if (!refreshInFlight) {
            refreshInFlight = refreshSession();
          }
          await refreshInFlight;
          refreshInFlight = null;
          return instance(originalRequest);
        } catch (refreshErr) {
          refreshInFlight = null;
          storage.clearSession();
          return Promise.reject(refreshErr);
        }
      },
    );

    sharedAxios = instance;
    return instance;
  }

  function getAuthApi(): AuthenticationApi {
    const configuration = new Configuration({
      basePath: getApiBaseUrl(),
      accessToken: () => storage.getAccessToken() ?? '',
    });

    return new AuthenticationApi(configuration, undefined, getAuthAxios());
  }

  return {
    getAuthAxios,
    getAuthApi,
  };
}
