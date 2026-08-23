'use client';

import type { SubscriptionRecord } from '@myorganizer/core';
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
import { isoToDateInput } from '../utils/date';

interface SubscriptionEditDialogProps {
  subscription: SubscriptionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, values: SubscriptionFormValues) => Promise<void>;
}

export function SubscriptionEditDialog({
  subscription,
  isOpen,
  onClose,
  onSave,
}: SubscriptionEditDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(
    async (values: SubscriptionFormValues) => {
      if (!subscription) return;
      setIsSaving(true);
      try {
        await onSave(subscription.id, values);
        onClose();
      } catch {
        // onSave rejection means save failed; dialog stays open for retry
      } finally {
        setIsSaving(false);
      }
    },
    [subscription, onSave, onClose],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  if (!subscription) {
    return null;
  }

  const initialValues: Partial<SubscriptionFormValues> = {
    name: subscription.name,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    amount: subscription.amount,
    currency: subscription.currency,
    paymentMethod: subscription.paymentMethod,
    renewalType: subscription.renewalType,
    tier: subscription.tier,
    startDate: isoToDateInput(subscription.startDate),
    endDate: isoToDateInput(subscription.endDate),
    nextBillingDate: isoToDateInput(subscription.nextBillingDate),
    link: subscription.link ?? '',
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isSaving}>
        <DialogHeader>
          <DialogTitle>Edit Subscription</DialogTitle>
          <DialogDescription>
            Update the subscription details below
          </DialogDescription>
        </DialogHeader>
        <SubscriptionForm
          initialValues={initialValues}
          onSubmit={handleSave}
          submitLabel="Save"
          mode="edit"
        />
      </DialogContent>
    </Dialog>
  );
}
