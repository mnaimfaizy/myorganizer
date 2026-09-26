import {
  VAULT_BLOB_CONVERGE_STRATEGIES,
  toVaultBlobEnvelope,
  type VaultBlobConvergeStrategy,
} from './vaultBlobConverge';
import type { Task } from './task';
import type { VaultBlobEnvelope } from './vaultBlobEnvelope';

// Type guard for mergeById strategies
function isMergeById(
  strategy: VaultBlobConvergeStrategy,
): strategy is Extract<VaultBlobConvergeStrategy, { strategy: 'mergeById' }> {
  return strategy.strategy === 'mergeById';
}

describe('vaultBlobConverge', () => {
  describe('VAULT_BLOB_CONVERGE_STRATEGIES table', () => {
    it.each<keyof typeof VAULT_BLOB_CONVERGE_STRATEGIES>([
      'addresses',
      'mobileNumbers',
      'subscriptions',
      'tasks',
    ])('%s uses mergeById with merge function', (key) => {
      const strategy = VAULT_BLOB_CONVERGE_STRATEGIES[key];
      expect(strategy.strategy).toBe('mergeById');
      if (isMergeById(strategy)) {
        expect(typeof strategy.merge).toBe('function');
      }
    });

    it('groceries uses promptOnConflict with no merge', () => {
      const strategy = VAULT_BLOB_CONVERGE_STRATEGIES.groceries;
      expect(strategy.strategy).toBe('promptOnConflict');
      expect('merge' in strategy).toBe(false);
    });
  });

  describe('tasks merge strategy via VAULT_BLOB_CONVERGE_STRATEGIES', () => {
    it('unions by id and newer updatedAt wins', () => {
      const localTask: Task = {
        id: '1',
        title: 'Local',
        status: 'pending',
        priority: 'medium',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const remoteTask: Task = {
        id: '1',
        title: 'Remote',
        status: 'done',
        priority: 'high',
        archived: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      };
      const local: VaultBlobEnvelope<unknown> = {
        records: [localTask],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<unknown> = {
        records: [remoteTask],
        deletions: {},
      };

      const strategy = VAULT_BLOB_CONVERGE_STRATEGIES.tasks;
      expect(strategy.strategy).toBe('mergeById');
      if (isMergeById(strategy)) {
        const result = strategy.merge(local, remote);
        expect((result.records as Task[])[0]).toEqual(remoteTask);
      }
    });

    it('deletion log entry at/after record change buries it', () => {
      const local: VaultBlobEnvelope<unknown> = {
        records: [
          {
            id: '1',
            title: 'Task 1',
            status: 'pending',
            priority: 'medium',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: { '1': '2026-01-02T00:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: {},
      };

      const strategy = VAULT_BLOB_CONVERGE_STRATEGIES.tasks;
      if (isMergeById(strategy)) {
        const result = strategy.merge(local, remote);
        expect(result.records as Task[]).toHaveLength(0);
      }
    });
  });

  describe('toVaultBlobEnvelope', () => {
    it('wraps a bare array with empty deletions', () => {
      const array = [{ id: '1', name: 'Task 1' }];
      const result = toVaultBlobEnvelope(array);

      expect(result.records).toBe(array);
      expect(result.deletions).toEqual({});
    });

    it('returns an existing envelope untouched', () => {
      const envelope: VaultBlobEnvelope<Task[]> = {
        records: [
          {
            id: '1',
            title: 'Task',
            status: 'pending',
            priority: 'medium',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        deletions: { '2': '2026-01-02T00:00:00.000Z' },
      };
      const result = toVaultBlobEnvelope(envelope);

      expect(result.records).toBe(envelope.records);
      expect(result.deletions).toEqual(envelope.deletions);
    });

    it('sanitizes deletion log by dropping unparseable instants', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: {
          good: '2026-01-01T00:00:00.000Z',
          bad: 'not-a-date',
          alsoGood: '2026-01-02T00:00:00.000Z',
        },
      };
      const result = toVaultBlobEnvelope(envelope);

      expect(result.deletions).toEqual({
        good: '2026-01-01T00:00:00.000Z',
        alsoGood: '2026-01-02T00:00:00.000Z',
      });
    });

    it('handles groceries-style payload with catalog and lists', () => {
      const payload = {
        catalog: [{ id: 'item1', name: 'Milk' }],
        lists: [{ id: 'list1', name: 'Shopping' }],
      };
      const result = toVaultBlobEnvelope(payload);

      expect(result.records).toBe(payload);
      expect(result.deletions).toEqual({});
    });

    it('returns null records unchanged with empty deletions', () => {
      const result = toVaultBlobEnvelope(null);

      expect(result.records).toBe(null);
      expect(result.deletions).toEqual({});
    });
  });
});
