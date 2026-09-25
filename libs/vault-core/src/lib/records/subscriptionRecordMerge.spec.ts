import { mergeSubscriptions } from './subscriptionRecordMerge';
import type { SubscriptionRecord } from './subscriptionRecords';
import type { VaultBlobEnvelope } from './vaultBlobEnvelope';

describe('subscriptionRecordMerge', () => {
  describe('union by id', () => {
    it('keeps subscriptions only in local', () => {
      const subscription: SubscriptionRecord = {
        id: '1',
        name: 'Netflix',
        startDate: '2026-01-01T00:00:00.000Z',
        status: 'active',
        billingCycle: 'monthly',
        amount: 15.99,
        currency: 'USD',
        paymentMethod: 'creditCard',
        renewalType: 'autoRenew',
        tier: 'pro',
      };
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [subscription],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records).toEqual([subscription]);
    });

    it('keeps subscriptions only in remote', () => {
      const subscription: SubscriptionRecord = {
        id: '1',
        name: 'Spotify',
        startDate: '2026-01-01T00:00:00.000Z',
        status: 'active',
        billingCycle: 'monthly',
        amount: 10.99,
        currency: 'USD',
        paymentMethod: 'creditCard',
        renewalType: 'autoRenew',
        tier: 'individual',
      };
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [subscription],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records).toEqual([subscription]);
    });

    it('keeps both subscriptions with different ids', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '2',
            name: 'Spotify',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 10.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'individual',
          },
        ],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records).toHaveLength(2);
    });
  });

  describe('updatedAt collision resolution', () => {
    it('keeps remote when remote updatedAt is newer', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix Premium',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 20.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'enterprise',
            updatedAt: '2026-01-03T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records[0].name).toBe('Netflix Premium');
      expect(result.records[0].amount).toBe(20.99);
    });

    it('keeps local when local updatedAt is newer', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix Premium',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 20.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'enterprise',
            updatedAt: '2026-01-03T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records[0].name).toBe('Netflix Premium');
      expect(result.records[0].amount).toBe(20.99);
    });
  });

  describe('startDate is NOT used as record timestamp', () => {
    it('keeps remote with newer updatedAt even if local has old startDate', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix Premium',
            startDate: '2030-01-01T00:00:00.000Z', // far in the future!
            status: 'active',
            billingCycle: 'monthly',
            amount: 20.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'enterprise',
            updatedAt: '2026-01-03T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records[0].name).toBe('Netflix Premium');
    });

    it('keeps local with newer updatedAt even if remote has far future startDate', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix Premium',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 20.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'enterprise',
            updatedAt: '2026-01-03T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2030-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records[0].name).toBe('Netflix Premium');
    });
  });

  describe('both missing updatedAt', () => {
    it('keeps local when both lack updatedAt', () => {
      const localSub: SubscriptionRecord = {
        id: '1',
        name: 'Netflix Local',
        startDate: '2026-01-01T00:00:00.000Z',
        status: 'active',
        billingCycle: 'monthly',
        amount: 15.99,
        currency: 'USD',
        paymentMethod: 'creditCard',
        renewalType: 'autoRenew',
        tier: 'pro',
      };
      const remoteSub: SubscriptionRecord = {
        id: '1',
        name: 'Netflix Remote',
        startDate: '2026-01-01T00:00:00.000Z',
        status: 'active',
        billingCycle: 'monthly',
        amount: 15.99,
        currency: 'USD',
        paymentMethod: 'creditCard',
        renewalType: 'autoRenew',
        tier: 'pro',
      };
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [localSub],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [remoteSub],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records[0]).toEqual(localSub);
    });
  });

  describe('deletion log precedence', () => {
    it('buries a subscription with updatedAt at deletion time', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: { '1': '2026-01-02T00:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records).toEqual([]);
    });

    it('keeps subscription when updatedAt is after deletion', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
            updatedAt: '2026-01-03T00:00:00.000Z',
          },
        ],
        deletions: { '1': '2026-01-02T00:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records).toEqual(local.records);
    });

    it('buries subscription with no updatedAt when deleted', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
          },
        ],
        deletions: { '1': '2026-01-02T00:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [],
        deletions: {},
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records).toEqual([]);
    });

    it('deletion works in both directions', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [],
        deletions: { '1': '2026-01-03T00:00:00.000Z' },
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.records).toEqual([]);
    });
  });

  describe('deletion log in result', () => {
    it('includes deletions from both sides', () => {
      const local: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [],
        deletions: { a: '2026-01-01T00:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [],
        deletions: { b: '2026-01-02T00:00:00.000Z' },
      };
      const result = mergeSubscriptions(local, remote);
      expect(result.deletions).toEqual({
        a: '2026-01-01T00:00:00.000Z',
        b: '2026-01-02T00:00:00.000Z',
      });
    });
  });

  describe('idempotence', () => {
    it('merging a blob with itself returns the same subscriptions and deletions', () => {
      const envelope: VaultBlobEnvelope<SubscriptionRecord[]> = {
        records: [
          {
            id: '1',
            name: 'Netflix',
            startDate: '2026-01-01T00:00:00.000Z',
            status: 'active',
            billingCycle: 'monthly',
            amount: 15.99,
            currency: 'USD',
            paymentMethod: 'creditCard',
            renewalType: 'autoRenew',
            tier: 'pro',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: { old: '2026-01-01T00:00:00.000Z' },
      };
      const result = mergeSubscriptions(envelope, envelope);
      expect(result.records).toEqual(envelope.records);
      expect(result.deletions).toEqual(envelope.deletions);
    });
  });
});
