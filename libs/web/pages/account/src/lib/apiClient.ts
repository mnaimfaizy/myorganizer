import {
  Configuration,
  UsersApi,
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

export function createUsersApi(): UsersApi {
  return new UsersApi(createApiConfiguration(), undefined, getAuthAxios());
}
