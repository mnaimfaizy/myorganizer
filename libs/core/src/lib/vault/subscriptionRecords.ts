import type { CurrencyCode } from '../currency/currency';
import type { IsoDateTimeString } from './contactRecords';

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
};
