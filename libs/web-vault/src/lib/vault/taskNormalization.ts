import {
  randomId,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@myorganizer/core';

type NormalizeResult<T> = {
  value: T;
  changed: boolean;
};

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function isValidTaskStatus(value: unknown): value is Task['status'] {
  return (
    value === 'pending' ||
    value === 'in_progress' ||
    value === 'done' ||
    value === 'cancelled' ||
    value === 'blocked'
  );
}

export function normalizeTasks(value: unknown): NormalizeResult<Task[]> {
  if (!Array.isArray(value)) return { value: [], changed: value != null };

  let changed = false;
  const normalized: Task[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      changed = true;
      continue;
    }

    const raw = item as any;

    const title = toTrimmedString(raw.title);
    if (!title) {
      changed = true;
      continue;
    }

    const id = toTrimmedString(raw.id) ?? randomId();
    const status = isValidTaskStatus(raw.status) ? raw.status : 'pending';
    const archived = typeof raw.archived === 'boolean' ? raw.archived : false;

    const next: Task = { id, title, status, archived };

    if (next.id !== raw.id) changed = true;
    if (next.title !== raw.title) changed = true;
    if (next.status !== raw.status) changed = true;
    if (next.archived !== raw.archived) changed = true;

    normalized.push(next);
  }

  return { value: normalized, changed };
}

export function migrateFromTodos(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];

  const now = new Date().toISOString();
  const tasks: Task[] = [];

  for (const item of raw) {
    if (typeof item === 'string') {
      const title = item.trim();
      if (!title) continue;
      tasks.push({
        id: randomId(),
        title,
        status: 'pending' as TaskStatus,
        priority: 'medium' as TaskPriority,
        archived: false,
        createdAt: now,
      });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const title =
      typeof entry['todo'] === 'string'
        ? (entry['todo'] as string).trim()
        : null;
    if (!title) continue;
    const id =
      typeof entry['id'] === 'string' && (entry['id'] as string).trim()
        ? (entry['id'] as string).trim()
        : randomId();
    tasks.push({
      id,
      title,
      status: 'pending' as TaskStatus,
      priority: 'medium' as TaskPriority,
      archived: false,
      createdAt: now,
    });
  }

  return tasks;
}
