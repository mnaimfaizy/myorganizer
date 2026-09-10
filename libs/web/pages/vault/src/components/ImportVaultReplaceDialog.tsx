'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Checkbox,
  Label,
} from '@myorganizer/web-ui';

import { type VaultImportDisclosureState } from '../hooks';

export interface ImportVaultReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Carry out the import-replace. Only enabled once the User has checked the acknowledgement box. Parent handles the actual import/toast. May throw; the dialog shows the error and stays open. */
  onConfirm: () => Promise<void>;
  /** Decline. Nothing is written. Parent toasts "Import canceled" if it wants that copy. */
  onDecline: () => void;
  /** Disclosure of what this import changes about vault credentials. */
  disclosure: VaultImportDisclosureState;
}

export function ImportVaultReplaceDialog({
  open,
  onOpenChange,
  onConfirm,
  onDecline,
  disclosure,
}: ImportVaultReplaceDialogProps) {
  const acknowledgeId = useId();
  const skipDeclineOnCloseRef = useRef(false);

  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIsAcknowledged(false);
      setConfirmError(null);
    }
  }, [open]);

  // Reset on the outcome, not only on close. The comparison resolves while
  // the dialog is already open, so a User who ticked the box against one
  // sentence would otherwise carry that tick onto a different one — and the
  // sentence they never read is the alarming one.
  useEffect(() => {
    setIsAcknowledged(false);
  }, [disclosure.outcome]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        if (!skipDeclineOnCloseRef.current) {
          onDecline();
        }
        skipDeclineOnCloseRef.current = false;
      }
      onOpenChange(nextOpen);
    },
    [onDecline, onOpenChange],
  );

  const handleAcknowledgeChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      setIsAcknowledged(checked === true);
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    setConfirmError(null);
    setIsConfirming(true);
    try {
      await onConfirm();
      skipDeclineOnCloseRef.current = true;
      onOpenChange(false);
    } catch (error: unknown) {
      setConfirmError(
        error instanceof Error ? error.message : 'Failed to import vault',
      );
    } finally {
      setIsConfirming(false);
    }
  }, [onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  /**
   * What this import does to the User's credentials, in one sentence.
   *
   * Derived per outcome rather than written once for the worst case: a fixed
   * warning has to assume the different-Vault row, and restoring your own
   * recent backup is the ordinary reason to use import, so it would cry wolf
   * on the common case and train the User past the sentence that matters
   * (ADR 0068, decision point 5).
   *
   * `DialogDescription` renders a `<p>`, so this returns inline content only.
   */
  function describeOutcome(): string {
    switch (disclosure.status) {
      case 'pending':
        return 'Checking what this backup changes about opening your Vault…';

      case 'unreadable':
        return 'This file could not be read as a vault backup, so what it changes about opening your Vault cannot be shown here. Importing it will most likely fail.';

      case 'loaded':
        switch (disclosure.outcome.kind) {
          case 'unchanged':
            // Deliberately says nothing about credentials. This is the row the
            // slice exists for: the common case earns no warning, which is what
            // leaves the other two meaning something when they appear.
            return 'This backup came from the Vault this device already holds, wrapped with the same passphrase and Recovery Key. Nothing about opening your Vault changes.';

          case 'wrapping-reverts':
            // Same Vault Identity, so the Ciphertext stays readable and only
            // the wrapping moves back. Naming the credential that actually
            // moved is the point — a warning about the wrong secret is the
            // same failure as one written for the wrong case.
            return disclosure.outcome.change === 'passphrase'
              ? 'This backup holds the Vault this device already has, wrapped with the passphrase that was in use when the backup was made. After importing, that passphrase unlocks this device and the one you use now stops working. Your Recovery Key is unaffected.'
              : 'This backup holds the Vault this device already has, wrapped with the Recovery Key that was current when the backup was made. After importing, that Recovery Key opens this device and the current one stops working. Your passphrase is unaffected.';

          case 'different-vault':
            return 'This backup is a different Vault. Its passphrase and Recovery Key replace the ones on this device, and this device will stop holding the Vault the server has.';
        }
    }
  }

  /**
   * The acknowledgement the User must tick, or `null` where there is nothing
   * to acknowledge.
   *
   * One derivation, read by both the checkbox and the confirm button, so the
   * two cannot drift into showing a box that gates nothing — or gating on a
   * box that is not shown.
   */
  function acknowledgementLabel(): string | null {
    switch (disclosure.status) {
      // Nothing is claimed yet, so there is nothing to agree to.
      case 'pending':
        return null;

      case 'unreadable':
        return 'I understand this file could not be read, and that importing it may replace the passphrase and Recovery Key on this device.';

      case 'loaded':
        switch (disclosure.outcome.kind) {
          case 'unchanged':
            return null;

          case 'wrapping-reverts':
            return disclosure.outcome.change === 'passphrase'
              ? "I understand the passphrase on this device will revert to the backup's."
              : "I understand the Recovery Key on this device will revert to the backup's.";

          case 'different-vault':
            return "I understand the passphrase and Recovery Key on this device will be replaced by the backup's values.";
        }
    }
  }

  const acknowledgement = acknowledgementLabel();

  // Pending disables the confirm because the claim is not derived yet, not
  // because the import needs authorising. Showing a reassuring sentence and
  // then correcting it is the one failure worse than the fixed warning, since
  // it is the reassuring answer that flashes. Nothing else here blocks: no
  // outcome refuses to proceed and none adds an unlock gate (ADR 0068).
  const confirmDisabled =
    isConfirming ||
    disclosure.status === 'pending' ||
    (acknowledgement !== null && !isAcknowledged);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] md:max-w-md"
        data-testid="import-vault-replace-dialog"
      >
        <DialogHeader>
          <DialogTitle>Replace this device&apos;s vault?</DialogTitle>
          <DialogDescription data-testid="import-vault-replace-disclosure">
            {describeOutcome()}
          </DialogDescription>
        </DialogHeader>

        {acknowledgement !== null && (
          <div className="flex items-start gap-2">
            <Checkbox
              id={acknowledgeId}
              data-testid="import-vault-replace-acknowledge"
              checked={isAcknowledged}
              onCheckedChange={handleAcknowledgeChange}
              disabled={isConfirming}
            />
            <Label
              htmlFor={acknowledgeId}
              className="cursor-pointer text-sm font-normal leading-relaxed"
            >
              {acknowledgement}
            </Label>
          </div>
        )}

        {confirmError && (
          <p role="alert" className="text-sm text-destructive">
            {confirmError}
          </p>
        )}

        <DialogFooter className="gap-2 pt-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            data-testid="import-vault-replace-cancel"
            onClick={handleCancel}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="import-vault-replace-confirm"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {isConfirming ? 'Importing…' : 'Replace and import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
