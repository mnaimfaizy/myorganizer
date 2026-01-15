import {
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
} from '@myorganizer/core';

import { normalizeSubscriptions } from './subscriptionRecordNormalization';

describe('normalizeSubscriptions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return empty list for null/undefined without marking changed', () => {
    expect(normalizeSubscriptions(null)).toEqual({ value: [], changed: false });
    expect(normalizeSubscriptions(undefined)).toEqual({
      value: [],
      changed: false,
    });
  });

  it('should return empty list for non-array and mark changed when value is non-null', () => {
    expect(normalizeSubscriptions({})).toEqual({ value: [], changed: true });
    expect(normalizeSubscriptions('x')).toEqual({ value: [], changed: true });
    expect(normalizeSubscriptions(123)).toEqual({ value: [], changed: true });
  });

  it('should skip non-object items and mark changed', () => {
    const res = normalizeSubscriptions([null, 1, 'x', true]);
    expect(res.value).toEqual([]);
    expect(res.changed).toBe(true);
  });

  it('should normalize defaults for missing fields and mark changed', () => {
    const res = normalizeSubscriptions([{}]);
    expect(res.value).toHaveLength(1);
    expect(res.value[0]).toMatchObject({
      name: 'Subscription',
      startDate: '2026-01-01T00:00:00.000Z',
      status: SubscriptionStatusEnum.Active,
      billingCycle: SubscriptionBillingCycleEnum.Monthly,
      amount: 0,
      currency: 'AUD',
      paymentMethod: SubscriptionPaymentMethodEnum.CreditCard,
      renewalType: SubscriptionRenewalTypeEnum.AutoRenew,
      tier: SubscriptionTierEnum.Basic,
    });
    expect(typeof res.value[0].id).toBe('string');
    expect(res.changed).toBe(true);
  });

  it('should coerce amount strings and clean whitespace in string fields', () => {
    const res = normalizeSubscriptions([
      {
        id: '  abc  ',
        name: '  Netflix  ',
        amount: '12.5',
        currency: 'USD',
        startDate: '  2026-01-02T00:00:00.000Z  ',
        endDate: '   ',
        link: '  https://example.com  ',
      },
    ]);

    expect(res.value[0].id).toBe('abc');
    expect(res.value[0].name).toBe('Netflix');
    expect(res.value[0].amount).toBe(12.5);
    expect(res.value[0].currency).toBe('USD');
    expect(res.value[0].startDate).toBe('2026-01-02T00:00:00.000Z');
    expect(res.value[0].endDate).toBeUndefined();
    expect(res.value[0].link).toBe('https://example.com');
    expect(res.changed).toBe(true);
  });

  it('should accept exact normalized input without marking changed', () => {
    const input = [
      {
        id: 'sub-1',
        name: 'Spotify',
        startDate: '2026-01-03T00:00:00.000Z',
        endDate: undefined,
        status: SubscriptionStatusEnum.Active,
        billingCycle: SubscriptionBillingCycleEnum.Monthly,
        amount: 9.99,
        currency: 'AUD',
        paymentMethod: SubscriptionPaymentMethodEnum.CreditCard,
        nextBillingDate: undefined,
        renewalType: SubscriptionRenewalTypeEnum.AutoRenew,
        cancellationDate: undefined,
        cancellationReason: undefined,
        tier: SubscriptionTierEnum.Basic,
        link: undefined,
      },
    ];

    const res = normalizeSubscriptions(input);
    expect(res.changed).toBe(false);
    expect(res.value).toEqual(input);
  });
});
