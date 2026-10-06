import type { VaultApi, VaultBlobType } from '@myorganizer/app-api-client';
import type { VaultBlobEnvelope } from '@myorganizer/vault-core/portable';

import {
  classifyWriteError,
  pullAndSendVaultBlob,
  pushVaultBlob,
  settleVaultBlobPull,
  type VaultBlobReloadOutcome,
  type VaultBlobSnapshot,
  type VaultBlobWriteErrorKind,
} from './sync';

/**
 * One edit to a Vault Blob, as a function of the envelope it applies to.
 *
 * An edit that cannot apply returns the envelope it was given — the same
 * reference, not a copy. `apply` reads that as nothing to send; a copy with
 * the same contents would be pushed and reported as saved.
 */
export type VaultBlobEdit = (
  envelope: VaultBlobEnvelope<unknown>,
) => VaultBlobEnvelope<unknown>;

/** What a screen shows of one Vault Blob. */
export interface VaultBlobState {
  snapshot: VaultBlobSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  loadError: unknown;
  writing: boolean;
  writeError: VaultBlobWriteErrorKind | null;
}

export const INITIAL_VAULT_BLOB_STATE: VaultBlobState = {
  snapshot: null,
  loading: true,
  refreshing: false,
  loadError: null,
  writing: false,
  writeError: null,
};

export interface VaultBlobController {
  reload: () => Promise<VaultBlobReloadOutcome>;
  apply: (edit: VaultBlobEdit) => Promise<boolean>;
  retry: () => Promise<boolean>;
  discard: () => void;
}

/**
 * Everything `useVaultBlob` decides, with no React in it, so it runs in the
 * node Jest project: one request in flight at a time, the edit that changes
 * nothing and so is never pushed, the edit held after a failed push, the
 * revert, and what a reload does with that edit
 * ([ADR 0107](../../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md),
 * [ADR 0121](../../../../../docs/adr/0121-a-mobile-vault-pull-converges-the-unsent-edit-it-is-handed.md)).
 * The hook supplies the session and renders the state it is handed.
 *
 * `getSession` is read at the start of each call, so a controller outlives a
 * change of Master Key. Nothing here is persisted.
 */
export function createVaultBlobController(params: {
  getSession: () => {
    vaultApi: VaultApi;
    masterKey: Uint8Array | null;
    type: VaultBlobType;
  };
  onState: (state: VaultBlobState) => void;
}): VaultBlobController {
  let state = INITIAL_VAULT_BLOB_STATE;
  let busy = false;
  // The edit whose push failed, and the envelope it produced when it was
  // made. `retry` runs `edit` again; `reload` merges `edited` as it stands.
  let held: { edit: VaultBlobEdit; edited: VaultBlobEnvelope<unknown> } | null =
    null;

  const set = (patch: Partial<VaultBlobState>): void => {
    state = { ...state, ...patch };
    params.onState(state);
  };

  const reload = async (): Promise<VaultBlobReloadOutcome> => {
    const { vaultApi, masterKey, type } = params.getSession();
    if (!masterKey || busy) return held ? 'held' : 'pulled';

    busy = true;
    const busyFlag = state.snapshot ? 'refreshing' : 'loading';
    set({ [busyFlag]: true, loadError: null });
    const unsent = held;
    try {
      const result = await pullAndSendVaultBlob({
        vaultApi,
        masterKey,
        type,
        unsent: unsent?.edited ?? null,
        onPulled: ({ server, converged }) => {
          if (!converged) return;
          set({
            writing: true,
            snapshot: { envelope: converged, etag: server.etag },
          });
        },
      });
      const settled = settleVaultBlobPull(result);
      if (!settled.held) held = null;
      set({ snapshot: result.snapshot, writeError: settled.writeError });
      return settled.outcome;
    } catch (err) {
      set({ loadError: err });
      return unsent ? 'held' : 'pulled';
    } finally {
      busy = false;
      set({ [busyFlag]: false, writing: false });
    }
  };

  const apply = async (edit: VaultBlobEdit): Promise<boolean> => {
    const { vaultApi, masterKey, type } = params.getSession();
    const base = state.snapshot;
    if (!masterKey || !base || busy) return false;

    busy = true;
    held = null;
    set({ writing: true, writeError: null });
    // Held on a failure as the edit stood when the User made it.
    let edited = base.envelope;
    try {
      edited = edit(base.envelope);
      // An edit that cannot apply hands back the envelope it was given.
      // Pushing that would report a change that was never made as saved.
      if (edited === base.envelope) {
        set({ writeError: 'not-applied' });
        return false;
      }
      set({ snapshot: { envelope: edited, etag: base.etag } });
      set({
        snapshot: await pushVaultBlob({
          vaultApi,
          masterKey,
          type,
          edited,
          etag: base.etag,
        }),
      });
      return true;
    } catch (err) {
      held = { edit, edited };
      set({ snapshot: base, writeError: classifyWriteError(err) });
      return false;
    } finally {
      busy = false;
      set({ writing: false });
    }
  };

  const retry = async (): Promise<boolean> => (held ? apply(held.edit) : false);

  const discard = (): void => {
    if (busy) return;
    held = null;
    set({ writeError: null });
  };

  return { reload, apply, retry, discard };
}
