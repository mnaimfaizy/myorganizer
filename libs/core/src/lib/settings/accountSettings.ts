import {
  isSupportedCurrencyCode,
  SUPPORTED_CURRENCY_CODES,
  type CurrencyCode,
} from '../currency/currency';

export type AccountSettings = {
  countryCode: string;
  preferredCurrency: CurrencyCode;
};

const ACCOUNT_SETTINGS_STORAGE_KEY = 'myorganizer_account_settings_v1';

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

export function getAccountSettings(): AccountSettings {
  const defaults: AccountSettings = {
    countryCode: 'AU',
    preferredCurrency: SUPPORTED_CURRENCY_CODES.AUD,
  };

  if (!isBrowser()) return defaults;

  const raw = window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY);
  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<AccountSettings>;
    const countryCode =
      typeof parsed.countryCode === 'string' && parsed.countryCode.length > 0
        ? parsed.countryCode
        : defaults.countryCode;

    const preferredCurrency = isSupportedCurrencyCode(parsed.preferredCurrency)
      ? parsed.preferredCurrency
      : defaults.preferredCurrency;

    return { countryCode, preferredCurrency };
  } catch {
    return defaults;
  }
}

export function setAccountSettings(next: AccountSettings): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    ACCOUNT_SETTINGS_STORAGE_KEY,
    JSON.stringify(next)
  );
}

export function subscribeAccountSettings(callback: () => void): () => void {
  if (!isBrowser()) return () => undefined;

  const handler = (e: StorageEvent) => {
    if (e.key === ACCOUNT_SETTINGS_STORAGE_KEY) callback();
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
