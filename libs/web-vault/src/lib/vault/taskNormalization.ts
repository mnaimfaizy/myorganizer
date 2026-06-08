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

const VALID_STATUSES = new Set<string>([
  'pending',
  'in_progress',
  'done',
  'cancelled',
  'blocked',
]);

const VALID_PRIORITIES = new Set<string>(['low', 'medium', 'high']);

const VALID_CONTEXTS = new Set<string>(['personal', 'work']);

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function isIso8601(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return !isNaN(new Date(value).getTime());
}

export function normalizeTasks(value: unknown): NormalizeResult<Task[]> {
  if (value === null) return { value: [], changed: false };
  if (!Array.isArray(value)) return { value: [], changed: true };

  let changed = false;
  const normalized: Task[] = [];
  const migrationTimestamp = new Date().toISOString();

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      changed = true;
      continue;
    }

    const raw = item as Record<string, unknown>;

    // Legacy { id, todo } migration
    if (typeof raw['todo'] === 'string' && (raw['todo'] as string).trim()) {
      const id = toTrimmedString(raw['id']) ?? randomId();
      const task: Task = {
        id,
        title: (raw['todo'] as string).trim(),
        status: 'pending',
        priority: 'medium',
        context: 'personal',
        archived: false,
        createdAt: migrationTimestamp,
        updatedAt: migrationTimestamp,
      };
      normalized.push(task);
      changed = true;
      continue;
    }

    // id: generate when missing
    const id = toTrimmedString(raw['id']) ?? randomId();

    // title: required — drop item if empty
    const title = toTrimmedString(raw['title']);
    if (!title) {
      changed = true;
      continue;
    }

    // status: default to pending when invalid/missing
    let status: Task['status'];
    if (VALID_STATUSES.has(raw['status'] as string)) {
      status = raw['status'] as Task['status'];
    } else {
      status = 'pending';
      changed = true;
    }

    // priority: default to medium when invalid/missing
    let priority: Task['priority'];
    if (VALID_PRIORITIES.has(raw['priority'] as string)) {
      priority = raw['priority'] as Task['priority'];
    } else {
      priority = 'medium';
      changed = true;
    }

    // archived: default to false when invalid/missing
    let archived: boolean;
    if (typeof raw['archived'] === 'boolean') {
      archived = raw['archived'];
    } else {
      archived = false;
      changed = true;
    }

    // createdAt: generate when missing/invalid
    let createdAt: string;
    if (isIso8601(raw['createdAt'])) {
      createdAt = raw['createdAt'] as string;
    } else {
      createdAt = migrationTimestamp;
      changed = true;
    }

    const task: Task = { id, title, status, priority, archived, createdAt };

    // context: optional — silently omit when absent or invalid (no change marker)
    if (
      raw['context'] !== undefined &&
      VALID_CONTEXTS.has(raw['context'] as string)
    ) {
      task.context = raw['context'] as Task['context'];
    }

    // updatedAt: optional — silently omit when absent or invalid (no change marker)
    if (raw['updatedAt'] !== undefined && isIso8601(raw['updatedAt'])) {
      task.updatedAt = raw['updatedAt'] as string;
    }

    // description: optional — silently omit/trim without marking changed
    if (raw['description'] !== undefined) {
      const description = toTrimmedString(raw['description']);
      if (description) task.description = description;
    }

    // dueDate: optional — silently omit when absent or invalid (no change marker)
    if (raw['dueDate'] !== undefined && isIso8601(raw['dueDate'])) {
      task.dueDate = raw['dueDate'] as string;
    }

    // estimatedMinutes: optional — only include when > 0, silently drop otherwise
    if (
      raw['estimatedMinutes'] !== undefined &&
      typeof raw['estimatedMinutes'] === 'number' &&
      raw['estimatedMinutes'] > 0
    ) {
      task.estimatedMinutes = raw['estimatedMinutes'];
    }

    if (task.id !== raw['id']) changed = true;
    if (task.title !== raw['title']) changed = true;

    normalized.push(task);
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
