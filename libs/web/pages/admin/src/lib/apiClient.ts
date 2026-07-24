import {
  Configuration,
  PlatformAdminApi,
  type ConfigurationParameters,
} from '@myorganizer/app-api-client';
import { getAccessToken, getAuthAxios } from '@myorganizer/auth';
import { getApiBaseUrl } from '@myorganizer/core';

export function createApiConfiguration(
  overrides: Partial<ConfigurationParameters> = {},
): Configuration {
  return new Configuration({
    basePath: getApiBaseUrl(),
    accessToken: () => getAccessToken() ?? '',
    ...overrides,
  });
}

export function createPlatformAdminApi(): PlatformAdminApi {
  return new PlatformAdminApi(
    createApiConfiguration(),
    undefined,
    getAuthAxios(),
  );
}
