import vaultService from '../services/VaultService';

/**
 * Idempotent boot cleanup for superseded `'todos'` EncryptedVaultBlob rows.
 * Safe to run on every start: the SQL only deletes `'todos'` when `'tasks'`
 * already exists for the same user.
 */
export async function deleteSupersededTodosBlobsOnBoot(): Promise<void> {
  try {
    const deleted = await vaultService.deleteSupersededTodosBlobs();
    if (deleted > 0) {
      console.log(
        `[bootstrap] Deleted ${deleted} superseded todos vault blob(s).`,
      );
    }
  } catch (err) {
    console.error('[bootstrap] Failed to delete superseded todos blobs:', err);
  }
}
