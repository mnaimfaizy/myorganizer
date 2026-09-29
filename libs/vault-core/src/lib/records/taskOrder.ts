import type { Task, TaskPriority } from './task';

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
} as const satisfies Record<TaskPriority, number>;

/** The three fields the shared Task order reads. Looser than `Task` on
 * purpose: mobile sorts a decrypted, defensively-parsed `Partial<Task>`. */
export interface TaskOrderFields {
  priority?: TaskPriority;
  dueDate?: string;
  createdAt?: string;
}

function timeOrFallback(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * The Task order shared by the web workflow's list and every mobile Tasks
 * group: priority (high, then medium, then low), then due date (earliest
 * first, undated last), then created (earliest first).
 *
 * One home for this order is what stops the web and mobile copies of it
 * drifting apart by copy-paste. Fields missing or unparseable — which cannot
 * happen on web's fully-normalized `Task[]`, but can on mobile's decrypted
 * payload — fall back to `medium` priority, "no due date," and the oldest
 * `createdAt` respectively, rather than throwing.
 */
export function compareTasksByPriorityDueDateCreated(
  a: TaskOrderFields,
  b: TaskOrderFields,
): number {
  const priorityDelta =
    PRIORITY_ORDER[a.priority ?? 'medium'] -
    PRIORITY_ORDER[b.priority ?? 'medium'];
  if (priorityDelta !== 0) return priorityDelta;

  const dueDelta =
    timeOrFallback(a.dueDate, Infinity) - timeOrFallback(b.dueDate, Infinity);
  if (dueDelta !== 0) return dueDelta;

  return timeOrFallback(a.createdAt, 0) - timeOrFallback(b.createdAt, 0);
}

/** `Task[]` sorted by `compareTasksByPriorityDueDateCreated`. */
export function sortTasksByPriorityDueDateCreated(
  tasks: readonly Task[],
): Task[] {
  return [...tasks].sort(compareTasksByPriorityDueDateCreated);
}
