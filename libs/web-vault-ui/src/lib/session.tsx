'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getCurrentUser } from '@myorganizer/auth';
import {
  createLocalVaultRevision,
  createVaultApi,
  createVaultHandle,
  createVaultSyncQueue,
  type LocalVaultRevision,
  type VaultHandle,
  type VaultSyncQueue,
} from '@myorganizer/web-vault';

type VaultSessionContextValue = {
  masterKeyBytes: Uint8Array | null;
  setMasterKeyBytes: (value: Uint8Array | null) => void;
  lock: () => void;
  handle: VaultHandle | null;
  /** The Vault Sync Queue `handle` reports to. Exposed for a sync status reading. */
  syncQueue: VaultSyncQueue | null;
  /**
   * Moves whenever the Local Vault is replaced under whoever is reading it —
   * convergence taking the server's Ciphertext, an import, a removal. Exposed
   * so a page holding decrypted records can read them again.
   */
  revision: LocalVaultRevision | null;
};

const VaultSessionContext = createContext<VaultSessionContextValue | null>(
  null,
);

export interface VaultSessionProviderProps {
  children: React.ReactNode;
}

export function VaultSessionProvider({ children }: VaultSessionProviderProps) {
  const [masterKeyBytes, setMasterKeyBytesState] = useState<Uint8Array | null>(
    null,
  );

  const owner = getCurrentUser()?.id ?? null;
  const ownerRef = useRef(owner);

  const setMasterKeyBytes = setMasterKeyBytesState;

  const lock = useCallback(() => {
    setMasterKeyBytesState(null);
  }, []);

  let currentMasterKeyBytes = masterKeyBytes;
  if (ownerRef.current !== owner) {
    ownerRef.current = owner;
    if (masterKeyBytes !== null) {
      currentMasterKeyBytes = null;
      setMasterKeyBytesState(null);
    }
  }

  // Keyed on `owner` alone, unlike the handle below: locking and unlocking
  // build a new handle, and a queue rebuilt with it would drop the types an
  // edit had marked but no drain had sent yet. Those types are still unsent —
  // the Sync Bookmark says so — but nothing would come back for them until the
  // next edit or the next reconcile.
  const syncQueue = useMemo(() => {
    if (owner === null) return null;

    return createVaultSyncQueue({
      api: createVaultApi(),
      // A push does not prompt. The Vault Blob Types pinned `promptOnConflict`
      // reach this on a genuine conflict, and deferring writes nothing on
      // either side, so the divergence survives for the reconcile on the next
      // sign-in to put to the User with the dialog built for it.
      prompt: () => 'defer',
    });
  }, [owner]);

  // Keyed on `owner` alone, like the queue and for the same reason: locking
  // and unlocking build a new handle over the same Local Vault, and a revision
  // rebuilt with it would drop every subscriber a page had registered.
  const revision = useMemo(() => {
    if (owner === null) return null;
    return createLocalVaultRevision();
  }, [owner]);

  // Construct the handle
  const handle = useMemo<VaultHandle | null>(() => {
    if (owner === null) {
      return null;
    }
    return createVaultHandle({
      owner,
      masterKeyBytes: currentMasterKeyBytes,
      syncSink: syncQueue,
      revision,
    });
  }, [owner, currentMasterKeyBytes, syncQueue, revision]);

  // What a save reports covers edits made while this queue existed. Ciphertext
  // left unsent by an earlier browser session — or by a version that had no
  // Sync Bookmarks at all, which is every User's first load after Vault Push
  // ships — is unsent all the same, and no save is coming to say so. Asking
  // the bookmarks at session start is what gets those types drained instead of
  // sitting in the sync indicator with nothing able to clear them.
  //
  // Runs again whenever the handle changes, which is what a lock or an unlock
  // produces: a conflict met while locked writes nothing and leaves its type
  // marked, so the unlock is exactly when it is worth another attempt.
  useEffect(() => {
    if (!syncQueue || !handle) return;
    void syncQueue.markUnsentFromBookmarks(handle);
  }, [syncQueue, handle]);

  const value = useMemo<VaultSessionContextValue>(
    () => ({
      masterKeyBytes: currentMasterKeyBytes,
      setMasterKeyBytes,
      lock,
      handle,
      syncQueue,
      revision,
    }),
    [
      currentMasterKeyBytes,
      setMasterKeyBytes,
      lock,
      handle,
      syncQueue,
      revision,
    ],
  );

  return (
    <VaultSessionContext.Provider value={value}>
      {children}
    </VaultSessionContext.Provider>
  );
}

export function useVaultSession(): VaultSessionContextValue {
  const ctx = useContext(VaultSessionContext);
  if (!ctx) {
    throw new Error('useVaultSession must be used within VaultSessionProvider');
  }
  return ctx;
}

export function useOptionalVaultSession(): VaultSessionContextValue | null {
  return useContext(VaultSessionContext);
}
