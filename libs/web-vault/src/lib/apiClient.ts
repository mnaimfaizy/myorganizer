import {
  Configuration,
  VaultApi,
  type ConfigurationParameters,
} from '@myorganizer/app-api-client';
import { getApiBaseUrl } from '@myorganizer/core';

function getAccessToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem('myorganizer_access_token') || undefined;
}

export function createApiConfiguration(
  overrides: Partial<ConfigurationParameters> = {}
): Configuration {
  const accessToken = getAccessToken();

  return new Configuration({
    basePath: getApiBaseUrl(),
    ...(accessToken ? { accessToken } : {}),
    ...overrides,
  });
}

export function createVaultApi(): VaultApi {
  return new VaultApi(createApiConfiguration());
}
