import type { Task } from '@myorganiser/vault-core';
import { sortTasksByPriorityDueDateCreated } from '@myorganiser/vault-core';

/** Priority, then due date, then created — the order vault-core's
 * `sortTasksByPriorityDueDateCreated` shares with every mobile Tasks group. */
export function sortTasks(tasks: Task[]): Task[] {
  return sortTasksByPriorityDueDateCreated(tasks);
}
