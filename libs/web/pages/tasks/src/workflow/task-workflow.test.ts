/** Mocking rule: place jest.mock calls before any imports */
/* eslint-disable import/first -- jest.mock must precede application imports */

jest.mock('@myorganizer/core', () => ({
  ...jest.requireActual('@myorganizer/core'),
  randomId: jest.fn(),
}));

import type { Task, TaskPriority } from '@myorganizer/core';
import { randomId } from '@myorganizer/core';

import {
  addTaskToWorkflow,
  archiveTaskInWorkflow,
  deleteTaskFromWorkflow,
  loadTasksFromVault,
  unarchiveTaskInWorkflow,
  updateTaskInWorkflow,
} from './task-workflow';
import { InMemoryTasksVaultAdapter } from './tasks-vault-adapter';

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

class ThrowOnLoadVaultAdapter extends InMemoryTasksVaultAdapter {
  async loadTasks(): Promise<Task[] | null> {
    throw new Error('decrypt failed');
  }
}

class ThrowOnSaveVaultAdapter extends InMemoryTasksVaultAdapter {
  async saveTasks(_tasks: Task[]): Promise<void> {
    throw new Error('disk full');
  }
}

describe('task-workflow', () => {
  let idCounter = 0;

  beforeEach(() => {
    idCounter = 0;
    (randomId as jest.Mock).mockReset();
    (randomId as jest.Mock).mockImplementation(
      () => `generated-id-${++idCounter}`,
    );
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadTasksFromVault', () => {
    it('returns empty tasks when adapter has no tasks or todos', async () => {
      const adapter = new InMemoryTasksVaultAdapter();

      const result = await loadTasksFromVault(adapter);

      expect(result).toEqual({ tasks: [], loadError: null });
      expect(adapter.getSavedTasks()).toBeNull();
    });

    it('returns sorted tasks when tasks are already stored', async () => {
      const unsorted = [
        makeTask({
          id: 'low',
          priority: 'low',
          createdAt: '2024-01-03T00:00:00.000Z',
        }),
        makeTask({
          id: 'high',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
      ];
      const adapter = new InMemoryTasksVaultAdapter({ tasks: unsorted });

      const result = await loadTasksFromVault(adapter);

      expect(result.loadError).toBeNull();
      expect(result.tasks.map((t) => t.id)).toEqual(['high', 'low']);
    });

    it('migrates legacy todos and persists migrated tasks', async () => {
      const adapter = new InMemoryTasksVaultAdapter({
        tasks: null,
        todos: [{ id: 'legacy-1', todo: 'Buy milk' }, 'Walk dog'],
      });

      const result = await loadTasksFromVault(adapter);

      expect(result.loadError).toBeNull();
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.map((t) => t.title).sort()).toEqual([
        'Buy milk',
        'Walk dog',
      ]);
      expect(result.tasks.find((t) => t.title === 'Buy milk')?.id).toBe(
        'legacy-1',
      );
      expect(result.tasks.find((t) => t.title === 'Walk dog')?.id).toBe(
        'generated-id-1',
      );
      expect(adapter.getSavedTasks()).toHaveLength(2);
    });

    it('normalizes invalid task fields and re-saves when changed', async () => {
      const adapter = new InMemoryTasksVaultAdapter({
        tasks: [
          {
            id: 'task-1',
            title: 'Bad priority',
            status: 'pending',
            priority: 'urgent' as TaskPriority,
            archived: false,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const result = await loadTasksFromVault(adapter);

      expect(result.loadError).toBeNull();
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].priority).toBe('medium');
      expect(adapter.getSavedTasks()?.[0].priority).toBe('medium');
    });

    it('returns load_failed when adapter throws on load', async () => {
      const adapter = new ThrowOnLoadVaultAdapter();

      const result = await loadTasksFromVault(adapter);

      expect(result).toEqual({
        tasks: [],
        loadError: {
          code: 'load_failed',
          message: 'Could not decrypt saved data.',
        },
      });
    });

    it('sorts by priority, due date, then createdAt', async () => {
      const tasks = [
        makeTask({
          id: 'low-no-due',
          priority: 'low',
          createdAt: '2024-01-03T00:00:00.000Z',
        }),
        makeTask({
          id: 'high-late',
          priority: 'high',
          dueDate: '2024-02-01T00:00:00.000Z',
          createdAt: '2024-01-02T00:00:00.000Z',
        }),
        makeTask({
          id: 'high-early',
          priority: 'high',
          dueDate: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
        makeTask({
          id: 'medium',
          priority: 'medium',
          dueDate: '2024-01-15T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
      ];
      const adapter = new InMemoryTasksVaultAdapter({ tasks });

      const result = await loadTasksFromVault(adapter);

      expect(result.tasks.map((t) => t.id)).toEqual([
        'high-early',
        'high-late',
        'medium',
        'low-no-due',
      ]);
    });
  });

  describe('addTaskToWorkflow', () => {
    it('prepends a new task, sorts, persists, and returns created result', async () => {
      const existing = makeTask({
        id: 'existing-1',
        priority: 'low',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [existing] });

      const { tasks, result } = await addTaskToWorkflow(adapter, [existing], {
        title: 'New task',
        priority: 'high',
        status: 'pending',
      });

      expect(result).toEqual({ ok: true, kind: 'created' });
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({
        id: 'generated-id-1',
        title: 'New task',
        priority: 'high',
        status: 'pending',
        archived: false,
        createdAt: FIXED_NOW,
      });
      expect(adapter.getSavedTasks()).toEqual(tasks);
    });

    it('returns save_failed but still returns updated tasks optimistically', async () => {
      const adapter = new ThrowOnSaveVaultAdapter();

      const { tasks, result } = await addTaskToWorkflow(adapter, [], {
        title: 'Unsaved task',
        priority: 'medium',
        status: 'pending',
      });

      expect(result).toEqual({
        ok: false,
        error: { code: 'save_failed', message: 'disk full' },
      });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Unsaved task');
      expect(adapter.getSavedTasks()).toBeNull();
    });
  });

  describe('updateTaskInWorkflow', () => {
    it('updates the matching task, sets updatedAt, persists, and returns updated result', async () => {
      const task = makeTask({ id: 'task-1', title: 'Original' });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [task] });

      const { tasks, result } = await updateTaskInWorkflow(
        adapter,
        [task],
        'task-1',
        {
          title: 'Updated title',
          priority: 'high',
          status: 'in_progress',
        },
      );

      expect(result).toEqual({ ok: true, kind: 'updated' });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        id: 'task-1',
        title: 'Updated title',
        priority: 'high',
        status: 'in_progress',
        updatedAt: FIXED_NOW,
      });
      expect(adapter.getSavedTasks()).toEqual(tasks);
    });

    it('returns save_failed but still returns updated tasks optimistically', async () => {
      const task = makeTask({ id: 'task-1', title: 'Original' });
      const adapter = new ThrowOnSaveVaultAdapter({ tasks: [task] });

      const { tasks, result } = await updateTaskInWorkflow(
        adapter,
        [task],
        'task-1',
        {
          title: 'Updated title',
          priority: 'high',
          status: 'in_progress',
        },
      );

      expect(result).toEqual({
        ok: false,
        error: { code: 'save_failed', message: 'disk full' },
      });
      expect(tasks[0].title).toBe('Updated title');
      expect(adapter.getSavedTasks()).toEqual([task]);
    });
  });

  describe('deleteTaskFromWorkflow', () => {
    it('removes the task, persists, and returns deleted result', async () => {
      const keep = makeTask({ id: 'keep', title: 'Keep me' });
      const remove = makeTask({ id: 'remove', title: 'Remove me' });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [keep, remove] });

      const { tasks, result } = await deleteTaskFromWorkflow(
        adapter,
        [keep, remove],
        'remove',
      );

      expect(result).toEqual({ ok: true, kind: 'deleted' });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('keep');
      expect(adapter.getSavedTasks()).toEqual(tasks);
    });
  });

  describe('archiveTaskInWorkflow', () => {
    it('marks the task archived, sets updatedAt, persists, and returns archived result', async () => {
      const task = makeTask({ id: 'task-1', archived: false });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [task] });

      const { tasks, result } = await archiveTaskInWorkflow(
        adapter,
        [task],
        'task-1',
      );

      expect(result).toEqual({ ok: true, kind: 'archived' });
      expect(tasks[0]).toMatchObject({
        id: 'task-1',
        archived: true,
        updatedAt: FIXED_NOW,
      });
      expect(adapter.getSavedTasks()).toEqual(tasks);
    });
  });

  describe('unarchiveTaskInWorkflow', () => {
    it('clears archived flag, sets updatedAt, persists, and returns unarchived result', async () => {
      const task = makeTask({ id: 'task-1', archived: true });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [task] });

      const { tasks, result } = await unarchiveTaskInWorkflow(
        adapter,
        [task],
        'task-1',
      );

      expect(result).toEqual({ ok: true, kind: 'unarchived' });
      expect(tasks[0]).toMatchObject({
        id: 'task-1',
        archived: false,
        updatedAt: FIXED_NOW,
      });
      expect(adapter.getSavedTasks()).toEqual(tasks);
    });
  });
});
