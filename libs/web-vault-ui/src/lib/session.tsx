'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type VaultSessionContextValue = {
  masterKeyBytes: Uint8Array | null;
  setMasterKeyBytes: (value: Uint8Array | null) => void;
  lock: () => void;
};

const VaultSessionContext = createContext<VaultSessionContextValue | null>(
  null
);

export function VaultSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [masterKeyBytes, setMasterKeyBytes] = useState<Uint8Array | null>(null);

  const lock = useCallback(() => {
    setMasterKeyBytes(null);
  }, []);

  const value = useMemo<VaultSessionContextValue>(
    () => ({ masterKeyBytes, setMasterKeyBytes, lock }),
    [masterKeyBytes, lock]
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
