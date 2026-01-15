import {
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
} from '@myorganizer/core';
import { format, isValid, parseISO } from 'date-fns';

function titleCase(input: string) {
  return input.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fallbackLabel(raw: string) {
  const spaced = raw
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .trim();

  return titleCase(spaced);
}

const statusLabels: Record<string, string> = {
  [SubscriptionStatusEnum.Active]: 'Active',
  [SubscriptionStatusEnum.Inactive]: 'Inactive',
  [SubscriptionStatusEnum.Cancelled]: 'Cancelled',
  [SubscriptionStatusEnum.Expired]: 'Expired',
  [SubscriptionStatusEnum.Pending]: 'Pending',
};

const billingCycleLabels: Record<string, string> = {
  [SubscriptionBillingCycleEnum.Weekly]: 'Weekly',
  [SubscriptionBillingCycleEnum.Fortnightly]: 'Fortnightly',
  [SubscriptionBillingCycleEnum.Monthly]: 'Monthly',
  [SubscriptionBillingCycleEnum.Quarterly]: 'Quarterly',
  [SubscriptionBillingCycleEnum.Yearly]: 'Yearly',
  [SubscriptionBillingCycleEnum.TwoYears]: 'Every 2 years',
  [SubscriptionBillingCycleEnum.ThreeYears]: 'Every 3 years',
};

const paymentMethodLabels: Record<string, string> = {
  [SubscriptionPaymentMethodEnum.CreditCard]: 'Credit Card',
  [SubscriptionPaymentMethodEnum.PayPal]: 'PayPal',
  [SubscriptionPaymentMethodEnum.BankTransfer]: 'Bank Transfer',
};

const renewalTypeLabels: Record<string, string> = {
  [SubscriptionRenewalTypeEnum.AutoRenew]: 'Auto renew',
  [SubscriptionRenewalTypeEnum.Manual]: 'Manual',
};

const tierLabels: Record<string, string> = {
  [SubscriptionTierEnum.Free]: 'Free',
  [SubscriptionTierEnum.Basic]: 'Basic',
  [SubscriptionTierEnum.Pro]: 'Pro',
  [SubscriptionTierEnum.Enterprise]: 'Enterprise',
  [SubscriptionTierEnum.Individual]: 'Individual',
  [SubscriptionTierEnum.Family]: 'Family',
};

export function getSubscriptionStatusLabel(value: string) {
  return statusLabels[value] ?? fallbackLabel(value);
}

export function getSubscriptionBillingCycleLabel(value: string) {
  return billingCycleLabels[value] ?? fallbackLabel(value);
}

export function getSubscriptionPaymentMethodLabel(value: string) {
  return paymentMethodLabels[value] ?? fallbackLabel(value);
}

export function getSubscriptionRenewalTypeLabel(value: string) {
  return renewalTypeLabels[value] ?? fallbackLabel(value);
}

export function getSubscriptionTierLabel(value: string) {
  return tierLabels[value] ?? fallbackLabel(value);
}

export function formatIsoDateForDisplay(iso?: string) {
  if (!iso) return '—';
  const parsed = parseISO(iso);
  if (!isValid(parsed)) return '—';
  return format(parsed, 'PPP');
}
