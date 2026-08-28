import { mergeTasks } from './taskMerge';
import type { Task } from './task';
import type { VaultBlobEnvelope } from '../vault/vaultBlobEnvelope';

describe('mergeTasks', () => {
  describe('union by id', () => {
    it('keeps tasks only in local', () => {
      const local: VaultBlobEnvelope<Task[]> = {
        records: [
          {
            id: '1',
            title: 'Task 1',
            status: 'pending',
            priority: 'medium',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records).toEqual(local.records);
    });

    it('keeps tasks only in remote', () => {
      const local: VaultBlobEnvelope<Task[]> = {
        records: [],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [
          {
            id: '1',
            title: 'Remote Task',
            status: 'done',
            priority: 'high',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records).toEqual(remote.records);
    });

    it('keeps both tasks with different ids', () => {
      const local: VaultBlobEnvelope<Task[]> = {
        records: [
          {
            id: '1',
            title: 'Task 1',
            status: 'pending',
            priority: 'medium',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [
          {
            id: '2',
            title: 'Task 2',
            status: 'done',
            priority: 'high',
            archived: false,
            createdAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records).toHaveLength(2);
    });
  });

  describe('updatedAt takes precedence', () => {
    it('keeps remote when remote updatedAt is newer', () => {
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
      const local: VaultBlobEnvelope<Task[]> = {
        records: [localTask],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [remoteTask],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records[0]).toEqual(remoteTask);
    });

    it('keeps local when local updatedAt is newer', () => {
      const localTask: Task = {
        id: '1',
        title: 'Local',
        status: 'in_progress',
        priority: 'medium',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      };
      const remoteTask: Task = {
        id: '1',
        title: 'Remote',
        status: 'done',
        priority: 'high',
        archived: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const local: VaultBlobEnvelope<Task[]> = {
        records: [localTask],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [remoteTask],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records[0]).toEqual(localTask);
    });
  });

  describe('createdAt fallback when updatedAt is absent', () => {
    it('uses createdAt when updatedAt is absent on both', () => {
      const localTask: Task = {
        id: '1',
        title: 'Older',
        status: 'pending',
        priority: 'medium',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const remoteTask: Task = {
        id: '1',
        title: 'Newer',
        status: 'done',
        priority: 'high',
        archived: true,
        createdAt: '2026-01-02T00:00:00.000Z',
      };
      const local: VaultBlobEnvelope<Task[]> = {
        records: [localTask],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [remoteTask],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records[0]).toEqual(remoteTask);
    });

    it('uses updatedAt even if remote has newer createdAt but older updatedAt', () => {
      const localTask: Task = {
        id: '1',
        title: 'Local',
        status: 'pending',
        priority: 'medium',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      };
      const remoteTask: Task = {
        id: '1',
        title: 'Remote',
        status: 'done',
        priority: 'high',
        archived: true,
        createdAt: '2026-01-05T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      const local: VaultBlobEnvelope<Task[]> = {
        records: [localTask],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [remoteTask],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records[0]).toEqual(localTask);
    });
  });

  describe('deletion log precedence', () => {
    it('buries a task with no updatedAt that was deleted', () => {
      const local: VaultBlobEnvelope<Task[]> = {
        records: [
          {
            id: '1',
            title: 'Task 1',
            status: 'pending',
            priority: 'medium',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        deletions: { '1': '2026-01-02T00:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records).toEqual([]);
    });

    it('keeps a task with updatedAt that is after deletion', () => {
      const local: VaultBlobEnvelope<Task[]> = {
        records: [
          {
            id: '1',
            title: 'Task 1',
            status: 'pending',
            priority: 'medium',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-03T00:00:00.000Z',
          },
        ],
        deletions: { '1': '2026-01-02T00:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records).toEqual(local.records);
    });

    it('buries task when createdAt (fallback) equals deletion time', () => {
      const local: VaultBlobEnvelope<Task[]> = {
        records: [
          {
            id: '1',
            title: 'Task 1',
            status: 'pending',
            priority: 'medium',
            archived: false,
            createdAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        deletions: { '1': '2026-01-02T00:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [],
        deletions: {},
      };
      const result = mergeTasks(local, remote);
      expect(result.records).toEqual([]);
    });

    it('deletion works in both directions', () => {
      const local: VaultBlobEnvelope<Task[]> = {
        records: [
          {
            id: '1',
            title: 'Task 1',
            status: 'pending',
            priority: 'medium',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        deletions: {},
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [],
        deletions: { '1': '2026-01-02T00:00:00.000Z' },
      };
      const result = mergeTasks(local, remote);
      expect(result.records).toEqual([]);
    });
  });

  describe('deletion log in result', () => {
    it('includes deletions from both sides', () => {
      const local: VaultBlobEnvelope<Task[]> = {
        records: [],
        deletions: { a: '2026-01-01T00:00:00.000Z' },
      };
      const remote: VaultBlobEnvelope<Task[]> = {
        records: [],
        deletions: { b: '2026-01-02T00:00:00.000Z' },
      };
      const result = mergeTasks(local, remote);
      expect(result.deletions).toEqual({
        a: '2026-01-01T00:00:00.000Z',
        b: '2026-01-02T00:00:00.000Z',
      });
    });
  });

  describe('idempotence', () => {
    it('merging a blob with itself returns the same tasks and deletions', () => {
      const envelope: VaultBlobEnvelope<Task[]> = {
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
        deletions: { old: '2026-01-01T00:00:00.000Z' },
      };
      const result = mergeTasks(envelope, envelope);
      expect(result.records).toEqual(envelope.records);
      expect(result.deletions).toEqual(envelope.deletions);
    });
  });
});
