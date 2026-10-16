import {
  Configuration,
  UsersApi,
  type ConfigurationParameters,
} from '@myorganiser/app-api-client';
import { getAccessToken, getAuthAxios } from '@myorganiser/auth';
import { getApiBaseUrl } from '@myorganiser/core';

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
