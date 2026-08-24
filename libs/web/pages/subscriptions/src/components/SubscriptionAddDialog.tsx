'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@myorganizer/web-ui';
import { useCallback, useState } from 'react';
import { SubscriptionForm } from './SubscriptionForm';
import type { SubscriptionFormValues } from '../schemas/subscription';

interface SubscriptionAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: SubscriptionFormValues) => Promise<void>;
}

export function SubscriptionAddDialog({
  isOpen,
  onClose,
  onSubmit,
}: SubscriptionAddDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(
    async (values: SubscriptionFormValues) => {
      setIsSaving(true);
      try {
        await onSubmit(values);
        onClose();
      } catch {
        // onSubmit rejection means save failed; dialog stays open for retry
      } finally {
        setIsSaving(false);
      }
    },
    [onSubmit, onClose],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isSaving}>
        <DialogHeader>
          <DialogTitle>Add Subscription</DialogTitle>
          <DialogDescription>Create a new subscription</DialogDescription>
        </DialogHeader>
        <SubscriptionForm
          onSubmit={handleSubmit}
          submitLabel="Add Subscription"
          mode="add"
        />
      </DialogContent>
    </Dialog>
  );
}
