'use client';

import { UsageLocationRecord } from '@myorganizer/core';
import { Button, useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeAddresses,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Plus } from 'lucide-react';

import {
  AddressDetailLoading,
  AddressDetailNotFound,
  BackToAddressesLink,
} from './AddressDetailScaffold';
import { AddressDetailsCard } from './AddressDetailsCard';
import { UsageLocationsTable } from './UsageLocationsTable';

function AddressDetailsInner(props: {
  masterKeyBytes: Uint8Array;
  addressId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('');
  const [usageLocations, setUsageLocations] = useState<UsageLocationRecord[]>(
    []
  );

  useEffect(() => {
    setLoading(true);
    setNotFound(false);

    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'addresses',
      defaultValue: [],
    })
      .then(async (raw) => {
        const normalized = normalizeAddresses(raw);
        const found = normalized.value.find((x) => x.id === props.addressId);
        if (!found) {
          setNotFound(true);
          return;
        }

        setLabel(found.label);
        setAddress(found.address);
        setStatus(found.status);
        setUsageLocations(found.usageLocations);

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
          title: 'Failed to load address',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [props.addressId, props.masterKeyBytes, toast]);

  async function handleDeleteLocation(locationId: string) {
    try {
      const updatedLocations = usageLocations.filter(
        (l) => l.id !== locationId
      );

      const raw = await loadDecryptedData<unknown>({
        masterKeyBytes: props.masterKeyBytes,
        type: 'addresses',
        defaultValue: [],
      });

      const normalized = normalizeAddresses(raw);
      const nextAddresses = normalized.value.map((x) =>
        x.id === props.addressId
          ? { ...x, usageLocations: updatedLocations }
          : x
      );

      await saveEncryptedData({
        masterKeyBytes: props.masterKeyBytes,
        type: 'addresses',
        value: nextAddresses,
      });

      setUsageLocations(updatedLocations);
      toast({
        title: 'Deleted',
        description: 'Usage location deleted successfully.',
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast({
        title: 'Failed to delete',
        description: message,
        variant: 'destructive',
      });
    }
  }

  function handleEditLocation(location: UsageLocationRecord) {
    router.push(
      `/dashboard/addresses/${props.addressId}/add-location?edit=${location.id}`
    );
  }

  if (loading) {
    return <AddressDetailLoading />;
  }

  if (notFound) {
    return <AddressDetailNotFound />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <BackToAddressesLink />

      <AddressDetailsCard label={label} address={address} status={status} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usage Locations</h2>
        <Button
          onClick={() =>
            router.push(`/dashboard/addresses/${props.addressId}/add-location`)
          }
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      </div>

      <UsageLocationsTable
        usageLocations={usageLocations}
        onEdit={handleEditLocation}
        onDelete={handleDeleteLocation}
      />
    </div>
  );
}

export function AddressDetailPageClient(props: { params: { id: string } }) {
  return (
    <VaultGate title="Address">
      {({ masterKeyBytes }) => (
        <AddressDetailsInner
          masterKeyBytes={masterKeyBytes}
          addressId={props.params.id}
        />
      )}
    </VaultGate>
  );
}
