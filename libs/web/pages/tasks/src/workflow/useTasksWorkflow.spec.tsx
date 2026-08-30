/**
 * Tests for useTasksWorkflow hook.
 *
 * Focus: integration with Local Vault Revision (#587).
 * Convergence replaces the Local Vault without passing through page effects,
 * so pages holding decrypted records see stale copies. The revision must
 * trigger re-reads, and mutations must save the full array including
 * converged records.
 */

/* eslint-disable import/first -- jest.mock must precede application imports */
jest.mock('@myorganizer/web-vault-ui', () => {
  const actual = jest.requireActual('@myorganizer/web-vault-ui');
  return {
    ...actual,
    useLocalVaultRevision: jest.fn(() => 0),
  };
});

jest.mock('@myorganizer/core', () => ({
  ...jest.requireActual('@myorganizer/core'),
  randomId: jest.fn(),
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import type { Task } from '@myorganizer/core';
import { randomId } from '@myorganizer/core';
import { useLocalVaultRevision } from '@myorganizer/web-vault-ui';

import { useTasksWorkflow } from './useTasksWorkflow';
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

describe('useTasksWorkflow — Local Vault Revision integration', () => {
  let idCounter = 0;

  beforeEach(() => {
    idCounter = 0;
    (randomId as jest.Mock).mockReset();
    (randomId as jest.Mock).mockImplementation(
      () => `generated-id-${++idCounter}`,
    );
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(FIXED_NOW);
    (useLocalVaultRevision as jest.Mock).mockReset();
    (useLocalVaultRevision as jest.Mock).mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('#587 regression: convergence must trigger re-read and preserve converged data', () => {
    it('loads initial task on mount', async () => {
      const initialTask = makeTask({ id: 'task-1', title: 'Initial task' });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [initialTask] });

      const { result } = renderHook(() =>
        useTasksWorkflow({ handle: null as any, adapter }),
      );

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Wait for load to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should expose the initial task
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]).toEqual(initialTask);
    });

    it('re-reads tasks when revision bumps (simulating convergence)', async () => {
      const initialTask = makeTask({ id: 'task-1', title: 'Initial task' });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [initialTask] });

      // Start with revision 0
      (useLocalVaultRevision as jest.Mock).mockReturnValue(0);

      const { result, rerender } = renderHook(() =>
        useTasksWorkflow({ handle: null as any, adapter }),
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].title).toBe('Initial task');

      // Simulate convergence: change adapter's stored tasks
      const convergedTask = makeTask({
        id: 'task-2',
        title: 'Task from server',
      });
      adapter['tasks'] = [initialTask, convergedTask];

      // Bump revision to trigger re-read
      (useLocalVaultRevision as jest.Mock).mockReturnValue(1);
      rerender();

      // Wait for re-read effect
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(2);
      });

      // Hook should now expose both tasks
      expect(result.current.tasks.map((t) => t.id).sort()).toEqual([
        'task-1',
        'task-2',
      ]);
    });

    it('mutation after convergence saves all tasks including converged ones', async () => {
      const initialTask = makeTask({ id: 'task-1', title: 'Initial task' });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [initialTask] });

      (useLocalVaultRevision as jest.Mock).mockReturnValue(0);

      const { result, rerender } = renderHook(() =>
        useTasksWorkflow({ handle: null as any, adapter }),
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tasks).toHaveLength(1);

      // Simulate convergence
      const convergedTask = makeTask({
        id: 'task-2',
        title: 'Task from server',
      });
      adapter['tasks'] = [initialTask, convergedTask];

      (useLocalVaultRevision as jest.Mock).mockReturnValue(1);
      rerender();

      // Wait for re-read
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(2);
      });

      // Now mutate the initial task via the hook
      await act(async () => {
        await result.current.updateTask('task-1', {
          title: 'Updated initial task',
        });
      });

      // The adapter should have saved all tasks, including the converged one
      const savedTasks = adapter.getSavedTasks();
      expect(savedTasks).toHaveLength(2);

      // Both tasks should be in the saved array
      const savedIds = savedTasks!.map((t) => t.id).sort();
      expect(savedIds).toEqual(['task-1', 'task-2']);

      // Initial task should be updated
      const updatedInitial = savedTasks!.find((t) => t.id === 'task-1');
      expect(updatedInitial?.title).toBe('Updated initial task');

      // Converged task should be preserved (not lost)
      const preserved = savedTasks!.find((t) => t.id === 'task-2');
      expect(preserved?.title).toBe('Task from server');
    });

    it('multiple revisions trigger multiple re-reads', async () => {
      const task1 = makeTask({ id: 'task-1', title: 'Task 1' });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [task1] });

      (useLocalVaultRevision as jest.Mock).mockReturnValue(0);

      const { result, rerender } = renderHook(() =>
        useTasksWorkflow({ handle: null as any, adapter }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tasks).toHaveLength(1);

      // First convergence
      const task2 = makeTask({ id: 'task-2', title: 'Task 2' });
      adapter['tasks'] = [task1, task2];

      (useLocalVaultRevision as jest.Mock).mockReturnValue(1);
      rerender();

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(2);
      });

      // Second convergence
      const task3 = makeTask({ id: 'task-3', title: 'Task 3' });
      adapter['tasks'] = [task1, task2, task3];

      (useLocalVaultRevision as jest.Mock).mockReturnValue(2);
      rerender();

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(3);
      });

      expect(result.current.tasks.map((t) => t.id)).toEqual([
        'task-1',
        'task-2',
        'task-3',
      ]);
    });

    it('deleteTask after convergence preserves undeleted converged tasks', async () => {
      const initialTask = makeTask({ id: 'task-1', title: 'Initial' });
      const adapter = new InMemoryTasksVaultAdapter({ tasks: [initialTask] });

      (useLocalVaultRevision as jest.Mock).mockReturnValue(0);

      const { result, rerender } = renderHook(() =>
        useTasksWorkflow({ handle: null as any, adapter }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate convergence: server added a task
      const convergedTask = makeTask({ id: 'task-2', title: 'From server' });
      adapter['tasks'] = [initialTask, convergedTask];

      (useLocalVaultRevision as jest.Mock).mockReturnValue(1);
      rerender();

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(2);
      });

      // Delete the initial task
      await act(async () => {
        await result.current.deleteTask('task-1');
      });

      // The converged task should still be saved
      const savedTasks = adapter.getSavedTasks();
      expect(savedTasks).toHaveLength(1);
      expect(savedTasks![0].id).toBe('task-2');
    });
  });
});
