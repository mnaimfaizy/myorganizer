const DEFAULT_API_BASE_URL = 'http://localhost:3000';

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '');
}

function readRuntimeApiBaseUrlFromWindow(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const w = window as any;
  const cfg = w.__MYORGANIZER_RUNTIME__ ?? w.MYORGANIZER_RUNTIME;
  const value = cfg?.API_BASE_URL;

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return undefined;
}

function readRuntimeApiBaseUrlFromMeta(): string | undefined {
  if (typeof document === 'undefined') return undefined;

  const el = document.querySelector('meta[name="myorganizer-api-base-url"]');
  const value = el?.getAttribute('content') ?? '';

  if (value.trim().length > 0) {
    return value;
  }

  return undefined;
}

/**
 * Resolves the API base URL, preferring runtime configuration (browser), then env vars (server),
 * then a local default.
 */
export function getApiBaseUrl(): string {
  const rawBaseUrl =
    readRuntimeApiBaseUrlFromWindow() ||
    readRuntimeApiBaseUrlFromMeta() ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_API_BASE_URL;

  try {
    const parsed = new URL(rawBaseUrl);

    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      console.warn(
        'API_BASE_URL is not using HTTPS in production. ' +
          'This may expose sensitive data over an insecure connection:',
        rawBaseUrl
      );
    }

    return normalizeBaseUrl(parsed.toString());
  } catch {
    console.warn(
      'Invalid API base URL value. Falling back to default:',
      rawBaseUrl,
      '(default:',
      DEFAULT_API_BASE_URL + ')'
    );

    return DEFAULT_API_BASE_URL;
  }
}
