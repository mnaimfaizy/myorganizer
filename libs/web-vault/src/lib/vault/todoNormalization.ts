import { randomId, type Todo } from '@myorganizer/core';

type NormalizeResult<T> = {
  value: T;
  changed: boolean;
};

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

export function normalizeTodos(value: unknown): NormalizeResult<Todo[]> {
  if (!Array.isArray(value)) return { value: [], changed: value != null };

  let changed = false;
  const normalized: Todo[] = [];

  for (const item of value) {
    if (typeof item === 'string') {
      const todo = item.trim();
      if (!todo) {
        changed = true;
        continue;
      }

      changed = true;
      normalized.push({ id: randomId(), todo });
      continue;
    }

    if (!item || typeof item !== 'object') {
      changed = true;
      continue;
    }

    const raw = item as any;

    const todo = toTrimmedString(raw.todo);
    if (!todo) {
      changed = true;
      continue;
    }

    const id = toTrimmedString(raw.id) ?? randomId();

    const next: Todo = { id, todo };

    if (next.id !== raw.id) changed = true;
    if (next.todo !== raw.todo) changed = true;

    normalized.push(next);
  }

  return { value: normalized, changed };
}
