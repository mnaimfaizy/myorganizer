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

export interface ImportVaultReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Carry out the import-replace. Only enabled once the User has checked the acknowledgement box. Parent handles the actual import/toast. May throw; the dialog shows the error and stays open. */
  onConfirm: () => Promise<void>;
  /** Decline. Nothing is written. Parent toasts "Import canceled" if it wants that copy. */
  onDecline: () => void;
}

export function ImportVaultReplaceDialog({
  open,
  onOpenChange,
  onConfirm,
  onDecline,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] md:max-w-md"
        data-testid="import-vault-replace-dialog"
      >
        <DialogHeader>
          <DialogTitle>Replace this device&apos;s vault?</DialogTitle>
          <DialogDescription>
            Importing this backup replaces the Local Vault on this device. The
            passphrase and Recovery Key will be replaced by the backup&apos;s
            values. After import you will unlock with the backup&apos;s
            passphrase or Recovery Key, not the ones you use now.
          </DialogDescription>
        </DialogHeader>

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
            I understand the passphrase and Recovery Key on this device will be
            replaced by the backup&apos;s values.
          </Label>
        </div>

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
            disabled={!isAcknowledged || isConfirming}
          >
            {isConfirming ? 'Importing…' : 'Replace and import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
