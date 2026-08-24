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
import { createVaultHandle, type VaultHandle } from '@myorganizer/web-vault';

type VaultSessionContextValue = {
  masterKeyBytes: Uint8Array | null;
  setMasterKeyBytes: (value: Uint8Array | null) => void;
  lock: () => void;
  handle: VaultHandle | null;
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

  // Construct the handle
  const handle = useMemo<VaultHandle | null>(() => {
    if (owner === null) {
      return null;
    }
    return createVaultHandle({ owner, masterKeyBytes: currentMasterKeyBytes });
  }, [owner, currentMasterKeyBytes]);

  const value = useMemo<VaultSessionContextValue>(
    () => ({
      masterKeyBytes: currentMasterKeyBytes,
      setMasterKeyBytes,
      lock,
      handle,
    }),
    [currentMasterKeyBytes, setMasterKeyBytes, lock, handle],
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
