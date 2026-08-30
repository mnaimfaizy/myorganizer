import { mergeRecordsById } from '../vault/mergeVaultRecords';
import type { VaultBlobEnvelope } from '../vault/vaultBlobEnvelope';

import type { Task } from './task';

/**
 * When a Task last changed, for merge purposes.
 *
 * `updatedAt` is optional on `Task` and is absent on every Task written
 * before it existed, so `createdAt` — which is required — stands in. A Task
 * that has never been edited did last change when it was created.
 */
function taskChangedAt(task: Task): string | undefined {
  return task.updatedAt ?? task.createdAt;
}

/**
 * Converges two copies of the `tasks` Vault Blob.
 *
 * Pure: it reads the two envelopes it is given and nothing else. The rules
 * are `mergeRecordsById`'s — union by `id`, newer `updatedAt` wins a
 * collision, a deletion buries a Task that has not changed since.
 */
export function mergeTasks(
  local: VaultBlobEnvelope<Task[]>,
  remote: VaultBlobEnvelope<Task[]>,
): VaultBlobEnvelope<Task[]> {
  return mergeRecordsById(local, remote, taskChangedAt);
}
