import {
  Configuration,
  VaultApi,
  type ConfigurationParameters,
} from '@myorganizer/app-api-client';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

function getApiBasePath(): string {
  const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!rawBaseUrl) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const parsed = new URL(rawBaseUrl);

    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      // eslint-disable-next-line no-console
      console.warn(
        'NEXT_PUBLIC_API_BASE_URL is not using HTTPS in production. ' +
          'This may expose sensitive data over an insecure connection:',
        rawBaseUrl
      );
    }

    // Normalize by stripping trailing slashes to avoid double-slash issues in requests.
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      'Invalid NEXT_PUBLIC_API_BASE_URL value. Falling back to default:',
      rawBaseUrl,
      '(default:',
      DEFAULT_API_BASE_URL + ')'
    );
    return DEFAULT_API_BASE_URL;
  }
}

function getAccessToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem('myorganizer_access_token') || undefined;
}

export function createApiConfiguration(
  overrides: Partial<ConfigurationParameters> = {}
): Configuration {
  const accessToken = getAccessToken();

  return new Configuration({
    basePath: getApiBasePath(),
    ...(accessToken ? { accessToken } : {}),
    ...overrides,
  });
}

export function createVaultApi(): VaultApi {
  return new VaultApi(createApiConfiguration());
}
