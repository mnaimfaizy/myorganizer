'use client';

import { AddressRecord } from '@myorganizer/core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
} from '@myorganizer/web-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  addAddressSchema,
  type AddAddressFormValues,
} from '../schemas/address';
import {
  findDuplicateAddress,
  countryNameToCode,
  getDefaultAddressCountryCode,
} from '../utils/addressForm';
import { AddAddressFormFields } from './AddAddressFormFields';
import { AddressDuplicateWarning } from './AddressDuplicateWarning';

interface AddressEditDialogProps {
  open: boolean;
  /** The address being edited; null renders nothing */
  address: AddressRecord | null;
  /** All addresses, for duplicate detection (the edited record excludes itself) */
  items: AddressRecord[];
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, values: AddAddressFormValues) => Promise<void>;
}

interface AddressEditDialogFormProps {
  open: boolean;
  address: AddressRecord;
  items: AddressRecord[];
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, values: AddAddressFormValues) => Promise<void>;
}

function AddressEditDialogForm({
  open,
  address,
  items,
  onOpenChange,
  onSave,
}: AddressEditDialogFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const defaultValues = useMemo(
    () => ({
      label: '',
      propertyNumber: '',
      street: '',
      suburb: '',
      state: '',
      zipCode: '',
      countryCode: getDefaultAddressCountryCode(),
    }),
    [],
  );

  const form = useForm<AddAddressFormValues>({
    resolver: zodResolver(addAddressSchema),
    defaultValues,
    mode: 'onChange',
  });

  const values = form.watch();
  const duplicateAddress = findDuplicateAddress(values, items, address.id);

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;

    form.reset({
      label: address.label,
      propertyNumber: address.propertyNumber ?? '',
      street: address.street ?? '',
      suburb: address.suburb ?? '',
      state: address.state ?? '',
      zipCode: address.zipCode ?? '',
      countryCode:
        countryNameToCode(address.country) ?? getDefaultAddressCountryCode(),
    });
    setAcknowledged(false);
  }, [open, address, form]);

  // Reset acknowledgement when fingerprint changes
  useEffect(() => {
    setAcknowledged(false);
  }, [
    values.label,
    values.propertyNumber,
    values.street,
    values.suburb,
    values.state,
    values.zipCode,
    values.countryCode,
  ]);

  const handleSubmit = useCallback(
    async (formValues: AddAddressFormValues) => {
      const matchingAddress = findDuplicateAddress(
        formValues,
        items,
        address.id,
      );
      if (matchingAddress && !acknowledged) {
        setAcknowledged(true);
        return;
      }

      setIsSaving(true);
      try {
        await onSave(address.id, formValues);
        onOpenChange(false);
      } catch {
        // onSave rejection means save failed; dialog stays open for retry
      } finally {
        setIsSaving(false);
      }
    },
    [address.id, items, acknowledged, onSave, onOpenChange],
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSaving}
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Edit address</DialogTitle>
          <DialogDescription>
            Update your address details in your encrypted vault.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <AddAddressFormFields control={form.control} />

            <AddressDuplicateWarning
              duplicateAddress={duplicateAddress}
              acknowledged={acknowledged}
            />

            <DialogFooter>
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
                {duplicateAddress && !acknowledged
                  ? 'Review duplicate'
                  : isSaving
                    ? 'Saving...'
                    : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function AddressEditDialog({
  open,
  address,
  items,
  onOpenChange,
  onSave,
}: AddressEditDialogProps) {
  if (!address) {
    return null;
  }

  return (
    <AddressEditDialogForm
      open={open}
      address={address}
      items={items}
      onOpenChange={onOpenChange}
      onSave={onSave}
    />
  );
}
