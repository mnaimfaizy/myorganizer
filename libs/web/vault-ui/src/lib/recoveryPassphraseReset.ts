import {
  createVaultApi,
  resetPassphraseAfterRecovery,
  type VaultHandle,
  type WrappingChangeResult,
} from '@myorganizer/web-vault';

import { passphraseChangeReading } from './vaultMetaPushMessages';

/**
 * The toast callback both recovery-reset surfaces already hold from
 * `useToast`. Kept structural so this module does not import the hook.
 */
export type PassphraseRewriteToast = (props: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

function passphraseResetErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

/**
 * Name a wrapping rewrite the way the Passphrase Reset Prompt and the
 * Vault card's recovery branch both already do.
 */
export function announcePassphraseChange(
  result: WrappingChangeResult,
  toast: PassphraseRewriteToast,
): void {
  const reading = passphraseChangeReading(result.push);
  toast({
    title: reading.title,
    description: reading.detail,
  });
}

/**
 * The recovery-key passphrase reset: `resetPassphraseAfterRecovery`, the
 * wrapping-change reading, and completing the Passphrase Reset Prompt.
 * The prompt and `useChangePassphrase`'s recovery branch both call this
 * instead of re-deriving the sequence.
 */
export async function resetPassphraseAfterRecoveryAndAnnounce(options: {
  handle: VaultHandle;
  newPassphrase: string;
  toast: PassphraseRewriteToast;
  onComplete?: () => void;
}): Promise<'ok' | 'error'> {
  try {
    const result = await resetPassphraseAfterRecovery({
      api: createVaultApi(),
      handle: options.handle,
      newPassphrase: options.newPassphrase,
    });
    announcePassphraseChange(result, options.toast);
    options.onComplete?.();
    return 'ok';
  } catch (error) {
    options.toast({
      title: 'Passphrase change failed',
      description: passphraseResetErrorDetail(error),
      variant: 'destructive',
    });
    return 'error';
  }
}
