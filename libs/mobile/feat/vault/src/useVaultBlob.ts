import { useCallback, useEffect, useRef, useState } from 'react';
import type { VaultBlobType } from '@myorganizer/app-api-client';
import type { VaultBlobEnvelope } from '@myorganizer/vault-core/portable';

import { useVaultSession } from './context/VaultSessionContext';
import {
  isNetworkError,
  pullAndSendVaultBlob,
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
 * - `conflict` — another device kept changing the blob under this one's
 *   merged retries. Reloading reads the server's copy and sends the edit
 *   merged with it.
 * - `network` — the server could not be reached. Retrying resends the edit.
 * - `failed` — anything else. Retrying resends the edit.
 *
 * Until a retry or a reload sends it, the edit is held by the hook that made
 * it and nowhere else.
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
 * `reload` is the mobile Vault Pull ([ADR 0121](../../../../../docs/adr/0121-a-mobile-vault-pull-converges-the-unsent-edit-it-is-handed.md)).
 * An edit whose push failed is not dropped by it: the envelope that edit
 * produced when the User made it is merged per record with the copy that
 * arrives and sent, so what another device changed and what this one could
 * not send both end up on the server. The edit is not run again for this — a
 * second run would stamp it with the time of the reload, and a deletion made
 * elsewhere in between would lose to it. A read that fails leaves the edit
 * and its error where they were.
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
  // The edit whose push failed, and the envelope it produced when it was
  // made. `retry` runs `edit` again; `reload` merges `edited` as it stands.
  const failedEditRef = useRef<{
    edit: VaultBlobEdit;
    edited: VaultBlobEnvelope<unknown>;
  } | null>(null);

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
    const held = failedEditRef.current;
    try {
      const result = await pullAndSendVaultBlob({
        vaultApi,
        masterKey,
        type,
        unsent: held?.edited ?? null,
        onPulled: ({ server, converged }) => {
          if (!converged) return;
          setWriting(true);
          show({ envelope: converged, etag: server.etag });
        },
      });
      show(result.snapshot);
      if (result.outcome === 'send-failed') {
        setWriteError(classifyWriteError(result.error));
        return;
      }
      failedEditRef.current = null;
      setWriteError(result.outcome === 'not-carried' ? 'conflict' : null);
    } catch (err) {
      setLoadError(err);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setWriting(false);
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
      // Held on a failure as the edit stood when the User made it.
      let edited = base.envelope;
      try {
        edited = edit(base.envelope);
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
        failedEditRef.current = { edit, edited };
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
    const held = failedEditRef.current;
    return held ? apply(held.edit) : false;
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
