'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@myorganizer/web-ui';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface DeleteListConfirmDialogProps {
  isOpen: boolean;
  listName: string;
  itemCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export function DeleteListConfirmDialog({
  isOpen,
  listName,
  itemCount,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteListConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-error/10 p-3">
              <AlertTriangle className="h-6 w-6 text-error" />
            </div>
          </div>
          <DialogTitle>Delete "{listName}"?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Deleting this list will permanently
            remove{' '}
            <span className="font-semibold text-on-surface">{itemCount}</span>{' '}
            {itemCount === 1 ? 'item' : 'items'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg bg-error/5 p-3">
          <p className="text-sm font-medium text-error">Warning</p>
          <p className="text-xs text-on-surface-variant">
            All items in this list, including their notes, images, and links,
            will be deleted permanently.
          </p>
        </div>

        <DialogFooter className="gap-2 pt-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={confirming || isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={confirming || isLoading}
          >
            {confirming || isLoading ? 'Deleting...' : 'Delete List'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
