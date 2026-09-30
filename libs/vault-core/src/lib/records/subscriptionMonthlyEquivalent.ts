import type { CurrencyCode } from './currencyCode';
import {
  SubscriptionStatusEnum,
  type SubscriptionBillingCycle,
  type SubscriptionRecord,
} from './subscriptionRecords';

/**
 * Monthly Equivalent (CONTEXT.md): a Subscription's amount restated as what
 * it costs per month, whatever its billing cycle. Never converts money — it
 * normalises time only, so a weekly charge multiplies out across a year and
 * divides back to a month, and the longer cycles divide directly.
 *
 * Pinned to the billing cycle set (ADR 0053): the web dashboard card and
 * every mobile screen read the same seven factors from here, so a billing
 * cycle added to the enum and not here fails to compile instead of quietly
 * reading as `?? 1`.
 */
export const MONTHLY_EQUIVALENT_FACTORS = {
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  twoYears: 1 / 24,
  threeYears: 1 / 36,
} as const satisfies Record<SubscriptionBillingCycle, number>;

/** One Subscription's Monthly Equivalent, in its own currency. */
export function monthlyEquivalentAmount(
  subscription: SubscriptionRecord,
): number {
  return (
    subscription.amount * MONTHLY_EQUIVALENT_FACTORS[subscription.billingCycle]
  );
}

/**
 * The Monthly Equivalent summed per currency, over Active Subscriptions only
 * — Pending is excluded (CONTEXT.md), even on a screen that shows Pending
 * grouped under Active for everything else. Never sums two currencies
 * together: each entry is one currency's own total, in the order its first
 * Active Subscription appears in `subscriptions`.
 */
export function calculateMonthlyEquivalents(
  subscriptions: readonly SubscriptionRecord[],
): Array<{ currency: CurrencyCode; amount: number }> {
  const totals = new Map<CurrencyCode, number>();
  for (const subscription of subscriptions) {
    if (subscription.status !== SubscriptionStatusEnum.Active) continue;
    const amount = monthlyEquivalentAmount(subscription);
    totals.set(
      subscription.currency,
      (totals.get(subscription.currency) ?? 0) + amount,
    );
  }
  return Array.from(totals.entries()).map(([currency, amount]) => ({
    currency,
    amount,
  }));
}
