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

import {
  AddAddressFormValues,
  addressFormValuesToRecordFields,
} from '../utils/addressForm';
import { randomId } from '../utils/randomId';
import { AddAddressCard } from './AddAddressCard';
import { AddressListCard } from './AddressListCard';

function AddressesInner(props: { masterKeyBytes: Uint8Array }) {
  const { toast } = useToast();

  const [items, setItems] = useState<AddressRecord[]>([]);
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);

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
      throw e;
    }
  }

  async function handleAddAddress(
    values: AddAddressFormValues,
  ): Promise<AddressRecord> {
    const nextItem: AddressRecord = {
      id: randomId(),
      ...addressFormValuesToRecordFields(values),
      status: AddressStatusEnum.Current,
      usageLocations: [],
      createdAt: new Date().toISOString(),
    };

    await persist([nextItem, ...items]);
    toast({
      title: 'Saved',
      description: 'Address saved (encrypted).',
    });

    return nextItem;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <AddAddressCard
        open={isAddAddressOpen}
        items={items}
        onOpenChange={setIsAddAddressOpen}
        onAdd={handleAddAddress}
      />

      <AddressListCard
        items={items}
        onAddAddress={() => setIsAddAddressOpen(true)}
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
