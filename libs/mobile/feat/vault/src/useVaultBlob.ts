import { useCallback, useEffect, useRef, useState } from 'react';
import type { VaultBlobType } from '@myorganizer/app-api-client';

import { useVaultSession } from './context/VaultSessionContext';
import type {
  VaultBlobReloadOutcome,
  VaultBlobSnapshot,
  VaultBlobWriteErrorKind,
} from './sync';
import {
  createVaultBlobController,
  INITIAL_VAULT_BLOB_STATE,
  type VaultBlobController,
  type VaultBlobEdit,
  type VaultBlobState,
} from './vaultBlobController';

export type { VaultBlobEdit, VaultBlobReloadOutcome, VaultBlobWriteErrorKind };

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
 * and its error where they were. `discard` drops a held edit without sending
 * it, for a screen whose User abandoned it; a later reload then has nothing
 * to send.
 *
 * `apply` resolves `true` once the edit is on the server and `false` when it
 * is not. An edit that returns the envelope it was given changed nothing: it
 * is not pushed and not held, `apply` resolves `false`, and `writeError` is
 * `not-applied`. One request is in flight at a time: `apply` resolves `false`
 * without doing anything while a read or a write is running, and `reload`
 * does nothing while a write is, so neither can show a copy the other has
 * already moved past. `reload` shows `loading` only when there is nothing on
 * screen yet; re-reading over a list shows `refreshing` instead.
 *
 * Each call of this hook holds its own copy, so two screens on one Vault
 * Blob Type — a list and the detail pushed over it — are two copies. A write
 * the server confirmed for one is handed to the other in memory, so the list
 * shows it on return with no request of its own. The other takes it only
 * while it has no request in flight and holds no edit whose push failed;
 * `writing`, `writeError`, and a held edit are never shared.
 *
 * All of that is decided in `createVaultBlobController`, which has no React
 * in it and is tested on its own. This hook hands it the session and renders
 * the state it reports.
 */
export function useVaultBlob(type: VaultBlobType): {
  snapshot: VaultBlobSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  loadError: unknown;
  writing: boolean;
  writeError: VaultBlobWriteErrorKind | null;
  reload: () => Promise<VaultBlobReloadOutcome>;
  discard: () => void;
  apply: (edit: VaultBlobEdit) => Promise<boolean>;
  retry: () => Promise<boolean>;
} {
  const { masterKey, vaultApi, blobPeers } = useVaultSession();
  const [state, setState] = useState<VaultBlobState>(INITIAL_VAULT_BLOB_STATE);

  // Read by the controller at the start of each call, so one controller —
  // and the edit it may be holding — outlives a change of Master Key.
  const sessionRef = useRef({ vaultApi, masterKey, type });
  useEffect(() => {
    sessionRef.current = { vaultApi, masterKey, type };
  });

  const controllerRef = useRef<VaultBlobController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createVaultBlobController({
      getSession: () => sessionRef.current,
      onState: setState,
      peers: blobPeers,
    });
  }
  const controller = controllerRef.current;

  // Before the first reload, and gone with the screen: an unmounted hook has
  // no state to put a peer's write into.
  useEffect(() => controller.join(), [controller]);

  useEffect(() => {
    void controller.reload();
  }, [controller, masterKey, vaultApi, type]);

  const reload = useCallback(() => controller.reload(), [controller]);
  const discard = useCallback(() => controller.discard(), [controller]);
  const apply = useCallback(
    (edit: VaultBlobEdit) => controller.apply(edit),
    [controller],
  );
  const retry = useCallback(() => controller.retry(), [controller]);

  return { ...state, reload, discard, apply, retry };
}
