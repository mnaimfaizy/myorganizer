'use client';

import { useCallback, useState } from 'react';

import { VaultSecretMismatchError } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import { useToast } from '@myorganizer/web-ui';

import { getErrorMessage } from '../utils/getErrorMessage';

/**
 * Hook for unlocking a vault with a passphrase.
 * Handles loading and reporting of vault unlock attempts.
 *
 * Returns `{ unlocking, unlock }` where:
 * - `unlocking`: boolean indicating if an unlock is in progress
 * - `unlock`: async function that unlocks the vault, returning
 *   'ok' on success, 'wrong-passphrase' if the passphrase is incorrect,
 *   or 'error' on any other failure
 */
export function useVaultUnlock() {
  const { toast } = useToast();
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const setMasterKeyBytes = vaultSession?.setMasterKeyBytes;

  const [unlocking, setUnlocking] = useState(false);

  const unlock = useCallback(
    async (
      passphrase: string,
    ): Promise<'ok' | 'wrong-passphrase' | 'error'> => {
      if (!handle || !setMasterKeyBytes) {
        toast({
          title: 'Unlock failed',
          description: 'Sign in to unlock a vault.',
          variant: 'destructive',
        });
        return 'error';
      }

      setUnlocking(true);

      try {
        const result = await handle.unlockWithPassphrase({ passphrase });
        setMasterKeyBytes(result.masterKeyBytes);

        toast({
          title: 'Unlocked',
          description: 'Vault unlocked for this session.',
        });

        return 'ok';
      } catch (error) {
        if (error instanceof VaultSecretMismatchError) {
          return 'wrong-passphrase';
        }

        toast({
          title: 'Unlock failed',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return 'error';
      } finally {
        setUnlocking(false);
      }
    },
    [handle, setMasterKeyBytes, toast],
  );

  return { unlocking, unlock };
}
