import {
  SUPPORTED_CURRENCY_CODES,
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRecord,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
  isSupportedCurrencyCode,
  type CurrencyCode,
  type SubscriptionBillingCycle,
  type SubscriptionPaymentMethod,
  type SubscriptionRenewalType,
  type SubscriptionStatus,
  type SubscriptionTier,
} from '@myorganizer/core';

type NormalizeResult<T> = {
  value: T;
  changed: boolean;
};

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function parseEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  fallback: T[keyof T]
): T[keyof T] {
  const input = toTrimmedString(value);
  if (!input) return fallback;

  const lower = input.toLowerCase();

  for (const option of Object.values(enumObject)) {
    if (option.toLowerCase() === lower) return option as T[keyof T];
  }

  for (const key of Object.keys(enumObject)) {
    if (key.toLowerCase() === lower) {
      return enumObject[key as keyof T] as T[keyof T];
    }
  }

  return fallback;
}

function parseCurrencyCode(value: unknown): CurrencyCode {
  return isSupportedCurrencyCode(value) ? value : SUPPORTED_CURRENCY_CODES.AUD;
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseIsoString(value: unknown): string | undefined {
  const v = toTrimmedString(value);
  return v && v.length > 0 ? v : undefined;
}

export function normalizeSubscriptions(
  value: unknown
): NormalizeResult<SubscriptionRecord[]> {
  if (!Array.isArray(value)) return { value: [], changed: value != null };

  let changed = false;
  const normalized: SubscriptionRecord[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      changed = true;
      continue;
    }

    const raw = item as any;

    const next: SubscriptionRecord = {
      id: toTrimmedString(raw.id) ?? randomId(),
      name: toTrimmedString(raw.name) ?? 'Subscription',
      startDate: toTrimmedString(raw.startDate) ?? isoNow(),
      endDate: parseIsoString(raw.endDate),
      status: parseEnumValue(
        SubscriptionStatusEnum,
        raw.status,
        SubscriptionStatusEnum.Active
      ) as SubscriptionStatus,
      billingCycle: parseEnumValue(
        SubscriptionBillingCycleEnum,
        raw.billingCycle,
        SubscriptionBillingCycleEnum.Monthly
      ) as SubscriptionBillingCycle,
      amount: parseNumber(raw.amount, 0),
      currency: parseCurrencyCode(raw.currency),
      paymentMethod: parseEnumValue(
        SubscriptionPaymentMethodEnum,
        raw.paymentMethod,
        SubscriptionPaymentMethodEnum.CreditCard
      ) as SubscriptionPaymentMethod,
      nextBillingDate: parseIsoString(raw.nextBillingDate),
      renewalType: parseEnumValue(
        SubscriptionRenewalTypeEnum,
        raw.renewalType,
        SubscriptionRenewalTypeEnum.AutoRenew
      ) as SubscriptionRenewalType,
      cancellationDate: parseIsoString(raw.cancellationDate),
      cancellationReason: toTrimmedString(raw.cancellationReason) ?? undefined,
      tier: parseEnumValue(
        SubscriptionTierEnum,
        raw.tier,
        SubscriptionTierEnum.Basic
      ) as SubscriptionTier,
      link: toTrimmedString(raw.link) ?? undefined,
    };

    if (next.id !== raw.id) changed = true;
    if (next.name !== raw.name) changed = true;
    if (next.startDate !== raw.startDate) changed = true;
    if (next.endDate !== raw.endDate) changed = true;
    if (next.status !== raw.status) changed = true;
    if (next.billingCycle !== raw.billingCycle) changed = true;
    if (next.amount !== raw.amount) changed = true;
    if (next.currency !== raw.currency) changed = true;
    if (next.paymentMethod !== raw.paymentMethod) changed = true;
    if (next.nextBillingDate !== raw.nextBillingDate) changed = true;
    if (next.renewalType !== raw.renewalType) changed = true;
    if (next.cancellationDate !== raw.cancellationDate) changed = true;
    if (next.cancellationReason !== raw.cancellationReason) changed = true;
    if (next.tier !== raw.tier) changed = true;
    if (next.link !== raw.link) changed = true;

    normalized.push(next);
  }

  return { value: normalized, changed };
}
