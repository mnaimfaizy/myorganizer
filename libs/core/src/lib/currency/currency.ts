export const SUPPORTED_CURRENCY_CODES = {
  AUD: 'AUD',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  NZD: 'NZD',
} as const;

export type CurrencyCode =
  (typeof SUPPORTED_CURRENCY_CODES)[keyof typeof SUPPORTED_CURRENCY_CODES];

export const SUPPORTED_CURRENCIES: Array<{ code: CurrencyCode; name: string }> =
  [
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'NZD', name: 'New Zealand Dollar' },
  ];

export function isSupportedCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === 'string' &&
    (Object.values(SUPPORTED_CURRENCY_CODES) as string[]).includes(value)
  );
}

export function formatMoney(options: {
  amount: number;
  currency: CurrencyCode;
  locale?: string;
}): string {
  return new Intl.NumberFormat(options.locale, {
    style: 'currency',
    currency: options.currency,
  }).format(options.amount);
}
