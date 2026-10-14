import {
  putVaultRecord,
  transitionTaskStatus,
  type SubscriptionRecord,
  type VaultBlobEnvelope,
} from '@myorganizer/vault-core/portable';
import type { SubscriptionEditValues } from './SubscriptionEditSheet';
import type { DecryptedTask } from './taskModel';
import {
  storedTask,
  subscriptionEdit,
  usageLocationToggleEdit,
  type ToggleableContact,
} from './vaultRecordEdits';

const EARLIER = '2026-10-01T09:00:00.000Z';
const AT = '2026-10-15T09:00:00.000Z';

function envelope(
  records: unknown[],
  extra: Record<string, unknown> = {},
): VaultBlobEnvelope<unknown> {
  return { records, deletions: {}, ...extra } as VaultBlobEnvelope<unknown>;
}

function recordsOf(env: VaultBlobEnvelope<unknown>): Record<string, unknown>[] {
  return env.records as Record<string, unknown>[];
}

function byId(
  env: VaultBlobEnvelope<unknown>,
  id: string,
): Record<string, unknown> {
  const found = recordsOf(env).find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no record ${id} in envelope`);
  return found;
}

function locationsOf(
  contact: Record<string, unknown>,
): Record<string, unknown>[] {
  return contact.usageLocations as Record<string, unknown>[];
}

const screenTask: DecryptedTask = {
  id: 'task-1',
  title: 'Renew passport',
  status: 'pending',
  priority: 'medium',
  archived: false,
  createdAt: EARLIER,
  updatedAt: EARLIER,
};

function subscription(
  id: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    name: `Subscription ${id}`,
    startDate: '2025-01-01T00:00:00.000Z',
    status: 'active',
    billingCycle: 'monthly',
    amount: 10,
    currency: 'AUD',
    paymentMethod: 'creditCard',
    nextBillingDate: '2026-11-01T00:00:00.000Z',
    renewalType: 'autoRenew',
    tier: 'basic',
    updatedAt: EARLIER,
    ...extra,
  };
}

function location(
  id: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    organisationName: `Organisation ${id}`,
    organisationType: 'utility',
    updateMethod: 'online',
    changed: false,
    priority: 'high',
    createdAt: EARLIER,
    ...extra,
  };
}

function address(
  id: string,
  usageLocations: Record<string, unknown>[],
  extra: Record<string, unknown> = {},
): ToggleableContact {
  return {
    id,
    propertyNumber: '12',
    street: 'Wattlebird Lane',
    usageLocations,
    updatedAt: EARLIER,
    ...extra,
  };
}

describe('vaultRecordEdits', () => {
  describe('storedTask', () => {
    it('returns the envelope copy of the Task, with an unknown field the screen copy lacks', () => {
      const env = envelope([{ ...screenTask, futureField: 'other-device' }]);

      const result = storedTask(env, screenTask);

      expect(result.id).toBe('task-1');
      expect((result as unknown as Record<string, unknown>).futureField).toBe(
        'other-device',
      );
    });

    it('falls back to the screen Task when the envelope holds no Task with that id', () => {
      const env = envelope([]);

      expect(storedTask(env, screenTask)).toBe(screenTask);
    });
  });

  describe('Task edits as the screen composes them', () => {
    it('keeps the stored unknown field when a Task is marked done, and stamps closedAt', () => {
      const env = envelope([{ ...screenTask, futureField: 'kept' }]);

      const next = putVaultRecord(
        env,
        transitionTaskStatus(storedTask(env, screenTask), 'done', AT),
      );

      expect(byId(next, 'task-1')).toMatchObject({
        status: 'done',
        closedAt: AT,
        updatedAt: AT,
        futureField: 'kept',
      });
    });

    it('leaves a sibling Task and an unknown envelope key untouched', () => {
      const sibling = {
        id: 'task-2',
        title: 'Book dentist',
        status: 'pending',
        priority: 'low',
        archived: false,
        createdAt: EARLIER,
        futureField: 'sibling-kept',
      };
      const env = envelope([{ ...screenTask, futureField: 'kept' }, sibling], {
        futureEnvelopeKey: 'envelope-kept',
      });

      const next = putVaultRecord(
        env,
        transitionTaskStatus(storedTask(env, screenTask), 'done', AT),
      );

      expect(byId(next, 'task-2')).toEqual(sibling);
      expect(next).toMatchObject({ futureEnvelopeKey: 'envelope-kept' });
    });
  });

  describe('subscriptionEdit', () => {
    const fallback = subscription('sub-1') as unknown as SubscriptionRecord;

    it('applies status, amount, updatedAt, and sets the next billing date', () => {
      const env = envelope([subscription('sub-1')]);
      const values: SubscriptionEditValues = {
        status: 'inactive',
        amount: 12.5,
        nextBillingDate: '2026-12-01T00:00:00.000Z',
      };

      const next = subscriptionEdit(fallback, values, AT)(env);

      expect(byId(next, 'sub-1')).toMatchObject({
        status: 'inactive',
        amount: 12.5,
        nextBillingDate: '2026-12-01T00:00:00.000Z',
        updatedAt: AT,
      });
    });

    it('on cancellation, sets the cancellation date and reason and clears a missing next billing date', () => {
      const env = envelope([subscription('sub-1')]);
      const values: SubscriptionEditValues = {
        status: 'cancelled',
        amount: 10,
        cancellationDate: '2026-10-14T00:00:00.000Z',
        cancellationReason: 'Too expensive',
      };

      const sub = byId(subscriptionEdit(fallback, values, AT)(env), 'sub-1');

      expect(sub).toMatchObject({
        status: 'cancelled',
        cancellationDate: '2026-10-14T00:00:00.000Z',
        cancellationReason: 'Too expensive',
      });
      expect(sub).not.toHaveProperty('nextBillingDate');
    });

    it('drops a stored cancellation reason when the cancellation carries none', () => {
      const env = envelope([
        subscription('sub-1', { cancellationReason: 'Old reason' }),
      ]);
      const values: SubscriptionEditValues = {
        status: 'cancelled',
        amount: 10,
        cancellationDate: '2026-10-14T00:00:00.000Z',
      };

      const sub = byId(subscriptionEdit(fallback, values, AT)(env), 'sub-1');

      expect(sub).not.toHaveProperty('cancellationReason');
    });

    it('builds on the envelope copy, so an unknown field only the envelope holds survives', () => {
      const env = envelope([
        subscription('sub-1', { futureField: 'envelope-only' }),
      ]);
      const values: SubscriptionEditValues = {
        status: 'inactive',
        amount: 12.5,
      };

      const next = subscriptionEdit(fallback, values, AT)(env);

      expect(byId(next, 'sub-1')).toMatchObject({
        status: 'inactive',
        futureField: 'envelope-only',
      });
    });

    it('falls back to the screen copy, and adds it, when the envelope lacks the Subscription', () => {
      const screenCopy = subscription('sub-1', {
        futureField: 'from-screen',
      }) as unknown as SubscriptionRecord;
      const env = envelope([subscription('sub-2')]);
      const values: SubscriptionEditValues = { status: 'inactive', amount: 9 };

      const next = subscriptionEdit(screenCopy, values, AT)(env);

      expect(recordsOf(next)).toHaveLength(2);
      expect(byId(next, 'sub-1')).toMatchObject({
        status: 'inactive',
        amount: 9,
        futureField: 'from-screen',
      });
    });

    it('leaves a sibling Subscription and an unknown envelope key untouched', () => {
      const sibling = subscription('sub-2', { futureField: 'sibling-kept' });
      const env = envelope([subscription('sub-1'), sibling], {
        futureEnvelopeKey: 'envelope-kept',
      });
      const values: SubscriptionEditValues = { status: 'inactive', amount: 9 };

      const next = subscriptionEdit(fallback, values, AT)(env);

      expect(byId(next, 'sub-2')).toEqual(sibling);
      expect(next).toMatchObject({ futureEnvelopeKey: 'envelope-kept' });
    });
  });

  describe('usageLocationToggleEdit', () => {
    it('sets changed and changedAt on the target Usage Location only, then clears them when unticked', () => {
      const fallback = address('addr-1', [
        location('loc-1'),
        location('loc-2', { changed: true, changedAt: EARLIER }),
      ]);
      const env = envelope([fallback]);

      const ticked = byId(
        usageLocationToggleEdit(fallback, 'loc-1', true, AT)(env),
        'addr-1',
      );
      expect(ticked.updatedAt).toBe(AT);
      expect(locationsOf(ticked)).toEqual([
        location('loc-1', { changed: true, changedAt: AT }),
        location('loc-2', { changed: true, changedAt: EARLIER }),
      ]);

      const unticked = byId(
        usageLocationToggleEdit(
          fallback,
          'loc-2',
          false,
          AT,
        )(envelope([fallback])),
        'addr-1',
      );
      expect(locationsOf(unticked)[1]).toEqual(location('loc-2'));
    });

    it('keeps unknown fields on the target Address, its target Usage Location, a sibling Usage Location and a sibling Address', () => {
      const env = envelope([
        address(
          'addr-1',
          [
            location('loc-1', { futureField: 'loc-kept' }),
            location('loc-2', { futureField: 'sibling-loc-kept' }),
          ],
          { futureField: 'addr-kept' },
        ),
        address('addr-2', [location('loc-3')], {
          futureField: 'sibling-addr-kept',
        }),
      ]);
      const fallback = recordsOf(env)[0] as ToggleableContact;

      const next = usageLocationToggleEdit(fallback, 'loc-1', true, AT)(env);

      const target = byId(next, 'addr-1');
      expect(target.futureField).toBe('addr-kept');
      expect(locationsOf(target)[0]).toMatchObject({
        changed: true,
        futureField: 'loc-kept',
      });
      expect(locationsOf(target)[1]).toEqual(
        location('loc-2', { futureField: 'sibling-loc-kept' }),
      );
      expect(byId(next, 'addr-2')).toEqual(recordsOf(env)[1]);
    });

    it('builds on the envelope copy of the contact, so a field and a Usage Location only the envelope holds survive', () => {
      const fallback = address('addr-1', [location('loc-1')]);
      const env = envelope([
        address(
          'addr-1',
          [location('loc-1'), location('loc-2', { futureField: 'env-loc' })],
          {
            futureField: 'env-only',
          },
        ),
      ]);

      const target = byId(
        usageLocationToggleEdit(fallback, 'loc-1', true, AT)(env),
        'addr-1',
      );

      expect(target.futureField).toBe('env-only');
      expect(locationsOf(target)[1]).toEqual(
        location('loc-2', { futureField: 'env-loc' }),
      );
    });

    it('falls back to the screen copy of a Mobile Number, and adds it, when the envelope lacks it', () => {
      const fallback: ToggleableContact = {
        id: 'mob-1',
        countryCode: '+61',
        phoneNumber: '400000000',
        usageLocations: [location('loc-1')],
        futureField: 'from-screen',
      };
      const env = envelope([]);

      const next = usageLocationToggleEdit(fallback, 'loc-1', true, AT)(env);

      expect(recordsOf(next)).toHaveLength(1);
      expect(byId(next, 'mob-1')).toMatchObject({
        countryCode: '+61',
        phoneNumber: '400000000',
        futureField: 'from-screen',
        updatedAt: AT,
      });
      expect(locationsOf(byId(next, 'mob-1'))[0]).toMatchObject({
        changed: true,
        changedAt: AT,
      });
    });
  });
});
