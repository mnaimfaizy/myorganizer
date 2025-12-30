import {
  Configuration,
  VaultApi,
  type ConfigurationParameters,
} from '@myorganizer/app-api-client';

function getApiBasePath(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

function getAccessToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem('myorganizer_access_token') || undefined;
}

export function createApiConfiguration(
  overrides: Partial<ConfigurationParameters> = {}
): Configuration {
  return new Configuration({
    basePath: getApiBasePath(),
    accessToken: () => getAccessToken(),
    ...overrides,
  });
}

export function createVaultApi(): VaultApi {
  return new VaultApi(createApiConfiguration());
}
