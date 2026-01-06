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
  const fromWindow = readRuntimeApiBaseUrlFromWindow();
  const fromMeta = readRuntimeApiBaseUrlFromMeta();
  const fromEnv = process.env.API_BASE_URL;
  const fromPublicEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  const rawBaseUrl =
    fromWindow || fromMeta || fromEnv || fromPublicEnv || DEFAULT_API_BASE_URL;

  const wasExplicitlyConfigured = Boolean(
    fromWindow || fromMeta || fromEnv || fromPublicEnv
  );

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
  } catch (err) {
    const message =
      `Invalid API base URL value: ${rawBaseUrl}. ` +
      `Falling back to default: ${DEFAULT_API_BASE_URL}`;

    // If this is a server-side production render and a base URL was explicitly set,
    // fail fast so misconfiguration is obvious.
    if (
      process.env.NODE_ENV === 'production' &&
      typeof window === 'undefined' &&
      wasExplicitlyConfigured
    ) {
      throw new Error(message);
    }

    console.error(message);
    if (err) console.error(err);

    return DEFAULT_API_BASE_URL;
  }
}
