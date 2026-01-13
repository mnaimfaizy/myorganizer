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
  label: z.string().trim().min(1),
  address: z.string().trim().min(1),
});

type AddAddressFormValues = z.infer<typeof addAddressSchema>;

function AddressesInner(props: { masterKeyBytes: Uint8Array }) {
  const { toast } = useToast();

  const [items, setItems] = useState<AddressRecord[]>([]);

  const addForm = useForm<AddAddressFormValues>({
    resolver: zodResolver(addAddressSchema),
    defaultValues: {
      label: 'Home',
      address: '',
    },
    mode: 'onChange',
  });

  const label = addForm.watch('label');
  const address = addForm.watch('address');
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
        address={address}
        canAdd={canAdd}
        onLabelChange={(value) =>
          addForm.setValue('label', value, { shouldValidate: true })
        }
        onAddressChange={(value) =>
          addForm.setValue('address', value, { shouldValidate: true })
        }
        onAdd={addForm.handleSubmit(async (values) => {
          const nextItem: AddressRecord = {
            id: randomId(),
            label: values.label.trim(),
            address: values.address.trim(),
            status: AddressStatusEnum.Current,
            usageLocations: [],
            createdAt: new Date().toISOString(),
          };
          await persist([nextItem, ...items]);
          addForm.reset({
            label: values.label,
            address: '',
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
