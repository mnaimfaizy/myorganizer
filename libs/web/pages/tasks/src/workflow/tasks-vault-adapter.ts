import type { Task } from '@myorganizer/vault-core';
import type { VaultHandle } from '@myorganizer/web-vault';

export interface TasksVaultAdapter {
  loadTasks(): Promise<Task[] | null>;
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

  constructor(initial?: { tasks?: Task[] | null }) {
    if (initial?.tasks !== undefined) {
      this.tasks = initial.tasks;
    }
  }

  async loadTasks(): Promise<Task[] | null> {
    return this.tasks;
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    this.tasks = tasks;
  }

  getSavedTasks(): Task[] | null {
    return this.tasks;
  }
}
