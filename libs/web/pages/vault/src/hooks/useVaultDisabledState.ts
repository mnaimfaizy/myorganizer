'use client';

import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';

import type { VaultDisabledState } from '../policy';

export function useVaultDisabledState(): VaultDisabledState {
  const vaultSession = useOptionalVaultSession();
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
}
