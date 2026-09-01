'use client';

import { Button, Input, Label } from '@myorganizer/web-ui';
import { useState, useCallback } from 'react';

import { newPassphraseSchema } from '@myorganizer/web-vault';

export interface RecoverySetNewPassphraseFormProps {
  /**
   * Gates the submit button. Null means the recovery unlock has not produced a
   * Master Key yet, so there is nothing to rewrap and nothing to submit.
   */
  masterKeyBytes: Uint8Array | null;
  /**
   * Given the confirmed passphrase. Everything that follows — rewrapping,
   * pushing, and what the User is told about whether their other devices heard
   * — stays with the Vault Gate, which is where the recovery-authorized API
   * and its guard test live.
   */
  onSubmit: (newPassphrase: string) => Promise<void>;
}

/**
 * The "set a new passphrase" step of the Vault Gate's recovery branch.
 *
 * Extracted from `vaultGate.tsx` so that screen's JSX stays under the size
 * limit, and it holds only the two fields and their match check: no vault
 * access, no session, no network. The confirmation field never leaves this
 * component — what the parent is handed is one passphrase that has already
 * matched its confirmation.
 */
export function RecoverySetNewPassphraseForm({
  masterKeyBytes,
  onSubmit,
}: RecoverySetNewPassphraseFormProps) {
  const [newPassphrase, setNewPassphrase] = useState('');
  const [newPassphraseConfirm, setNewPassphraseConfirm] = useState('');

  const handleSetNewPassphrase = useCallback(async () => {
    await onSubmit(newPassphrase);
  }, [newPassphrase, onSubmit]);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="new-passphrase">Set a new passphrase</Label>
        <Input
          id="new-passphrase"
          type="password"
          value={newPassphrase}
          onChange={(e) => setNewPassphrase(e.target.value)}
          placeholder="New passphrase"
        />
        <Input
          id="new-passphrase-confirm"
          type="password"
          value={newPassphraseConfirm}
          onChange={(e) => setNewPassphraseConfirm(e.target.value)}
          placeholder="Confirm new passphrase"
        />
      </div>

      <Button
        type="button"
        disabled={
          !masterKeyBytes ||
          !newPassphraseSchema.safeParse({
            newPassphrase,
            newPassphraseConfirm,
          }).success
        }
        onClick={handleSetNewPassphrase}
      >
        Set new passphrase
      </Button>
    </>
  );
}
