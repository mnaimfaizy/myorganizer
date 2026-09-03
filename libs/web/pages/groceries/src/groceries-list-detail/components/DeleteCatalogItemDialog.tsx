'use client';

import type { CatalogItem } from '@myorganizer/core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@myorganizer/web-ui';
import { AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface DeleteCatalogItemDialogProps {
  isOpen: boolean;
  catalogItem: CatalogItem | null;
  affectedListCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * Strong-confirmation dialog for the "Delete From Catalog" domain action —
 * permanently destroys a Catalog Item and every List Line referencing it
 * across every Grocery List. Requires the user to type the item's exact
 * name before the destructive action becomes available.
 */
export function DeleteCatalogItemDialog({
  isOpen,
  catalogItem,
  affectedListCount,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteCatalogItemDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const [typedName, setTypedName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTypedName('');
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setTypedName('');
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    if (!catalogItem) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }, [catalogItem, onConfirm]);

  const itemName = catalogItem?.name ?? '';
  const isOpenWithItem = isOpen && catalogItem !== null;

  const affectedMessage =
    affectedListCount === 0
      ? "It isn't currently on any other Grocery List."
      : `This will also remove it from ${affectedListCount} other Grocery List${
          affectedListCount === 1 ? '' : 's'
        }.`;

  const isConfirmMatch = catalogItem !== null && typedName.trim() === itemName;

  return (
    <Dialog
      open={isOpenWithItem}
      onOpenChange={(open) => !open && handleClose()}
    >
      <DialogContent className="w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <DialogTitle>Delete "{itemName}" from Catalog?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Deleting this Catalog Item will
            permanently remove it and every List Line referencing it.{' '}
            {affectedMessage}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label
            htmlFor="delete-catalog-item-confirm"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          >
            Type "{itemName}" to confirm
          </Label>
          <Input
            id="delete-catalog-item-confirm"
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
            disabled={confirming || isLoading}
            autoComplete="off"
            className="text-base md:text-sm"
          />
        </div>

        <DialogFooter className="gap-2 pt-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={confirming || isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={confirming || isLoading || !isConfirmMatch}
          >
            {confirming || isLoading ? 'Deleting...' : 'Delete From Catalog'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
