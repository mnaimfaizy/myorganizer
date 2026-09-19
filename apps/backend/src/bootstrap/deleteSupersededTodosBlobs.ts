import vaultService from '../services/VaultService';
import { runBootTask } from './runBootTask';

/**
 * Idempotent boot cleanup for superseded `'todos'` EncryptedVaultBlob rows.
 * Safe to run on every start: the SQL only deletes `'todos'` when `'tasks'`
 * already exists for the same user.
 */
export async function deleteSupersededTodosBlobsOnBoot(): Promise<void> {
  await runBootTask(
    '[bootstrap] Failed to delete superseded todos blobs:',
    async () => {
      const deleted = await vaultService.deleteSupersededTodosBlobs();
      if (deleted > 0) {
        console.log(
          `[bootstrap] Deleted ${deleted} superseded todos vault blob(s).`,
        );
      }
    },
  );
}
