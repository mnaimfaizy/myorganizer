'use client';

import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';

type DisabledState = 'signed-out' | 'no-local-vault' | 'locked' | 'enabled';

export function useVaultDisabledState(): DisabledState {
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const masterKeyBytes = vaultSession?.masterKeyBytes ?? null;

  const isUnlocked = handle !== null && masterKeyBytes !== null;
  const isSignedOut = handle === null;
  const hasLocalVault = handle !== null && handle.loadVault() !== null;

  const disabledState: DisabledState = isSignedOut
    ? 'signed-out'
    : !hasLocalVault
      ? 'no-local-vault'
      : !isUnlocked
        ? 'locked'
        : 'enabled';

  return disabledState;
}
