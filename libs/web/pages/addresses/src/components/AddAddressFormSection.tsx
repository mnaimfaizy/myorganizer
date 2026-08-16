'use client';

import { AddressRecord } from '@myorganizer/core';
import { Badge, Button, Form, SheetFooter } from '@myorganizer/web-ui';
import { AlertTriangle, Plus } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

import { AddAddressFormValues, createAddressPreview } from '../utils/addressForm';
import { formatAddress } from '../utils/formatAddress';
import { AddAddressFormFields } from './AddAddressFormFields';

export interface AddAddressFormSectionProps {
  form: UseFormReturn<AddAddressFormValues>;
  preview: ReturnType<typeof createAddressPreview>;
  duplicateAddress: AddressRecord | null;
  allowDuplicate: boolean;
  isSaving: boolean;
  onSubmit: (values: AddAddressFormValues) => Promise<void>;
  onCancel: () => void;
}

export function AddAddressFormSection(props: AddAddressFormSectionProps) {
  const {
    form,
    preview,
    duplicateAddress,
    allowDuplicate,
    isSaving,
    onSubmit,
    onCancel,
  } = props;

  return (
    <Form {...form}>
      <form
        className="mt-6 flex flex-1 flex-col gap-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <AddAddressFormFields control={form.control} />

        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Preview</span>
            <Badge variant="secondary">Encrypted</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatAddress({
              id: 'preview',
              status: 'current',
              usageLocations: [],
              createdAt: '',
              ...preview,
            })}
          </p>
        </div>

        {duplicateAddress && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  This looks like an existing address.
                </p>
                <p className="text-sm">
                  {duplicateAddress.label}: {formatAddress(duplicateAddress)}
                </p>
                {allowDuplicate && (
                  <p className="text-sm">
                    Select save again to keep this as a separate address.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <SheetFooter className="sticky bottom-0 mt-auto border-t bg-background pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Plus className="h-4 w-4" />
            {duplicateAddress && !allowDuplicate
              ? 'Review duplicate'
              : isSaving
                ? 'Saving...'
                : 'Save address'}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}
