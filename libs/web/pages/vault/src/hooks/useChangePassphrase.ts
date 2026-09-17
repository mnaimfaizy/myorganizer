'use client';

import { useCallback, useState } from 'react';

import {
  changePassphraseWithCurrent,
  createVaultApi,
  resetPassphraseAfterRecovery,
  VaultSecretMismatchError,
  type VaultHandle,
  type WrappingChangeResult,
} from '@myorganizer/web-vault';
import {
  passphraseChangeReading,
  useOptionalVaultSession,
  type VaultUnlockSecret,
} from '@myorganizer/web-vault-ui';

import { getErrorMessage } from '../utils/getErrorMessage';
import { useToast } from '@myorganizer/web-ui';

export type ChangePassphraseOutcome = 'ok' | 'wrong-passphrase' | 'error';

/**
 * How a passphrase rewrite is authorized, pinned on the Vault Unlock Secret.
 * `changePassphraseWithCurrent` verifies the current passphrase;
 * `resetPassphraseAfterRecovery` does not.
 */
const PASSPHRASE_REWRITE_FOR_UNLOCK_SECRET = {
  passphrase: (options: {
    api: ReturnType<typeof createVaultApi>;
    handle: VaultHandle;
    currentPassphrase: string;
    newPassphrase: string;
  }): Promise<WrappingChangeResult> =>
    changePassphraseWithCurrent({
      api: options.api,
      handle: options.handle,
      currentPassphrase: options.currentPassphrase,
      newPassphrase: options.newPassphrase,
    }),
  'recovery-key': (options: {
    api: ReturnType<typeof createVaultApi>;
    handle: VaultHandle;
    currentPassphrase: string;
    newPassphrase: string;
  }): Promise<WrappingChangeResult> =>
    resetPassphraseAfterRecovery({
      api: options.api,
      handle: options.handle,
      newPassphrase: options.newPassphrase,
    }),
} as const satisfies Record<
  VaultUnlockSecret,
  (options: {
    api: ReturnType<typeof createVaultApi>;
    handle: VaultHandle;
    currentPassphrase: string;
    newPassphrase: string;
  }) => Promise<WrappingChangeResult>
>;

/**
 * Hook for rewriting a vault passphrase from an unlocked session.
 * Authorization follows the Vault Unlock Secret: a passphrase unlock
 * verifies the current passphrase; a recovery-key unlock resets without it.
 *
 * Returns `{ changing, unlockSecret, changePassphrase }` where:
 * - `changing`: boolean indicating if a change is in progress
 * - `unlockSecret`: which secret unlocked this session, or null while locked
 * - `changePassphrase`: async function that rewrites the passphrase
 */
export function useChangePassphrase() {
  const { toast } = useToast();
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const masterKeyBytes = vaultSession?.masterKeyBytes ?? null;
  const unlockSecret = vaultSession?.unlockSecret ?? null;

  const [changing, setChanging] = useState(false);

  const changePassphrase = useCallback(
    async (input: {
      currentPassphrase: string;
      newPassphrase: string;
    }): Promise<ChangePassphraseOutcome> => {
      if (!handle || masterKeyBytes === null) {
        toast({
          title: 'Cannot change passphrase',
          description: 'Unlock your vault first.',
          variant: 'destructive',
        });
        return 'error';
      }

      const authorizedBy: VaultUnlockSecret = unlockSecret ?? 'passphrase';

      setChanging(true);

      try {
        const result = await PASSPHRASE_REWRITE_FOR_UNLOCK_SECRET[authorizedBy](
          {
            api: createVaultApi(),
            handle,
            currentPassphrase: input.currentPassphrase,
            newPassphrase: input.newPassphrase,
          },
        );

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
    [handle, masterKeyBytes, unlockSecret, toast],
  );

  return { changing, unlockSecret, changePassphrase };
}
