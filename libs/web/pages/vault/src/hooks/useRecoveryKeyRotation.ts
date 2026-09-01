'use client';

import { useCallback, useState } from 'react';

import {
  createVaultApi,
  rotateRecoveryKeyWithPassphrase,
  VaultSecretMismatchError,
} from '@myorganizer/web-vault';
import type { MintedRecoveryKey } from '@myorganizer/web-vault';
import {
  recoveryKeyRotationReading,
  useOptionalVaultSession,
} from '@myorganizer/web-vault-ui';
import { useToast } from '@myorganizer/web-ui';

import { getErrorMessage } from '../utils/getErrorMessage';

/**
 * Hook for committing a Recovery Key Rotation.
 *
 * Minting the new key is a pure call the card makes directly against
 * `mintRecoveryKey` from `@myorganizer/web-vault` — nothing is written and
 * this hook is not reached until the User has recorded the key and asks to
 * commit.
 *
 * Returns `{ rotating, rotateRecoveryKey }` where:
 * - `rotating`: boolean indicating if a commit is in progress
 * - `rotateRecoveryKey`: async function that commits the rotation, returning
 *   'ok' on success, 'wrong-passphrase' if the current passphrase is
 *   incorrect, or 'error' on any other failure
 */
export function useRecoveryKeyRotation() {
  const { toast } = useToast();
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const masterKeyBytes = vaultSession?.masterKeyBytes ?? null;

  const [rotating, setRotating] = useState(false);

  const rotateRecoveryKey = useCallback(
    async (input: {
      currentPassphrase: string;
      recoveryKey: MintedRecoveryKey;
    }): Promise<'ok' | 'wrong-passphrase' | 'error'> => {
      if (!handle || masterKeyBytes === null) {
        toast({
          title: 'Cannot rotate recovery key',
          description: 'Unlock your vault first.',
          variant: 'destructive',
        });
        return 'error';
      }

      setRotating(true);

      try {
        const result = await rotateRecoveryKeyWithPassphrase({
          api: createVaultApi(),
          handle,
          currentPassphrase: input.currentPassphrase,
          recoveryKey: input.recoveryKey,
        });

        // Every push outcome is a success toast, including the refusals. The
        // local wrapping is written before the server is touched and is
        // never rolled back, so by the time any of these is reported the
        // rotation has already happened on this device — reporting one as a
        // failure would send a User back to a recovery key that no longer
        // works. What differs between outcomes is only whether other devices
        // and a new sign-in know yet, which is what the reading says.
        const reading = recoveryKeyRotationReading(result.push);
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
          title: 'Recovery key rotation failed',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return 'error';
      } finally {
        setRotating(false);
      }
    },
    [handle, masterKeyBytes, toast],
  );

  return { rotating, rotateRecoveryKey };
}
