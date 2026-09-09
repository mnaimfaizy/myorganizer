'use client';

import { useMemo } from 'react';

import {
  useLocalVaultRevision,
  useOptionalVaultSession,
} from '@myorganizer/web-vault-ui';

import type { VaultDisabledState } from '../policy';

export function useVaultDisabledState(): VaultDisabledState {
  const vaultSession = useOptionalVaultSession();
  // Convergence replaces the Local Vault without passing through this hook,
  // so the revision is the only thing that says the vault changed. Adding it
  // to dependencies invalidates the memoized state when a reconcile completes.
  const revision = useLocalVaultRevision();

  return useMemo(() => {
    const handle = vaultSession?.handle ?? null;
    const masterKeyBytes = vaultSession?.masterKeyBytes ?? null;

    const isUnlocked = handle !== null && masterKeyBytes !== null;
    const isSignedOut = handle === null;
    const hasLocalVault = handle !== null && handle.loadVault() !== null;

    const disabledState: VaultDisabledState = isSignedOut
      ? 'signed-out'
      : !hasLocalVault
        ? 'no-local-vault'
        : !isUnlocked
          ? 'locked'
          : 'enabled';

    return disabledState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultSession, revision]);
}
