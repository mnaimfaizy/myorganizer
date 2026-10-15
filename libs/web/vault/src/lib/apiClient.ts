import {
  Configuration,
  VaultApi,
  VaultBackupsApi,
  type ConfigurationParameters,
} from '@myorganiser/app-api-client';
import { getAccessToken, getAuthAxios } from '@myorganiser/auth';
import { getApiBaseUrl } from '@myorganiser/core';

export function createApiConfiguration(
  overrides: Partial<ConfigurationParameters> = {},
): Configuration {
  // Pass `accessToken` as a function so the latest value is read on each
  // request (covers token refresh and the localStorage/sessionStorage split
  // between "remember me" and "session-only" modes).
  return new Configuration({
    basePath: getApiBaseUrl(),
    accessToken: () => getAccessToken() ?? '',
    ...overrides,
  });
}

export function createVaultApi(): VaultApi {
  // Use getAuthAxios() so the 401→refresh interceptor handles expired tokens.
  return new VaultApi(createApiConfiguration(), undefined, getAuthAxios());
}

export function createVaultBackupsApi(): VaultBackupsApi {
  return new VaultBackupsApi(
    createApiConfiguration(),
    undefined,
    getAuthAxios(),
  );
}
