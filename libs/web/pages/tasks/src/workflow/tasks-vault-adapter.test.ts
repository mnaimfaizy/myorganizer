import type { Task } from '@myorganizer/vault-core';
import { createProductionTasksVaultAdapter } from './tasks-vault-adapter';
import type { VaultHandle } from '@myorganizer/web-vault';

const FIXED_NOW = '2024-06-15T12:00:00.000Z';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    status: 'pending',
    priority: 'medium',
    archived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('createProductionTasksVaultAdapter', () => {
  let mockHandle: Partial<VaultHandle>;

  beforeEach(() => {
    mockHandle = {
      loadDecryptedData: jest.fn(),
      saveEncryptedData: jest.fn(),
    };
  });

  describe('loadTasks', () => {
    it('loads tasks from vault handle with correct type', async () => {
      const task = makeTask({ id: 'task-1' });
      (mockHandle.loadDecryptedData as jest.Mock).mockResolvedValue([task]);

      const adapter = createProductionTasksVaultAdapter(
        mockHandle as VaultHandle,
      );
      const result = await adapter.loadTasks();

      expect(mockHandle.loadDecryptedData).toHaveBeenCalledWith({
        type: 'tasks',
        defaultValue: null,
      });
      expect(result).toEqual([task]);
    });

    it('returns null when no data is stored', async () => {
      (mockHandle.loadDecryptedData as jest.Mock).mockResolvedValue(null);

      const adapter = createProductionTasksVaultAdapter(
        mockHandle as VaultHandle,
      );
      const result = await adapter.loadTasks();

      expect(result).toBeNull();
    });
  });

  describe('saveTasks', () => {
    it('saves tasks with preserved deletion log', async () => {
      const task = makeTask({ id: 'task-1' });
      const storedEnvelope = {
        records: [task],
        deletions: { removed: '2024-01-01T00:00:00.000Z' },
      };
      (mockHandle.loadDecryptedData as jest.Mock).mockResolvedValue(
        storedEnvelope,
      );
      (mockHandle.saveEncryptedData as jest.Mock).mockResolvedValue(undefined);

      const adapter = createProductionTasksVaultAdapter(
        mockHandle as VaultHandle,
      );
      const newTask = makeTask({ id: 'task-2', title: 'New task' });
      await adapter.saveTasks([newTask]);

      expect(mockHandle.saveEncryptedData).toHaveBeenCalledWith({
        type: 'tasks',
        value: {
          records: [newTask],
          deletions: { removed: '2024-01-01T00:00:00.000Z' },
        },
      });
    });
  });

  describe('deleteTask', () => {
    it('removes task and records deletion, preserving existing log', async () => {
      const keep = makeTask({ id: 'keep' });
      const remove = makeTask({ id: 'remove' });
      const storedEnvelope = {
        records: [keep, remove],
        deletions: { old: '2024-01-01T00:00:00.000Z' },
      };
      (mockHandle.loadDecryptedData as jest.Mock).mockResolvedValue(
        storedEnvelope,
      );
      (mockHandle.saveEncryptedData as jest.Mock).mockResolvedValue(undefined);

      const adapter = createProductionTasksVaultAdapter(
        mockHandle as VaultHandle,
      );
      const result = await adapter.deleteTask(
        [keep, remove],
        'remove',
        FIXED_NOW,
      );

      expect(result).toEqual([keep]);
      expect(mockHandle.saveEncryptedData).toHaveBeenCalledWith({
        type: 'tasks',
        value: {
          records: [keep],
          deletions: {
            old: '2024-01-01T00:00:00.000Z',
            remove: FIXED_NOW,
          },
        },
      });
    });

    it('creates new deletion log entry when none exists', async () => {
      const keep = makeTask({ id: 'keep' });
      const remove = makeTask({ id: 'remove' });
      const storedEnvelope = {
        records: [keep, remove],
        deletions: {},
      };
      (mockHandle.loadDecryptedData as jest.Mock).mockResolvedValue(
        storedEnvelope,
      );
      (mockHandle.saveEncryptedData as jest.Mock).mockResolvedValue(undefined);

      const adapter = createProductionTasksVaultAdapter(
        mockHandle as VaultHandle,
      );
      const result = await adapter.deleteTask(
        [keep, remove],
        'remove',
        FIXED_NOW,
      );

      expect(result).toEqual([keep]);
      expect(mockHandle.saveEncryptedData).toHaveBeenCalledWith({
        type: 'tasks',
        value: {
          records: [keep],
          deletions: {
            remove: FIXED_NOW,
          },
        },
      });
    });
  });
});
