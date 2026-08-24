import type { Task } from '@myorganizer/core';
import type { VaultHandle } from '@myorganizer/web-vault';

export interface TasksVaultAdapter {
  loadTasks(): Promise<Task[] | null>;
  loadTodos(): Promise<unknown>;
  saveTasks(tasks: Task[]): Promise<void>;
}

export function createProductionTasksVaultAdapter(
  handle: VaultHandle,
): TasksVaultAdapter {
  return {
    async loadTasks() {
      return handle.loadDecryptedData<Task[] | null>({
        type: 'tasks',
        defaultValue: null,
      });
    },
    async loadTodos() {
      return handle.loadDecryptedData<unknown>({
        type: 'todos',
        defaultValue: [],
      });
    },
    async saveTasks(tasks) {
      await handle.saveEncryptedData({
        type: 'tasks',
        value: tasks,
      });
    },
  };
}

export class InMemoryTasksVaultAdapter implements TasksVaultAdapter {
  private tasks: Task[] | null = null;
  private todos: unknown = [];

  constructor(initial?: { tasks?: Task[] | null; todos?: unknown }) {
    if (initial?.tasks !== undefined) {
      this.tasks = initial.tasks;
    }
    if (initial?.todos !== undefined) {
      this.todos = initial.todos;
    }
  }

  async loadTasks(): Promise<Task[] | null> {
    return this.tasks;
  }

  async loadTodos(): Promise<unknown> {
    return this.todos;
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    this.tasks = tasks;
  }

  getSavedTasks(): Task[] | null {
    return this.tasks;
  }
}
