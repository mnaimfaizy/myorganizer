import type { Task, TaskStatus } from './task';

/**
 * Whether a Task in this status is closed — done with, one way or the other.
 * Shared by `transitionTaskStatus` and by anything that groups Tasks into
 * open versus Done/Cancelled, so the two can never disagree about which
 * statuses count.
 */
export function isClosedTaskStatus(status: TaskStatus): boolean {
  return status === 'done' || status === 'cancelled';
}

/**
 * The one pure status transition a Task goes through — the single place that
 * decides `closedAt` (CONTEXT.md: an optional field for when the Task last
 * entered `done` or `cancelled`), so the web task workflow and every mobile
 * status change agree on it.
 *
 * - Entering `done` or `cancelled` from an open status sets `closedAt` to
 *   `now`.
 * - Staying closed — including moving between `done` and `cancelled` — keeps
 *   whatever `closedAt` the Task already carried, so an edit made while
 *   closed never bumps it.
 * - Reopening (moving to `pending`, `in_progress`, or `blocked`) clears it.
 *
 * `task` is the record as it stood *before* this transition — its `status`
 * is read as the previous status, not the next one. Every other field is
 * carried over unchanged; only `status`, `closedAt`, and `updatedAt` move.
 */
export function transitionTaskStatus(
  task: Task,
  status: TaskStatus,
  now: string,
): Task {
  const wasClosed = isClosedTaskStatus(task.status);
  const closing = isClosedTaskStatus(status);

  const next: Task = { ...task, status, updatedAt: now };
  delete next.closedAt;

  if (closing) {
    if (!wasClosed) next.closedAt = now;
    else if (task.closedAt !== undefined) next.closedAt = task.closedAt;
  }
  return next;
}
