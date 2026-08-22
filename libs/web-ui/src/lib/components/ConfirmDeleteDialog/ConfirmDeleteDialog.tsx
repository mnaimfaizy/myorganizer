'use client';

import * as React from 'react';
import { useCallback, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../Dialog/Dialog';
import { Button } from '../Button/Button';

interface ConfirmDeleteDialogProps {
  /** Controlled open state, owned by the caller. */
  open: boolean;
  /** Called when the dialog wants to change its open state (cancel, Escape, overlay click, close button). Never called as a side effect of confirming. */
  onOpenChange: (open: boolean) => void;
  /** Dialog title, e.g. "Delete this address?" */
  title: string;
  /** Description of exactly what will be destroyed. Accepts ReactNode so callers can bold an item name, etc. */
  description: React.ReactNode;
  /** Invoked when the user activates the confirm control. May return a Promise; the dialog disables the confirm control and shows a pending state until it resolves/rejects, then re-enables it. */
  onConfirm: () => void | Promise<void>;
}

const ConfirmDeleteDialog = React.forwardRef<
  HTMLDivElement,
  ConfirmDeleteDialogProps
>(({ open, onOpenChange, title, description, onConfirm }, ref) => {
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsPending(true);
    try {
      await onConfirm();
    } finally {
      setIsPending(false);
    }
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && !isPending) {
        onOpenChange(false);
      }
    },
    [onOpenChange, isPending],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent ref={ref} showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? 'Delete…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ConfirmDeleteDialog.displayName = 'ConfirmDeleteDialog';

export { ConfirmDeleteDialog };
