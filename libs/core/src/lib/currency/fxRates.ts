import { isSupportedCurrencyCode, type CurrencyCode } from './currency';

const FX_CACHE_KEY = 'myorganizer_fx_rates_v1';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

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

export async function getFxRates(options: {
  base: CurrencyCode;
  ttlMs?: number;
}): Promise<FxCacheEntry> {
  const now = Date.now();
  const ttlMs =
    typeof options.ttlMs === 'number' ? options.ttlMs : DEFAULT_TTL_MS;

  const cache = loadCache();
  const cached = cache.entries[options.base];
  if (cached && isFresh(cached, now)) return cached;

  const existing = inflight[options.base];
  if (existing) return existing;

  inflight[options.base] = (async () => {
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${options.base}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      throw new Error(`FX rates request failed (${response.status})`);
    }

    const data = (await response.json()) as any;

    const ratesRaw = data?.rates;
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
  })();

  try {
    return await inflight[options.base]!;
  } finally {
    inflight[options.base] = undefined;
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
