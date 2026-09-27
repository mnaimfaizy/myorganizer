import { useCallback, useEffect, useRef, useState } from 'react';
import type { VaultBlobType } from '@myorganizer/app-api-client';
import type { VaultBlobEnvelope } from '@myorganizer/vault-core/portable';

import { useVaultSession } from './context/VaultSessionContext';
import {
  isNetworkError,
  readVaultBlob,
  pushVaultBlob,
  VaultBlobConflictError,
  type VaultBlobSnapshot,
} from './sync';

/** One edit to a Vault Blob, as a function of the envelope it applies to. */
export type VaultBlobEdit = (
  envelope: VaultBlobEnvelope<unknown>,
) => VaultBlobEnvelope<unknown>;

/**
 * Why the last edit did not reach the server. The edit was reverted on
 * screen; it was never kept anywhere else.
 *
 * - `conflict` — another device changed the blob in a way this one will not
 *   merge. Reloading shows the server's copy; the edit has to be made again.
 * - `network` — the server could not be reached. Retrying resends the edit.
 * - `failed` — anything else. Retrying resends the edit.
 */
export type VaultBlobWriteErrorKind = 'conflict' | 'network' | 'failed';

function classifyWriteError(err: unknown): VaultBlobWriteErrorKind {
  if (err instanceof VaultBlobConflictError) return 'conflict';
  return isNetworkError(err) ? 'network' : 'failed';
}

/**
 * One Vault Blob, readable and editable on mobile.
 *
 * Mobile has no Local Vault, so an edit is applied to what is on screen and
 * pushed straight away ([ADR 0107](../../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md)).
 * When the push fails the screen goes back to the last copy the server
 * confirmed and `writeError` says why; `retry` sends the same edit again. An
 * edit is never held anywhere but this hook's state, and never outlives it.
 *
 * `apply` resolves `true` once the edit is on the server and `false` when it
 * is not. One request is in flight at a time: `apply` resolves `false`
 * without doing anything while a read or a write is running, and `reload`
 * does nothing while a write is, so neither can show a copy the other has
 * already moved past. `reload` shows `loading` only when there is nothing on
 * screen yet; re-reading over a list shows `refreshing` instead.
 */
export function useVaultBlob(type: VaultBlobType): {
  snapshot: VaultBlobSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  loadError: unknown;
  writing: boolean;
  writeError: VaultBlobWriteErrorKind | null;
  reload: () => Promise<void>;
  apply: (edit: VaultBlobEdit) => Promise<boolean>;
  retry: () => Promise<boolean>;
} {
  const { masterKey, vaultApi } = useVaultSession();

  const [snapshot, setSnapshot] = useState<VaultBlobSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<VaultBlobWriteErrorKind | null>(
    null,
  );

  // Read by the callbacks below so an edit always applies to the newest copy,
  // not to whichever one a closure captured.
  const snapshotRef = useRef<VaultBlobSnapshot | null>(null);
  const busyRef = useRef(false);
  const failedEditRef = useRef<VaultBlobEdit | null>(null);

  const show = useCallback((next: VaultBlobSnapshot | null): void => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    if (!masterKey || busyRef.current) return;
    busyRef.current = true;
    const setBusy = snapshotRef.current ? setRefreshing : setLoading;
    setBusy(true);
    setLoadError(null);
    setWriteError(null);
    failedEditRef.current = null;
    try {
      show(await readVaultBlob({ vaultApi, masterKey, type }));
    } catch (err) {
      setLoadError(err);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [masterKey, vaultApi, type, show]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const apply = useCallback(
    async (edit: VaultBlobEdit): Promise<boolean> => {
      const base = snapshotRef.current;
      if (!masterKey || !base || busyRef.current) return false;

      busyRef.current = true;
      setWriting(true);
      setWriteError(null);
      failedEditRef.current = null;
      try {
        const edited = edit(base.envelope);
        show({ envelope: edited, etag: base.etag });
        show(
          await pushVaultBlob({
            vaultApi,
            masterKey,
            type,
            edited,
            etag: base.etag,
          }),
        );
        return true;
      } catch (err) {
        show(base);
        failedEditRef.current = edit;
        setWriteError(classifyWriteError(err));
        return false;
      } finally {
        busyRef.current = false;
        setWriting(false);
      }
    },
    [masterKey, vaultApi, type, show],
  );

  const retry = useCallback(async (): Promise<boolean> => {
    const edit = failedEditRef.current;
    return edit ? apply(edit) : false;
  }, [apply]);

  return {
    snapshot,
    loading,
    refreshing,
    loadError,
    writing,
    writeError,
    reload,
    apply,
    retry,
  };
}
