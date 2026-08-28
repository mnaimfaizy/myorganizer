'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getCurrentUser } from '@myorganizer/auth';
import {
  createVaultApi,
  createVaultHandle,
  createVaultSyncQueue,
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
};

const VaultSessionContext = createContext<VaultSessionContextValue | null>(
  null,
);

export function VaultSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // Construct the handle
  const handle = useMemo<VaultHandle | null>(() => {
    if (owner === null) {
      return null;
    }
    return createVaultHandle({
      owner,
      masterKeyBytes: currentMasterKeyBytes,
      syncSink: syncQueue,
    });
  }, [owner, currentMasterKeyBytes, syncQueue]);

  const value = useMemo<VaultSessionContextValue>(
    () => ({
      masterKeyBytes: currentMasterKeyBytes,
      setMasterKeyBytes,
      lock,
      handle,
      syncQueue,
    }),
    [currentMasterKeyBytes, setMasterKeyBytes, lock, handle, syncQueue],
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
