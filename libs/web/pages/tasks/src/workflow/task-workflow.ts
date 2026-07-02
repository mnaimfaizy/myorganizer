import type { Task } from '@myorganizer/core';
import { randomId } from '@myorganizer/core';
import { migrateFromTodos, normalizeTasks } from '@myorganizer/web-vault';

import { sortTasks } from './task-sorting';
import type {
  TaskFormInput,
  TaskUpdateInput,
  TaskWorkflowError,
  TaskWorkflowMutationResult,
} from './task-workflow-types';
import type { TasksVaultAdapter } from './tasks-vault-adapter';

function saveFailedError(message: string): TaskWorkflowError {
  return { code: 'save_failed', message };
}

function loadFailedError(): TaskWorkflowError {
  return {
    code: 'load_failed',
    message: 'Could not decrypt saved data.',
  };
}

export async function loadTasksFromVault(
  adapter: TasksVaultAdapter,
): Promise<{ tasks: Task[]; loadError: TaskWorkflowError | null }> {
  try {
    const raw = await adapter.loadTasks();

    if (raw === null) {
      const todos = await adapter.loadTodos();

      if (Array.isArray(todos) && todos.length > 0) {
        const migrated = migrateFromTodos(todos);
        await adapter.saveTasks(migrated);
        return { tasks: sortTasks(migrated), loadError: null };
      }

      return { tasks: [], loadError: null };
    }

    const normalized = normalizeTasks(raw);
    if (normalized.changed) {
      await adapter.saveTasks(normalized.value);
    }
    return { tasks: sortTasks(normalized.value), loadError: null };
  } catch {
    return { tasks: [], loadError: loadFailedError() };
  }
}

async function persistTasks(
  adapter: TasksVaultAdapter,
  next: Task[],
): Promise<{ tasks: Task[]; error: TaskWorkflowError | null }> {
  const sorted = sortTasks(next);
  try {
    await adapter.saveTasks(sorted);
    return { tasks: sorted, error: null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { tasks: sorted, error: saveFailedError(message) };
  }
}

export async function addTaskToWorkflow(
  adapter: TasksVaultAdapter,
  tasks: Task[],
  formData: TaskFormInput,
): Promise<{ tasks: Task[]; result: TaskWorkflowMutationResult }> {
  const newTask: Task = {
    id: randomId(),
    title: formData.title,
    description: formData.description,
    priority: formData.priority,
    status: formData.status,
    context: formData.context,
    dueDate: formData.dueDate,
    archived: false,
    createdAt: new Date().toISOString(),
  };

  const persisted = await persistTasks(adapter, [newTask, ...tasks]);
  if (persisted.error) {
    return {
      tasks: persisted.tasks,
      result: { ok: false, error: persisted.error },
    };
  }
  return { tasks: persisted.tasks, result: { ok: true, kind: 'created' } };
}

export async function updateTaskInWorkflow(
  adapter: TasksVaultAdapter,
  tasks: Task[],
  taskId: string,
  values: TaskUpdateInput,
): Promise<{ tasks: Task[]; result: TaskWorkflowMutationResult }> {
  const next = tasks.map((t) =>
    t.id === taskId
      ? {
          ...t,
          ...values,
          updatedAt: new Date().toISOString(),
        }
      : t,
  );

  const persisted = await persistTasks(adapter, next);
  if (persisted.error) {
    return {
      tasks: persisted.tasks,
      result: { ok: false, error: persisted.error },
    };
  }
  return { tasks: persisted.tasks, result: { ok: true, kind: 'updated' } };
}

export async function deleteTaskFromWorkflow(
  adapter: TasksVaultAdapter,
  tasks: Task[],
  taskId: string,
): Promise<{ tasks: Task[]; result: TaskWorkflowMutationResult }> {
  const next = tasks.filter((t) => t.id !== taskId);
  const persisted = await persistTasks(adapter, next);
  if (persisted.error) {
    return {
      tasks: persisted.tasks,
      result: { ok: false, error: persisted.error },
    };
  }
  return { tasks: persisted.tasks, result: { ok: true, kind: 'deleted' } };
}

export async function archiveTaskInWorkflow(
  adapter: TasksVaultAdapter,
  tasks: Task[],
  taskId: string,
): Promise<{ tasks: Task[]; result: TaskWorkflowMutationResult }> {
  const next = tasks.map((t) =>
    t.id === taskId
      ? { ...t, archived: true, updatedAt: new Date().toISOString() }
      : t,
  );

  const persisted = await persistTasks(adapter, next);
  if (persisted.error) {
    return {
      tasks: persisted.tasks,
      result: { ok: false, error: persisted.error },
    };
  }
  return { tasks: persisted.tasks, result: { ok: true, kind: 'archived' } };
}

export async function unarchiveTaskInWorkflow(
  adapter: TasksVaultAdapter,
  tasks: Task[],
  taskId: string,
): Promise<{ tasks: Task[]; result: TaskWorkflowMutationResult }> {
  const next = tasks.map((t) =>
    t.id === taskId
      ? { ...t, archived: false, updatedAt: new Date().toISOString() }
      : t,
  );

  const persisted = await persistTasks(adapter, next);
  if (persisted.error) {
    return {
      tasks: persisted.tasks,
      result: { ok: false, error: persisted.error },
    };
  }
  return { tasks: persisted.tasks, result: { ok: true, kind: 'unarchived' } };
}
