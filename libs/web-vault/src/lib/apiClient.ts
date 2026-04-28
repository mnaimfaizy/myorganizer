import {
  Configuration,
  VaultApi,
  VaultBackupsApi,
  type ConfigurationParameters,
} from '@myorganizer/app-api-client';
import { getAccessToken } from '@myorganizer/auth';
import { getApiBaseUrl } from '@myorganizer/core';

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
  return new VaultApi(createApiConfiguration());
}

export function createVaultBackupsApi(): VaultBackupsApi {
  return new VaultBackupsApi(createApiConfiguration());
}
