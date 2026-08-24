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
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  addMobileNumberSchema,
  type AddMobileNumberFormValues,
  MOBILE_NUMBER_FORM_DEFAULTS,
} from '../schemas/mobileNumber';
import { MobileNumberFormFields } from './MobileNumberFormFields';

interface AddMobileNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (values: AddMobileNumberFormValues) => Promise<void>;
}

export function AddMobileNumberDialog({
  open,
  onOpenChange,
  onAdd,
}: AddMobileNumberDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AddMobileNumberFormValues>({
    resolver: zodResolver(addMobileNumberSchema),
    defaultValues: MOBILE_NUMBER_FORM_DEFAULTS,
    mode: 'onChange',
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;

    form.reset(MOBILE_NUMBER_FORM_DEFAULTS);
  }, [open, form]);

  const handleSubmit = useCallback(
    async (formValues: AddMobileNumberFormValues) => {
      setIsSaving(true);
      try {
        await onAdd(formValues);
        onOpenChange(false);
      } catch {
        // onAdd rejection means save failed; dialog stays open for retry
      } finally {
        setIsSaving(false);
      }
    },
    [onAdd, onOpenChange],
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  const handleLabelChange = useCallback(
    (value: string) => {
      form.setValue('label', value, { shouldValidate: true });
    },
    [form],
  );

  const handleCountryCodeChange = useCallback(
    (value: string) => {
      form.setValue('countryCode', value, { shouldValidate: true });
    },
    [form],
  );

  const handlePhoneNumberChange = useCallback(
    (value: string) => {
      form.setValue('phoneNumber', value, { shouldValidate: true });
    },
    [form],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSaving}
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Add mobile number</DialogTitle>
          <DialogDescription>
            Add a private mobile number to your encrypted vault.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <MobileNumberFormFields
            label={form.watch('label')}
            countryCode={form.watch('countryCode')}
            phoneNumber={form.watch('phoneNumber')}
            fieldErrors={{
              label: form.formState.errors.label?.message,
              countryCode: form.formState.errors.countryCode?.message,
              phoneNumber: form.formState.errors.phoneNumber?.message,
            }}
            onLabelChange={handleLabelChange}
            onCountryCodeChange={handleCountryCodeChange}
            onPhoneNumberChange={handlePhoneNumberChange}
          />

          <DialogFooter className="mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.formState.isValid || isSaving}
            >
              {isSaving ? 'Adding...' : 'Add mobile number'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
