/**
 * Tests for the Vault Blob convergence strategy table.
 *
 * The table is the pinned guard that prevents a seventh Vault Blob Type from
 * being added without deciding how it converges. Every entry must declare its
 * strategy: mergeById with a callable merge, or promptOnConflict with no merge.
 *
 * promptOnConflict is permanent, not temporary or deprecated. Groceries and
 * Todos merge poorly under record union, and no record-level merge strategy
 * will be written for them.
 */

import { VaultBlobType } from '@myorganizer/app-api-client';
import { type VaultBlobEnvelope } from '@myorganizer/core';

import {
  VAULT_BLOB_CONVERGE_STRATEGIES,
  VAULT_BLOB_TYPES,
} from './vaultBlobFields';

describe('VAULT_BLOB_CONVERGE_STRATEGIES', () => {
  test('should have exactly one entry per VaultBlobType when enumerating strategies', () => {
    const strategyKeys = Object.keys(
      VAULT_BLOB_CONVERGE_STRATEGIES,
    ) as VaultBlobType[];

    // Derive expected keys from VAULT_BLOB_TYPES (copy first to preserve stable order)
    const expectedKeys = [...VAULT_BLOB_TYPES].sort();
    expect(strategyKeys.sort()).toEqual(expectedKeys);
  });

  test('should assign mergeById strategy when type is Tasks, Addresses, MobileNumbers, or Subscriptions', () => {
    expect(VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.Tasks]).toEqual(
      expect.objectContaining({ strategy: 'mergeById' }),
    );
    expect(VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.Addresses]).toEqual(
      expect.objectContaining({ strategy: 'mergeById' }),
    );
    expect(VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.MobileNumbers]).toEqual(
      expect.objectContaining({ strategy: 'mergeById' }),
    );
    expect(VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.Subscriptions]).toEqual(
      expect.objectContaining({ strategy: 'mergeById' }),
    );
  });

  test('should assign promptOnConflict strategy when type is Groceries or Todos', () => {
    expect(VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.Groceries]).toEqual({
      strategy: 'promptOnConflict',
    });
    expect(VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.Todos]).toEqual({
      strategy: 'promptOnConflict',
    });
  });

  test('should carry a callable merge function when strategy is mergeById', () => {
    const mergeableTypes = [
      VaultBlobType.Tasks,
      VaultBlobType.Addresses,
      VaultBlobType.MobileNumbers,
      VaultBlobType.Subscriptions,
    ];

    for (const type of mergeableTypes) {
      const strategy = VAULT_BLOB_CONVERGE_STRATEGIES[type];
      expect(strategy).toHaveProperty('merge');
      if (strategy.strategy === 'mergeById') {
        expect(typeof strategy.merge).toBe('function');
      }
    }
  });

  test('should carry no merge function when strategy is promptOnConflict', () => {
    const promptTypes = [VaultBlobType.Groceries, VaultBlobType.Todos];

    for (const type of promptTypes) {
      const strategy = VAULT_BLOB_CONVERGE_STRATEGIES[type];
      expect(strategy).not.toHaveProperty('merge');
      expect(strategy.strategy).toBe('promptOnConflict');
    }
  });

  describe('mergeById converges by record', () => {
    test('should union by id and apply newer updatedAt winner selection when merging Tasks', () => {
      // #548 matrix row 12
      const local: VaultBlobEnvelope<unknown> = {
        records: [
          {
            id: 'task-1',
            title: 'Local only',
            status: 'todo',
            priority: 'high',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T10:00:00.000Z',
          },
          {
            id: 'task-2',
            title: 'Local version',
            status: 'done',
            priority: 'medium',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T11:00:00.000Z',
          },
        ],
        deletions: { 'task-3': '2026-01-01T12:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<unknown> = {
        records: [
          {
            id: 'task-2',
            title: 'Remote version',
            status: 'todo',
            priority: 'low',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T09:00:00.000Z',
          },
          {
            id: 'task-3',
            title: 'Remote only',
            status: 'todo',
            priority: 'high',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T08:00:00.000Z',
          },
        ],
        deletions: {},
      };

      const merge = VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.Tasks];
      if (merge.strategy !== 'mergeById')
        throw new Error('Expected mergeById strategy');

      const result = merge.merge(local, remote);
      const records = result.records as Array<{
        id: string;
        title: string;
        updatedAt: string;
      }>;

      expect(records).toContainEqual(
        expect.objectContaining({ id: 'task-1', title: 'Local only' }),
      );
      expect(records).toContainEqual(
        expect.objectContaining({ id: 'task-2', title: 'Local version' }),
      );
      expect(records).not.toContainEqual(
        expect.objectContaining({ id: 'task-3' }),
      );
      expect(result.deletions['task-3']).toBe('2026-01-01T12:00:00.000Z');
    });

    test('should fall back to createdAt when updatedAt is absent for Addresses', () => {
      // #548 matrix row 13: Addresses use contactChangedAt which reads updatedAt ?? createdAt
      // Discriminator: when only createdAt differs and neither has updatedAt, newer createdAt wins
      const local: VaultBlobEnvelope<unknown> = {
        records: [
          {
            id: 'addr-1',
            line1: 'Local St',
            city: 'Local City',
            postalCode: '00001',
            country: 'Country',
            createdAt: '2026-01-01T08:00:00.000Z',
            // No updatedAt
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<unknown> = {
        records: [
          {
            id: 'addr-1',
            line1: 'Remote St',
            city: 'Remote City',
            postalCode: '00001',
            country: 'Country',
            createdAt: '2026-01-01T10:00:00.000Z',
            // No updatedAt
          },
        ],
        deletions: {},
      };

      const merge = VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.Addresses];
      if (merge.strategy !== 'mergeById')
        throw new Error('Expected mergeById strategy');

      const result = merge.merge(local, remote);
      const records = result.records as Array<{ id: string; line1: string }>;
      // Remote's newer createdAt should win
      expect(records.find((r) => r.id === 'addr-1')).toEqual(
        expect.objectContaining({ line1: 'Remote St' }),
      );
    });

    test('should use createdAt as tiebreaker when updatedAt is absent for MobileNumbers', () => {
      // #548 matrix row 14: MobileNumbers also use contactChangedAt
      // Discriminator: when only createdAt differs and neither has updatedAt, newer createdAt wins
      const local: VaultBlobEnvelope<unknown> = {
        records: [
          {
            id: 'num-1',
            number: '+1111111111',
            createdAt: '2026-01-01T07:00:00.000Z',
            // No updatedAt
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<unknown> = {
        records: [
          {
            id: 'num-1',
            number: '+1999999999',
            createdAt: '2026-01-01T09:00:00.000Z',
            // No updatedAt
          },
        ],
        deletions: {},
      };

      const merge = VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.MobileNumbers];
      if (merge.strategy !== 'mergeById')
        throw new Error('Expected mergeById strategy');

      const result = merge.merge(local, remote);
      const records = result.records as Array<{ id: string; number: string }>;
      // Remote's newer createdAt should win
      expect(records.find((r) => r.id === 'num-1')).toEqual(
        expect.objectContaining({ number: '+1999999999' }),
      );
    });

    test('should keep local when createdAt differs but neither has updatedAt for Subscriptions', () => {
      // #548 matrix row 15: Subscriptions use ONLY updatedAt, never createdAt
      // Discriminator: createdAt does NOT act as a tiebreaker for subscriptions
      // When only createdAt differs and neither has updatedAt, both have undefined timestamp (tie)
      // and local is kept (the "keep local on tie" rule)
      const local: VaultBlobEnvelope<unknown> = {
        records: [
          {
            id: 'sub-1',
            name: 'Local Sub',
            createdAt: '2026-01-01T08:00:00.000Z',
            // No updatedAt
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<unknown> = {
        records: [
          {
            id: 'sub-1',
            name: 'Remote Sub',
            createdAt: '2026-01-01T10:00:00.000Z',
            // No updatedAt - so createdAt does NOT matter for subscriptions
          },
        ],
        deletions: {},
      };

      const merge = VAULT_BLOB_CONVERGE_STRATEGIES[VaultBlobType.Subscriptions];
      if (merge.strategy !== 'mergeById')
        throw new Error('Expected mergeById strategy');

      const result = merge.merge(local, remote);
      const records = result.records as Array<{ id: string; name: string }>;
      // Local should be kept because subscriptions ignore createdAt and both have undefined updatedAt
      expect(records.find((r) => r.id === 'sub-1')).toEqual(
        expect.objectContaining({ name: 'Local Sub' }),
      );
    });
  });
});
