'use client';

import { AddressRecord, AddressStatusEnum } from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeAddresses,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';

import { randomId } from '../utils/randomId';
import { AddAddressCard } from './AddAddressCard';
import { AddressListCard } from './AddressListCard';

const addAddressSchema = z.object({
  label: z.string().trim().min(1, 'Label is required'),
  propertyNumber: z.string().trim().optional(),
  street: z.string().trim().min(1, 'Street is required'),
  suburb: z.string().trim().min(1, 'Suburb/City is required'),
  state: z.string().trim().min(1, 'State/Province is required'),
  zipCode: z.string().trim().min(1, 'Zip/Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

type AddAddressFormValues = z.infer<typeof addAddressSchema>;

function AddressesInner(props: { masterKeyBytes: Uint8Array }) {
  const { toast } = useToast();

  const [items, setItems] = useState<AddressRecord[]>([]);

  const addForm = useForm<AddAddressFormValues>({
    resolver: zodResolver(addAddressSchema),
    defaultValues: {
      label: 'Home',
      propertyNumber: '',
      street: '',
      suburb: '',
      state: '',
      zipCode: '',
      country: '',
    },
    mode: 'onChange',
  });

  const label = addForm.watch('label');
  const propertyNumber = addForm.watch('propertyNumber');
  const street = addForm.watch('street');
  const suburb = addForm.watch('suburb');
  const state = addForm.watch('state');
  const zipCode = addForm.watch('zipCode');
  const country = addForm.watch('country');
  const canAdd = addForm.formState.isValid;

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'addresses',
      defaultValue: [],
    })
      .then(async (raw) => {
        const normalized = normalizeAddresses(raw);
        setItems(normalized.value);
        if (normalized.changed) {
          await saveEncryptedData({
            masterKeyBytes: props.masterKeyBytes,
            type: 'addresses',
            value: normalized.value,
          });
        }
      })
      .catch(() => {
        toast({
          title: 'Failed to load addresses',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      });
  }, [props.masterKeyBytes, toast]);

  async function persist(next: AddressRecord[]) {
    setItems(next);
    try {
      await saveEncryptedData({
        masterKeyBytes: props.masterKeyBytes,
        type: 'addresses',
        value: next,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast({
        title: 'Failed to save',
        description: message,
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <AddAddressCard
        label={label}
        propertyNumber={propertyNumber}
        street={street}
        suburb={suburb}
        state={state}
        zipCode={zipCode}
        country={country}
        canAdd={canAdd}
        onLabelChange={(value) =>
          addForm.setValue('label', value, { shouldValidate: true })
        }
        onPropertyNumberChange={(value) =>
          addForm.setValue('propertyNumber', value, { shouldValidate: true })
        }
        onStreetChange={(value) =>
          addForm.setValue('street', value, { shouldValidate: true })
        }
        onSuburbChange={(value) =>
          addForm.setValue('suburb', value, { shouldValidate: true })
        }
        onStateChange={(value) =>
          addForm.setValue('state', value, { shouldValidate: true })
        }
        onZipCodeChange={(value) =>
          addForm.setValue('zipCode', value, { shouldValidate: true })
        }
        onCountryChange={(value) =>
          addForm.setValue('country', value, { shouldValidate: true })
        }
        onAdd={addForm.handleSubmit(async (values) => {
          const nextItem: AddressRecord = {
            id: randomId(),
            label: values.label.trim(),
            propertyNumber: values.propertyNumber?.trim() || undefined,
            street: values.street.trim(),
            suburb: values.suburb.trim(),
            state: values.state.trim(),
            zipCode: values.zipCode.trim(),
            country: values.country,
            status: AddressStatusEnum.Current,
            usageLocations: [],
            createdAt: new Date().toISOString(),
          };
          await persist([nextItem, ...items]);
          addForm.reset({
            label: values.label,
            propertyNumber: '',
            street: '',
            suburb: '',
            state: '',
            zipCode: '',
            country: '',
          });
          toast({
            title: 'Saved',
            description: 'Address saved (encrypted).',
          });
        })}
      />

      <AddressListCard
        items={items}
        onDelete={async (id) => {
          const next = items.filter((x) => x.id !== id);
          await persist(next);
          toast({
            title: 'Deleted',
            description: 'Address removed.',
          });
        }}
      />
    </div>
  );
}

export function AddressesPageClient() {
  return (
    <VaultGate title="Addresses">
      {({ masterKeyBytes }) => (
        <AddressesInner masterKeyBytes={masterKeyBytes} />
      )}
    </VaultGate>
  );
}
