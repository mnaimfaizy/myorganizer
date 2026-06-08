import { randomId, type Task } from '@myorganizer/core';

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
  if (value == null) return { value: [], changed: false };
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

    // Required field: id
    const id = toTrimmedString(raw['id']) ?? randomId();

    // Required field: title
    const title = toTrimmedString(raw['title']);
    if (!title) {
      changed = true;
      continue;
    }

    // Required field: status
    if (!VALID_STATUSES.has(raw['status'] as string)) {
      changed = true;
      continue;
    }
    const status = raw['status'] as Task['status'];

    // Required field: priority
    if (!VALID_PRIORITIES.has(raw['priority'] as string)) {
      changed = true;
      continue;
    }
    const priority = raw['priority'] as Task['priority'];

    // Required field: context
    if (!VALID_CONTEXTS.has(raw['context'] as string)) {
      changed = true;
      continue;
    }
    const context = raw['context'] as Task['context'];

    // Required field: archived
    if (typeof raw['archived'] !== 'boolean') {
      changed = true;
      continue;
    }
    const archived = raw['archived'];

    // Required field: createdAt
    if (!isIso8601(raw['createdAt'])) {
      changed = true;
      continue;
    }
    const createdAt = raw['createdAt'] as string;

    // Required field: updatedAt
    if (!isIso8601(raw['updatedAt'])) {
      changed = true;
      continue;
    }
    const updatedAt = raw['updatedAt'] as string;

    const task: Task = {
      id,
      title,
      status,
      priority,
      context,
      archived,
      createdAt,
      updatedAt,
    };

    // Optional field: description
    if (raw['description'] !== undefined) {
      const description = toTrimmedString(raw['description']);
      if (description) task.description = description;
      if (task.description !== raw['description']) changed = true;
    }

    // Optional field: dueDate
    if (raw['dueDate'] !== undefined) {
      if (isIso8601(raw['dueDate'])) {
        task.dueDate = raw['dueDate'] as string;
      } else {
        changed = true;
      }
    }

    // Optional field: estimatedMinutes
    if (raw['estimatedMinutes'] !== undefined) {
      if (typeof raw['estimatedMinutes'] === 'number') {
        task.estimatedMinutes = raw['estimatedMinutes'];
      } else {
        changed = true;
      }
    }

    if (task.id !== raw['id']) changed = true;
    if (task.title !== raw['title']) changed = true;

    normalized.push(task);
  }

  return { value: normalized, changed };
}
