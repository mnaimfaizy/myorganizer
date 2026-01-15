import { isSupportedCurrencyCode, type CurrencyCode } from './currency';

const FX_CACHE_KEY = 'myorganizer_fx_rates_v1';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const DEFAULT_TIMEOUT_MS = 8000;

type FxCacheEntry = {
  base: CurrencyCode;
  fetchedAt: number;
  ttlMs: number;
  rates: Partial<Record<CurrencyCode, number>>;
};

type FxCacheV1 = {
  version: 1;
  entries: Record<string, FxCacheEntry>;
};

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

function loadCache(): FxCacheV1 {
  if (!isBrowser()) return { version: 1, entries: {} };

  const raw = window.localStorage.getItem(FX_CACHE_KEY);
  if (!raw) return { version: 1, entries: {} };

  try {
    const parsed = JSON.parse(raw) as FxCacheV1;
    if (
      parsed?.version !== 1 ||
      !parsed.entries ||
      typeof parsed.entries !== 'object'
    ) {
      return { version: 1, entries: {} };
    }
    return parsed;
  } catch {
    return { version: 1, entries: {} };
  }
}

function saveCache(cache: FxCacheV1): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify(cache));
}

function isFresh(entry: FxCacheEntry, now: number): boolean {
  return now - entry.fetchedAt < entry.ttlMs;
}

const inflight: Partial<Record<CurrencyCode, Promise<FxCacheEntry>>> = {};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`FX rates request failed (${response.status})`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFxRates(options: {
  base: CurrencyCode;
  ttlMs?: number;
  timeoutMs?: number;
  retryCount?: number;
}): Promise<FxCacheEntry> {
  const now = Date.now();
  const ttlMs =
    typeof options.ttlMs === 'number' ? options.ttlMs : DEFAULT_TTL_MS;
  const timeoutMs =
    typeof options.timeoutMs === 'number'
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;
  const retryCount =
    typeof options.retryCount === 'number' ? options.retryCount : 1;

  const cache = loadCache();
  const cached = cache.entries[options.base];
  if (cached && isFresh(cached, now)) return cached;

  const existing = inflight[options.base];
  if (existing) return existing;

  inflight[options.base] = (async () => {
    const url = `https://open.er-api.com/v6/latest/${options.base}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const data: unknown = await fetchJsonWithTimeout(url, timeoutMs);

        const ratesRaw =
          typeof data === 'object' && data !== null && 'rates' in data
            ? (data as { rates?: unknown }).rates
            : undefined;
        const rates: Partial<Record<CurrencyCode, number>> = {};

        if (ratesRaw && typeof ratesRaw === 'object') {
          for (const [code, rate] of Object.entries(ratesRaw)) {
            if (!isSupportedCurrencyCode(code)) continue;
            if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)
              continue;
            rates[code] = rate;
          }
        }

        const entry: FxCacheEntry = {
          base: options.base,
          fetchedAt: now,
          ttlMs,
          rates,
        };

        const nextCache = loadCache();
        nextCache.entries[options.base] = entry;
        saveCache(nextCache);

        return entry;
      } catch (e: unknown) {
        lastError = e;
        if (attempt < retryCount) {
          await sleep(250);
          continue;
        }
      }
    }

    if (cached) return cached;
    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to fetch FX rates');
  })();

  try {
    const current = inflight[options.base];
    if (!current) {
      throw new Error('FX request missing from inflight cache');
    }
    return await current;
  } finally {
    delete inflight[options.base];
  }
}

export function convertAmount(options: {
  amount: number;
  from: CurrencyCode;
  to: CurrencyCode;
  rates: FxCacheEntry;
}): number {
  if (options.from === options.to) return options.amount;

  if (options.rates.base !== options.from) {
    throw new Error('FX rates base does not match source currency');
  }

  const rate = options.rates.rates[options.to];
  if (!rate) {
    throw new Error(`No FX rate from ${options.from} to ${options.to}`);
  }

  return options.amount * rate;
}
