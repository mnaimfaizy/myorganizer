import { randomId, type Task } from '@myorganizer/core';

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

function isValidPriority(value: unknown): value is Task['priority'] {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isValidContext(value: unknown): value is Task['context'] {
  return value === 'personal' || value === 'work';
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

    const raw = item as Record<string, unknown>;

    const title = toTrimmedString(raw['title']);
    if (!title) {
      changed = true;
      continue;
    }

    const rawId = toTrimmedString(raw['id']);
    const id = rawId ?? randomId();
    const status = isValidTaskStatus(raw['status']) ? raw['status'] : 'pending';
    const archived =
      typeof raw['archived'] === 'boolean' ? raw['archived'] : false;
    const priority = isValidPriority(raw['priority'])
      ? raw['priority']
      : 'medium';
    const createdAt =
      typeof raw['createdAt'] === 'string' && raw['createdAt']
        ? raw['createdAt']
        : new Date().toISOString();

    const next: Task = { id, title, status, archived, priority, createdAt };

    if (typeof raw['description'] === 'string' && raw['description'].trim()) {
      next.description = raw['description'].trim();
    }
    if (isValidContext(raw['context'])) {
      next.context = raw['context'];
    }
    if (typeof raw['dueDate'] === 'string' && raw['dueDate']) {
      next.dueDate = raw['dueDate'];
    }
    if (
      typeof raw['estimatedMinutes'] === 'number' &&
      raw['estimatedMinutes'] > 0
    ) {
      next.estimatedMinutes = raw['estimatedMinutes'];
    }
    if (typeof raw['updatedAt'] === 'string' && raw['updatedAt']) {
      next.updatedAt = raw['updatedAt'];
    }

    if (rawId !== id) changed = true;
    if (raw['title'] !== title) changed = true;
    if (raw['status'] !== status) changed = true;
    if (raw['archived'] !== archived) changed = true;
    if (raw['priority'] !== priority) changed = true;
    if (!raw['createdAt']) changed = true;

    normalized.push(next);
  }

  return { value: normalized, changed };
}
