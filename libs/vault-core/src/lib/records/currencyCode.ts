export const SUPPORTED_CURRENCY_CODES = {
  AUD: 'AUD',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  NZD: 'NZD',
} as const;

export type CurrencyCode =
  (typeof SUPPORTED_CURRENCY_CODES)[keyof typeof SUPPORTED_CURRENCY_CODES];

export function isSupportedCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === 'string' &&
    (Object.values(SUPPORTED_CURRENCY_CODES) as string[]).includes(value)
  );
}
