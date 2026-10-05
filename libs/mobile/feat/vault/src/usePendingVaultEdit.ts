import { useCallback, useState } from 'react';
import type { VaultBlobEdit, VaultBlobWriteErrorKind } from './useVaultBlob';

/**
 * What a refused Vault Push says, and what it offers instead — the one copy
 * every mobile screen's Unconfirmed Edit note shows, so the wording cannot
 * drift between a screen tracking one line and a screen tracking one list.
 *
 * The wording is the approved design's (Lists, Groc-Trip-Reverted,
 * Det-UL-Reverted, Groc-Trip-Conflict): a revert says it was not saved, why,
 * and that the row is back on the last saved copy — never that the edit is
 * held anywhere to send later, because the app is online-only and nothing is
 * ([ADR 0107](../../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md)).
 * The design draws only the offline revert; `failed` follows its shape
 * without the cause, which nothing on the device can name.
 *
 * A `conflict` here is `retries-exhausted`: the server moved again under every
 * merged retry (ADR 0107). No Vault Blob Type is pinned to `promptOnConflict`,
 * so the `strategy` reason is not reached. The way forward is to look, which
 * is why the offer is Reload and not Retry — the other two are ordinary
 * failures and resend the edit. The reload is a Vault Pull, so it also sends
 * the edit, merged with what it finds
 * ([ADR 0121](../../../../../docs/adr/0121-a-mobile-vault-pull-converges-the-unsent-edit-it-is-handed.md)).
 */
export const VAULT_WRITE_ERROR_COPY = {
  conflict: {
    message: 'Changed on another device. Reload to see the latest.',
    action: 'Reload',
  },
  network: {
    message: 'Not saved — you’re offline. Showing the last saved copy.',
    action: 'Retry',
  },
  failed: {
    message: 'Not saved. Showing the last saved copy.',
    action: 'Retry',
  },
} as const satisfies Record<
  VaultBlobWriteErrorKind,
  { message: string; action: string }
>;

/**
 * One id's worth of Unconfirmed Edit state (CONTEXT.md): which id a screen is
 * showing as pending, and which one was put back after a push failed.
 *
 * A screen tracking two independent things — a line and a list-level bulk
 * action, say — calls this twice, once per id space. `apply` itself runs one
 * write at a time, so within one call there is never a second id waiting.
 */
export function usePendingVaultEdit<TId extends string = string>(
  apply: (edit: VaultBlobEdit) => Promise<boolean>,
  retry: () => Promise<boolean>,
  reload: () => Promise<void>,
): {
  pendingId: TId | null;
  revertedId: TId | null;
  push: (id: TId, edit: VaultBlobEdit) => Promise<boolean>;
  reloadAfterConflict: () => void;
  retryFailedEdit: () => Promise<void>;
} {
  const [pendingId, setPendingId] = useState<TId | null>(null);
  const [revertedId, setRevertedId] = useState<TId | null>(null);

  const push = useCallback(
    async (id: TId, edit: VaultBlobEdit): Promise<boolean> => {
      setPendingId(id);
      setRevertedId(null);
      const confirmed = await apply(edit);
      setPendingId(null);
      if (!confirmed) setRevertedId(id);
      return confirmed;
    },
    [apply],
  );

  const reloadAfterConflict = useCallback((): void => {
    setRevertedId(null);
    void reload();
  }, [reload]);

  const retryFailedEdit = useCallback(async (): Promise<void> => {
    setPendingId(revertedId);
    const confirmed = await retry();
    setPendingId(null);
    if (confirmed) setRevertedId(null);
  }, [retry, revertedId]);

  return { pendingId, revertedId, push, reloadAfterConflict, retryFailedEdit };
}
