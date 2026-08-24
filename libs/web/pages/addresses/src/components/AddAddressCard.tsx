import { zodResolver } from '@hookform/resolvers/zod';
import { AddressRecord } from '@myorganizer/core';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@myorganizer/web-ui';
import { MapPinned } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  type AddAddressFormValues,
  addAddressSchema,
} from '../schemas/address';
import {
  buildAddressFingerprint,
  createAddressPreview,
  findDuplicateAddress,
  getDefaultAddressCountryCode,
} from '../utils/addressForm';
import { AddAddressFormSection } from './AddAddressFormSection';
import { AddAddressStepBadges } from './AddAddressStepBadges';
import { AddAddressSuccessSection } from './AddAddressSuccessSection';

export interface AddAddressCardProps {
  open: boolean;
  items: AddressRecord[];
  onOpenChange: (open: boolean) => void;
  onAdd: (values: AddAddressFormValues) => Promise<AddressRecord>;
}

export function AddAddressCard({
  open,
  items,
  onOpenChange,
  onAdd,
}: AddAddressCardProps) {
  const router = useRouter();
  const defaultValues = useMemo(
    () => ({
      label: 'Home',
      propertyNumber: '',
      street: '',
      suburb: '',
      state: '',
      zipCode: '',
      countryCode: getDefaultAddressCountryCode(),
    }),
    [],
  );

  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [savedAddress, setSavedAddress] = useState<AddressRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AddAddressFormValues>({
    resolver: zodResolver(addAddressSchema),
    defaultValues,
    mode: 'onChange',
  });

  const values = form.watch();
  const preview = createAddressPreview(values);
  const duplicateAddress = findDuplicateAddress(values, items);
  const currentFingerprint = buildAddressFingerprint({
    ...preview,
    countryCode: values.countryCode,
  });

  useEffect(() => {
    if (!open) return;

    form.reset(defaultValues);
    setAllowDuplicate(false);
    setSavedAddress(null);
  }, [defaultValues, form, open]);

  useEffect(() => {
    setAllowDuplicate(false);
  }, [currentFingerprint]);

  const handleSubmit = useCallback(
    async (nextValues: AddAddressFormValues) => {
      const matchingAddress = findDuplicateAddress(nextValues, items);
      if (matchingAddress && !allowDuplicate) {
        setAllowDuplicate(true);
        return;
      }

      setIsSaving(true);
      try {
        const nextAddress = await onAdd(nextValues);
        setSavedAddress(nextAddress);
        setAllowDuplicate(false);
      } finally {
        setIsSaving(false);
      }
    },
    [allowDuplicate, items, onAdd],
  );

  const resetForAnotherAddress = useCallback(() => {
    form.reset({ ...defaultValues, label: values.label });
    setSavedAddress(null);
    setAllowDuplicate(false);
  }, [defaultValues, form, values.label]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSetUpUsageLocations = useCallback(
    (id: string) => {
      router.push(`/dashboard/addresses/${id}`);
    },
    [router],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-8">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle>Add address</SheetTitle>
              <SheetDescription>
                Create a private address record in your encrypted vault.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <AddAddressStepBadges
          hasStreet={Boolean(values.street)}
          hasDuplicate={Boolean(duplicateAddress)}
          isSaved={Boolean(savedAddress)}
        />

        {savedAddress ? (
          <AddAddressSuccessSection
            savedAddress={savedAddress}
            onSetUpUsageLocations={handleSetUpUsageLocations}
            onAddAnother={resetForAnotherAddress}
          />
        ) : (
          <AddAddressFormSection
            form={form}
            preview={preview}
            duplicateAddress={duplicateAddress}
            allowDuplicate={allowDuplicate}
            isSaving={isSaving}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
