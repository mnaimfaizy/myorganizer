import {
  randomId,
  type Task,
  type TaskPriority,
  type Todo,
} from '@myorganizer/core';

type NormalizeResult<T> = {
  value: T;
  changed: boolean;
};

const VALID_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function toValidPriority(value: unknown): TaskPriority {
  if (
    typeof value === 'string' &&
    (VALID_PRIORITIES as string[]).includes(value)
  ) {
    return value as TaskPriority;
  }
  return 'medium';
}

function toValidDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : value.trim();
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

    const id = toTrimmedString(raw['id']) ?? randomId();
    const priority = toValidPriority(raw['priority']);
    const dueDate = toValidDate(raw['dueDate']);
    const createdAt = toValidDate(raw['createdAt']) ?? new Date().toISOString();

    const next: Task = { id, title, priority, createdAt };
    if (dueDate !== undefined) next.dueDate = dueDate;

    if (id !== raw['id']) changed = true;
    if (title !== raw['title']) changed = true;
    if (priority !== raw['priority']) changed = true;

    normalized.push(next);
  }

  return { value: normalized, changed };
}

export function migrateFromTodos(todos: Todo[]): Task[] {
  const now = new Date().toISOString();
  return todos.map((todo) => ({
    id: todo.id,
    title: todo.todo,
    priority: 'medium' as TaskPriority,
    createdAt: now,
  }));
}
