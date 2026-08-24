'use client';

import { AddressRecord, AddressStatusEnum } from '@myorganizer/core';
import { ConfirmDeleteDialog, useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeAddresses,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useCallback, useEffect, useState } from 'react';

import { type AddAddressFormValues } from '../schemas/address';
import { addressFormValuesToRecordFields } from '../utils/addressForm';
import { randomId } from '../utils/randomId';
import { AddAddressCard } from './AddAddressCard';
import { AddressListCard } from './AddressListCard';

interface AddressesInnerProps {
  masterKeyBytes: Uint8Array;
}

function describeAddressDeletion(address: AddressRecord | null): string {
  if (!address) return '';
  const count = address.usageLocations.length;
  if (count === 0) {
    return 'This action cannot be undone. The address will be permanently removed.';
  } else if (count === 1) {
    return 'This action cannot be undone. The address and its 1 usage location will be permanently removed.';
  } else {
    return `This action cannot be undone. The address and its ${count} usage locations will be permanently removed.`;
  }
}

function AddressesInner(props: AddressesInnerProps) {
  const { toast } = useToast();

  const [items, setItems] = useState<AddressRecord[]>([]);
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState<AddressRecord | null>(
    null,
  );

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

  const persist = useCallback(
    async (next: AddressRecord[]) => {
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
    },
    [props.masterKeyBytes, toast],
  );

  const handleAddAddress = useCallback(
    async (values: AddAddressFormValues): Promise<AddressRecord> => {
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
    },
    [items, persist, toast],
  );

  const handleRequestDelete = useCallback((item: AddressRecord) => {
    setDeletingAddress(item);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingAddress) return;
    try {
      await persist(items.filter((x) => x.id !== deletingAddress.id));
      toast({ title: 'Deleted', description: 'Address removed.' });
      setDeletingAddress(null);
    } catch {
      // persist() already toasted the failure; leave the dialog open for retry
    }
  }, [deletingAddress, items, persist, toast]);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeletingAddress(null);
    }
  }, []);

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
        onRequestDelete={handleRequestDelete}
      />

      <ConfirmDeleteDialog
        open={deletingAddress !== null}
        onOpenChange={handleDeleteDialogOpenChange}
        title={deletingAddress ? `Delete "${deletingAddress.label}"?` : ''}
        description={describeAddressDeletion(deletingAddress)}
        onConfirm={handleConfirmDelete}
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
