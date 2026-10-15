import type { CurrencyCode } from './currencyCode';
import type { IsoDateTimeString } from './contactRecords';
import type { KnownKeys } from './unknownFields';

export const SubscriptionStatusEnum = {
  Active: 'active',
  Inactive: 'inactive',
  Cancelled: 'cancelled',
  Expired: 'expired',
  Pending: 'pending',
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatusEnum)[keyof typeof SubscriptionStatusEnum];

export const SubscriptionBillingCycleEnum = {
  Weekly: 'weekly',
  Fortnightly: 'fortnightly',
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  Yearly: 'yearly',
  TwoYears: 'twoYears',
  ThreeYears: 'threeYears',
} as const;

export type SubscriptionBillingCycle =
  (typeof SubscriptionBillingCycleEnum)[keyof typeof SubscriptionBillingCycleEnum];

export const SubscriptionPaymentMethodEnum = {
  CreditCard: 'creditCard',
  PayPal: 'paypal',
  BankTransfer: 'bankTransfer',
} as const;

export type SubscriptionPaymentMethod =
  (typeof SubscriptionPaymentMethodEnum)[keyof typeof SubscriptionPaymentMethodEnum];

export const SubscriptionRenewalTypeEnum = {
  AutoRenew: 'autoRenew',
  Manual: 'manual',
} as const;

export type SubscriptionRenewalType =
  (typeof SubscriptionRenewalTypeEnum)[keyof typeof SubscriptionRenewalTypeEnum];

export const SubscriptionTierEnum = {
  Free: 'free',
  Basic: 'basic',
  Pro: 'pro',
  Enterprise: 'enterprise',
  Individual: 'individual',
  Family: 'family',
} as const;

export type SubscriptionTier =
  (typeof SubscriptionTierEnum)[keyof typeof SubscriptionTierEnum];

export type SubscriptionRecord = {
  id: string;
  name: string;
  startDate: IsoDateTimeString;
  endDate?: IsoDateTimeString;
  status: SubscriptionStatus;
  billingCycle: SubscriptionBillingCycle;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: SubscriptionPaymentMethod;
  nextBillingDate?: IsoDateTimeString;
  renewalType: SubscriptionRenewalType;
  cancellationDate?: IsoDateTimeString;
  cancellationReason?: string;
  tier: SubscriptionTier;
  link?: string;
  /**
   * When this Subscription record last changed — what merging resolves a
   * collision by, and not a billing date. `startDate` is when the User's
   * subscription began, so merging never reads it as a record timestamp.
   *
   * Optional, and absent on every Subscription written before merging
   * existed. See `AddressRecord.updatedAt`.
   */
  updatedAt?: IsoDateTimeString;
};

/**
 * Every Subscription key a reader understands, pinned to the type: a field added to
 * `SubscriptionRecord` must be added here too. Keys not in this table are unknown fields,
 * which every writer carries through untouched (ADR 0114 decision 3).
 */
export const SUBSCRIPTION_KEYS = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  status: true,
  billingCycle: true,
  amount: true,
  currency: true,
  paymentMethod: true,
  nextBillingDate: true,
  renewalType: true,
  cancellationDate: true,
  cancellationReason: true,
  tier: true,
  link: true,
  updatedAt: true,
} as const satisfies KnownKeys<SubscriptionRecord>;
