import {
  calculateMonthlyEquivalents,
  MONTHLY_EQUIVALENT_FACTORS,
  monthlyEquivalentAmount,
} from './subscriptionMonthlyEquivalent';
import {
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
  type SubscriptionRecord,
} from './subscriptionRecords';
import type { CurrencyCode } from './currencyCode';

/**
 * Build a minimal valid SubscriptionRecord for testing.
 * Caller can override any field by passing it in `overrides`.
 */
function buildSubscription(
  overrides: Partial<SubscriptionRecord> = {},
): SubscriptionRecord {
  return {
    id: '1',
    name: 'Test Subscription',
    startDate: '2026-01-01T00:00:00.000Z',
    status: SubscriptionStatusEnum.Active,
    billingCycle: SubscriptionBillingCycleEnum.Monthly,
    amount: 10,
    currency: 'USD' as CurrencyCode,
    paymentMethod: SubscriptionPaymentMethodEnum.CreditCard,
    renewalType: SubscriptionRenewalTypeEnum.AutoRenew,
    tier: SubscriptionTierEnum.Basic,
    ...overrides,
  };
}

describe('subscriptionMonthlyEquivalent', () => {
  describe('monthlyEquivalentAmount', () => {
    it('computes amount * factor for monthly billing cycle', () => {
      const subscription = buildSubscription({
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
      });
      const result = monthlyEquivalentAmount(subscription);
      expect(result).toBe(10 * MONTHLY_EQUIVALENT_FACTORS.monthly);
      expect(result).toBe(10);
    });

    it('applies weekly factor (52/12)', () => {
      const subscription = buildSubscription({
        amount: 12,
        billingCycle: SubscriptionBillingCycleEnum.Weekly,
      });
      const result = monthlyEquivalentAmount(subscription);
      expect(result).toBe(12 * (52 / 12));
      expect(result).toBe(52);
    });

    it('applies fortnightly factor (26/12)', () => {
      const subscription = buildSubscription({
        amount: 24,
        billingCycle: SubscriptionBillingCycleEnum.Fortnightly,
      });
      const result = monthlyEquivalentAmount(subscription);
      expect(result).toBe(24 * (26 / 12));
      expect(result).toBeCloseTo(52);
    });

    it('applies quarterly factor (1/3)', () => {
      const subscription = buildSubscription({
        amount: 30,
        billingCycle: SubscriptionBillingCycleEnum.Quarterly,
      });
      const result = monthlyEquivalentAmount(subscription);
      expect(result).toBe(30 * (1 / 3));
      expect(result).toBe(10);
    });

    it('applies yearly factor (1/12)', () => {
      const subscription = buildSubscription({
        amount: 120,
        billingCycle: SubscriptionBillingCycleEnum.Yearly,
      });
      const result = monthlyEquivalentAmount(subscription);
      expect(result).toBe(120 * (1 / 12));
      expect(result).toBe(10);
    });

    it('applies two-years factor (1/24)', () => {
      const subscription = buildSubscription({
        amount: 240,
        billingCycle: SubscriptionBillingCycleEnum.TwoYears,
      });
      const result = monthlyEquivalentAmount(subscription);
      expect(result).toBe(240 * (1 / 24));
      expect(result).toBe(10);
    });

    it('applies three-years factor (1/36)', () => {
      const subscription = buildSubscription({
        amount: 360,
        billingCycle: SubscriptionBillingCycleEnum.ThreeYears,
      });
      const result = monthlyEquivalentAmount(subscription);
      expect(result).toBe(360 * (1 / 36));
      expect(result).toBe(10);
    });
  });

  describe('calculateMonthlyEquivalents', () => {
    it('returns empty array for empty input', () => {
      const result = calculateMonthlyEquivalents([]);
      expect(result).toEqual([]);
    });

    it('includes Active subscriptions', () => {
      const subscription = buildSubscription({
        status: SubscriptionStatusEnum.Active,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
      });
      const result = calculateMonthlyEquivalents([subscription]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ currency: 'USD', amount: 10 });
    });

    it('excludes Pending subscriptions', () => {
      const subscription = buildSubscription({
        status: SubscriptionStatusEnum.Pending,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
      });
      const result = calculateMonthlyEquivalents([subscription]);
      expect(result).toEqual([]);
    });

    it('excludes Inactive subscriptions', () => {
      const subscription = buildSubscription({
        status: SubscriptionStatusEnum.Inactive,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
      });
      const result = calculateMonthlyEquivalents([subscription]);
      expect(result).toEqual([]);
    });

    it('excludes Cancelled subscriptions', () => {
      const subscription = buildSubscription({
        status: SubscriptionStatusEnum.Cancelled,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
      });
      const result = calculateMonthlyEquivalents([subscription]);
      expect(result).toEqual([]);
    });

    it('excludes Expired subscriptions', () => {
      const subscription = buildSubscription({
        status: SubscriptionStatusEnum.Expired,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
      });
      const result = calculateMonthlyEquivalents([subscription]);
      expect(result).toEqual([]);
    });

    it('sums two Active subscriptions in the same currency into one entry', () => {
      const sub1 = buildSubscription({
        id: '1',
        status: SubscriptionStatusEnum.Active,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'USD' as CurrencyCode,
      });
      const sub2 = buildSubscription({
        id: '2',
        status: SubscriptionStatusEnum.Active,
        amount: 20,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'USD' as CurrencyCode,
      });
      const result = calculateMonthlyEquivalents([sub1, sub2]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ currency: 'USD', amount: 30 });
    });

    it('keeps separate entries for Active subscriptions in different currencies', () => {
      const subUSD = buildSubscription({
        id: '1',
        status: SubscriptionStatusEnum.Active,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'USD' as CurrencyCode,
      });
      const subEUR = buildSubscription({
        id: '2',
        status: SubscriptionStatusEnum.Active,
        amount: 15,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'EUR' as CurrencyCode,
      });
      const result = calculateMonthlyEquivalents([subUSD, subEUR]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ currency: 'USD', amount: 10 });
      expect(result[1]).toEqual({ currency: 'EUR', amount: 15 });
    });

    it('preserves first-appearance order of currencies', () => {
      const subEUR = buildSubscription({
        id: '1',
        status: SubscriptionStatusEnum.Active,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'EUR' as CurrencyCode,
      });
      const subUSD = buildSubscription({
        id: '2',
        status: SubscriptionStatusEnum.Active,
        amount: 20,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'USD' as CurrencyCode,
      });
      const subEUR2 = buildSubscription({
        id: '3',
        status: SubscriptionStatusEnum.Active,
        amount: 5,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'EUR' as CurrencyCode,
      });
      const result = calculateMonthlyEquivalents([subEUR, subUSD, subEUR2]);
      expect(result).toHaveLength(2);
      // EUR appears first (from sub1), so it comes first in the result
      expect(result[0]).toEqual({ currency: 'EUR', amount: 15 });
      expect(result[1]).toEqual({ currency: 'USD', amount: 20 });
    });

    it('applies monthly equivalent factors when summing', () => {
      const subWeekly = buildSubscription({
        id: '1',
        status: SubscriptionStatusEnum.Active,
        amount: 12,
        billingCycle: SubscriptionBillingCycleEnum.Weekly,
        currency: 'USD' as CurrencyCode,
      });
      const subMonthly = buildSubscription({
        id: '2',
        status: SubscriptionStatusEnum.Active,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'USD' as CurrencyCode,
      });
      const result = calculateMonthlyEquivalents([subWeekly, subMonthly]);
      // 12 * (52/12) = 52, 10 * 1 = 10, total = 62
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ currency: 'USD', amount: 62 });
    });

    it('excludes non-Active subscriptions while including Active ones in the same call', () => {
      const activeUSD = buildSubscription({
        id: '1',
        status: SubscriptionStatusEnum.Active,
        amount: 10,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'USD' as CurrencyCode,
      });
      const pendingUSD = buildSubscription({
        id: '2',
        status: SubscriptionStatusEnum.Pending,
        amount: 20,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        currency: 'USD' as CurrencyCode,
      });
      const result = calculateMonthlyEquivalents([activeUSD, pendingUSD]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ currency: 'USD', amount: 10 });
    });
  });
});
