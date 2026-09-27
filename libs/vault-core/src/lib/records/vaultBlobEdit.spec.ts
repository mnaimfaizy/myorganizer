import { putVaultRecord, deleteVaultRecord } from './vaultBlobEdit';
import { mergeTasks } from './taskMerge';
import type { Task } from './task';
import type { VaultBlobEnvelope } from './vaultBlobEnvelope';

describe('vaultBlobEdit', () => {
  describe('putVaultRecord', () => {
    it('replaces in place and carries deletions, leaving unparseable entries', () => {
      const originalRecords = [
        { id: '1', name: 'First' },
        { id: '2', name: 'Second' },
        null,
        { title: 'No id' },
      ];
      const envelope: VaultBlobEnvelope<unknown> = {
        records: originalRecords,
        deletions: { old: '2026-01-01T00:00:00.000Z' },
      };
      const updated = { id: '2', name: 'Updated' };

      const result = putVaultRecord(envelope, updated);

      const records = result.records as unknown[];
      expect(records[0]).toEqual({ id: '1', name: 'First' });
      expect(records[1]).toEqual(updated);
      expect(records[2]).toBe(null);
      expect(records[3]).toEqual({ title: 'No id' });
      expect(result.deletions).toEqual({ old: '2026-01-01T00:00:00.000Z' });
      expect(JSON.stringify(originalRecords)).toBe(
        JSON.stringify([
          { id: '1', name: 'First' },
          { id: '2', name: 'Second' },
          null,
          { title: 'No id' },
        ]),
      );
    });

    it('prepends when id not present', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: [{ id: '1', name: 'First' }],
        deletions: {},
      };
      const newRecord = { id: '2', name: 'New' };

      const result = putVaultRecord(envelope, newRecord);

      const records = result.records as Array<{ id: string; name: string }>;
      expect(records[0]).toEqual(newRecord);
      expect(records[1]).toEqual({ id: '1', name: 'First' });
    });

    it('throws TypeError when records is not an array', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: { catalog: [], lists: [] },
        deletions: {},
      };

      expect(() => putVaultRecord(envelope, { id: '1', name: 'Task' })).toThrow(
        'Only an array-shaped Vault Blob can be edited one record at a time',
      );
    });
  });

  describe('deleteVaultRecord', () => {
    it('removes id and merges deletion log, keeping newer instant', () => {
      const originalRecords = [
        { id: '1', name: 'To Delete' },
        null,
        { id: '2', name: 'To Keep' },
        { title: 'No id' },
      ];
      const originalDeletions = {
        old: '2026-01-01T00:00:00.000Z',
        '1': '2026-01-02T00:00:00.000Z',
      };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: originalRecords,
        deletions: originalDeletions,
      };

      const result = deleteVaultRecord(
        envelope,
        '1',
        '2026-01-04T00:00:00.000Z',
      );

      const records = result.records as unknown[];
      expect(records[0]).toBe(null);
      expect(records[1]).toEqual({ id: '2', name: 'To Keep' });
      expect(records[2]).toEqual({ title: 'No id' });
      expect(result.deletions).toEqual({
        old: '2026-01-01T00:00:00.000Z',
        '1': '2026-01-04T00:00:00.000Z',
      });
      expect(JSON.stringify(originalRecords)).toBe(
        JSON.stringify([
          { id: '1', name: 'To Delete' },
          null,
          { id: '2', name: 'To Keep' },
          { title: 'No id' },
        ]),
      );
      expect(JSON.stringify(originalDeletions)).toBe(
        JSON.stringify({
          old: '2026-01-01T00:00:00.000Z',
          '1': '2026-01-02T00:00:00.000Z',
        }),
      );
    });

    it.each<[string, string]>([
      ['newer deletion', '2026-01-04T00:00:00.000Z'],
      ['older deletion', '2026-01-01T00:00:00.000Z'],
    ])('keeps newer instant when id already in log (%s)', (_, deletedAt) => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: [{ id: '1', name: 'Task' }],
        deletions: { '1': '2026-01-02T00:00:00.000Z' },
      };

      const result = deleteVaultRecord(envelope, '1', deletedAt);

      const expected =
        deletedAt === '2026-01-04T00:00:00.000Z'
          ? '2026-01-04T00:00:00.000Z'
          : '2026-01-02T00:00:00.000Z';
      expect(result.deletions['1']).toBe(expected);
    });

    it('throws TypeError when records is not an array', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: { catalog: [], lists: [] },
        deletions: {},
      };

      expect(() =>
        deleteVaultRecord(envelope, '1', '2026-01-02T00:00:00.000Z'),
      ).toThrow(
        'Only an array-shaped Vault Blob can be edited one record at a time',
      );
    });
  });

  describe('round-trip with merge', () => {
    it('deleted record does not resurface when remote still has unchanged version', () => {
      // Local: delete a task
      const localTask: Task = {
        id: '1',
        title: 'Task 1',
        status: 'pending',
        priority: 'medium',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      let local: VaultBlobEnvelope<unknown> = {
        records: [localTask],
        deletions: {},
      };
      // Delete at 2026-01-03
      local = deleteVaultRecord(local, '1', '2026-01-03T00:00:00.000Z');

      // Remote: still has the original task unchanged
      const remote: VaultBlobEnvelope<unknown> = {
        records: [localTask],
        deletions: {},
      };

      // Merge: the deletion should bury the remote record
      const result = mergeTasks(
        local as VaultBlobEnvelope<Task[]>,
        remote as VaultBlobEnvelope<Task[]>,
      );

      expect(result.records as Task[]).toHaveLength(0);
    });

    it('remote copy survives merge if edited strictly after deletedAt', () => {
      // Local: delete a task at 2026-01-03
      const originalTask: Task = {
        id: '1',
        title: 'Task 1',
        status: 'pending',
        priority: 'medium',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      let local: VaultBlobEnvelope<unknown> = {
        records: [originalTask],
        deletions: {},
      };
      local = deleteVaultRecord(local, '1', '2026-01-03T00:00:00.000Z');

      // Remote: has a version edited after the deletion
      const remoteTask: Task = {
        ...originalTask,
        title: 'Task 1 Updated',
        updatedAt: '2026-01-04T00:00:00.000Z',
      };
      const remote: VaultBlobEnvelope<unknown> = {
        records: [remoteTask],
        deletions: {},
      };

      // Merge: the remote edit is newer, so it survives
      const result = mergeTasks(
        local as VaultBlobEnvelope<Task[]>,
        remote as VaultBlobEnvelope<Task[]>,
      );

      expect(result.records as Task[]).toHaveLength(1);
      expect((result.records as Task[])[0]).toEqual(remoteTask);
    });
  });
});
