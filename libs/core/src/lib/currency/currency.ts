import type { CurrencyCode } from '@myorganizer/vault-core/portable';

export const SUPPORTED_CURRENCIES: Array<{ code: CurrencyCode; name: string }> =
  [
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'NZD', name: 'New Zealand Dollar' },
  ];

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
