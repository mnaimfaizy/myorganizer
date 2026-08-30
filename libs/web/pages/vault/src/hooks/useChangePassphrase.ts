'use client';

import { useCallback, useState } from 'react';

import {
  changePassphraseWithCurrent,
  createVaultApi,
  VaultSecretMismatchError,
} from '@myorganizer/web-vault';
import {
  passphraseChangeReading,
  useOptionalVaultSession,
} from '@myorganizer/web-vault-ui';

import { getErrorMessage } from '../utils/getErrorMessage';
import { useToast } from '@myorganizer/web-ui';

/**
 * Hook for changing a vault passphrase with the current one.
 * Handles loading and reporting of passphrase changes.
 *
 * Returns `{ changing, changePassphrase }` where:
 * - `changing`: boolean indicating if a change is in progress
 * - `changePassphrase`: async function that changes the passphrase, returning
 *   'ok' on success, 'wrong-passphrase' if the current passphrase is incorrect,
 *   or 'error' on any other failure
 */
export function useChangePassphrase() {
  const { toast } = useToast();
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const masterKeyBytes = vaultSession?.masterKeyBytes ?? null;

  const [changing, setChanging] = useState(false);

  const changePassphrase = useCallback(
    async (input: {
      currentPassphrase: string;
      newPassphrase: string;
    }): Promise<'ok' | 'wrong-passphrase' | 'error'> => {
      if (!handle || masterKeyBytes === null) {
        toast({
          title: 'Cannot change passphrase',
          description: 'Unlock your vault first.',
          variant: 'destructive',
        });
        return 'error';
      }

      setChanging(true);

      try {
        const result = await changePassphraseWithCurrent({
          api: createVaultApi(),
          handle,
          currentPassphrase: input.currentPassphrase,
          newPassphrase: input.newPassphrase,
        });

        // Every push outcome is a success toast, including the refusals.
        // The local wrapping is written before the server is touched and is
        // never rolled back, so by the time any of these is reported the
        // passphrase has already changed on this device. Reporting one as a
        // failure would send a User back to a passphrase that no longer works.
        // What differs between outcomes is only whether their other devices
        // know yet, which is what the reading says.
        const reading = passphraseChangeReading(result.push);
        toast({
          title: reading.title,
          description: reading.detail,
        });

        return 'ok';
      } catch (error) {
        if (error instanceof VaultSecretMismatchError) {
          return 'wrong-passphrase';
        }

        toast({
          title: 'Passphrase change failed',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return 'error';
      } finally {
        setChanging(false);
      }
    },
    [handle, masterKeyBytes, toast],
  );

  return { changing, changePassphrase };
}
