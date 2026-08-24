'use client';

import {
  AddressRecord,
  OrganisationTypeEnum,
  PriorityEnum,
  UpdateMethodEnum,
  UsageLocationRecord,
} from '@myorganizer/core';
import { Button, ConfirmDeleteDialog, useToast } from '@myorganizer/web-ui';
import { normalizeAddresses, type VaultHandle } from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type AddAddressFormValues } from '../schemas/address';
import { addressFormValuesToRecordFields } from '../utils/addressForm';
import {
  type UsageLocationFormValues,
  usageLocationFormValuesToRecordFields,
} from '../schemas/usageLocation';
import { parseEnumValue } from '../utils/enumUtils';
import { randomId } from '../utils/randomId';
import {
  AddressDetailLoading,
  AddressDetailNotFound,
  BackToAddressesLink,
} from './AddressDetailScaffold';
import { AddressDetailsCard } from './AddressDetailsCard';
import { AddressEditDialog } from './AddressEditDialog';
import { UsageLocationDialog } from './UsageLocationDialog';
import { UsageLocationsTable } from './UsageLocationsTable';

interface AddressDetailsInnerProps {
  handle: VaultHandle;
  addressId: string;
}

function AddressDetailsInner(props: AddressDetailsInnerProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [editingAddress, setEditingAddress] = useState(false);
  const [usageLocationDialog, setUsageLocationDialog] = useState<{
    open: boolean;
    location: UsageLocationRecord | null;
  }>({ open: false, location: null });
  const [deletingLocation, setDeletingLocation] =
    useState<UsageLocationRecord | null>(null);

  const addressRecord = addresses.find((x) => x.id === props.addressId) ?? null;
  const usageLocations = useMemo(
    () => addressRecord?.usageLocations ?? [],
    [addressRecord],
  );

  const persist = useCallback(
    async (next: AddressRecord[]) => {
      try {
        await props.handle.saveEncryptedData({
          type: 'addresses',
          value: next,
        });
        setAddresses(next);
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
    [props.handle, toast],
  );

  const persistUsageLocations = useCallback(
    async (next: UsageLocationRecord[]) => {
      const nextAddresses = addresses.map((x) =>
        x.id === props.addressId ? { ...x, usageLocations: next } : x,
      );
      return persist(nextAddresses);
    },
    [addresses, props.addressId, persist],
  );

  useEffect(() => {
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) return;
      setLoading(true);
      setNotFound(false);
    });

    props.handle
      .loadDecryptedData<unknown>({
        type: 'addresses',
        defaultValue: [],
      })
      .then(async (raw) => {
        if (!isActive) return;
        const normalized = normalizeAddresses(raw);
        const found = normalized.value.find((x) => x.id === props.addressId);
        if (!found) {
          if (isActive) setNotFound(true);
          return;
        }

        if (isActive) {
          setAddresses(normalized.value);
        }

        if (normalized.changed) {
          await props.handle.saveEncryptedData({
            type: 'addresses',
            value: normalized.value,
          });
        }
      })
      .catch(() => {
        if (!isActive) return;
        toast({
          title: 'Failed to load address',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [props.addressId, props.handle, toast]);

  const handleEditAddress = useCallback(() => {
    setEditingAddress(true);
  }, []);

  const handleSaveEditAddress = useCallback(
    async (id: string, values: AddAddressFormValues) => {
      const next = addresses.map((x) =>
        x.id === id
          ? {
              ...x,
              ...addressFormValuesToRecordFields(values),
            }
          : x,
      );

      await persist(next);
      toast({
        title: 'Saved',
        description: 'Address updated (encrypted).',
      });
    },
    [addresses, persist, toast],
  );

  const handleAddLocation = useCallback(() => {
    setUsageLocationDialog({ open: true, location: null });
  }, []);

  const handleEditLocation = useCallback((location: UsageLocationRecord) => {
    setUsageLocationDialog({ open: true, location });
  }, []);

  const handleSubmitUsageLocation = useCallback(
    async (values: UsageLocationFormValues, editingId: string | null) => {
      const now = new Date().toISOString();
      const baseFields = usageLocationFormValuesToRecordFields(values);

      let updatedLocations: UsageLocationRecord[];

      if (editingId) {
        // Edit existing location
        updatedLocations = usageLocations.map((loc) =>
          loc.id === editingId
            ? {
                ...loc,
                ...baseFields,
                organisationType: parseEnumValue(
                  OrganisationTypeEnum,
                  baseFields.orgType,
                  OrganisationTypeEnum.Other,
                ),
                updateMethod: parseEnumValue(
                  UpdateMethodEnum,
                  baseFields.updateMethod,
                  UpdateMethodEnum.Online,
                ),
                priority: parseEnumValue(
                  PriorityEnum,
                  baseFields.priority,
                  PriorityEnum.Normal,
                ),
                changedAt: values.changed && !loc.changed ? now : loc.changedAt,
              }
            : loc,
        );
      } else {
        // Add new location
        const next: UsageLocationRecord = {
          id: randomId(),
          ...baseFields,
          organisationType: parseEnumValue(
            OrganisationTypeEnum,
            baseFields.orgType,
            OrganisationTypeEnum.Other,
          ),
          updateMethod: parseEnumValue(
            UpdateMethodEnum,
            baseFields.updateMethod,
            UpdateMethodEnum.Online,
          ),
          priority: parseEnumValue(
            PriorityEnum,
            baseFields.priority,
            PriorityEnum.Normal,
          ),
          createdAt: now,
          changedAt: values.changed ? now : undefined,
        };
        updatedLocations = [next, ...usageLocations];
      }

      await persistUsageLocations(updatedLocations);
      toast({
        title: editingId ? 'Updated' : 'Saved',
        description: editingId
          ? 'Usage location updated successfully (encrypted).'
          : 'Usage location saved (encrypted).',
      });
    },
    [usageLocations, persistUsageLocations, toast],
  );

  const handleRequestDeleteLocation = useCallback(
    (location: UsageLocationRecord) => {
      setDeletingLocation(location);
    },
    [],
  );

  const handleConfirmDeleteLocation = useCallback(async () => {
    if (!deletingLocation) return;
    try {
      const updatedLocations = usageLocations.filter(
        (l) => l.id !== deletingLocation.id,
      );
      await persistUsageLocations(updatedLocations);
      toast({
        title: 'Deleted',
        description: 'Usage location deleted successfully.',
      });
      setDeletingLocation(null);
    } catch {
      // persist already toasted; leave dialog open for retry
    }
  }, [deletingLocation, usageLocations, persistUsageLocations, toast]);

  const handleDeleteLocationDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeletingLocation(null);
    }
  }, []);

  const handleUsageLocationDialogOpenChange = useCallback((_open: boolean) => {
    // Always close when called (Radix Dialog calls this with false on dismiss)
    setUsageLocationDialog({ open: false, location: null });
  }, []);

  if (loading) {
    return <AddressDetailLoading />;
  }

  if (notFound || !addressRecord) {
    return <AddressDetailNotFound />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <BackToAddressesLink />

      <AddressDetailsCard
        addressRecord={addressRecord}
        onEdit={handleEditAddress}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usage Locations</h2>
        <Button onClick={handleAddLocation} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      </div>

      <UsageLocationsTable
        usageLocations={usageLocations}
        onEdit={handleEditLocation}
        onRequestDelete={handleRequestDeleteLocation}
        onAddLocation={handleAddLocation}
      />

      <AddressEditDialog
        open={editingAddress}
        address={addressRecord}
        items={addresses}
        onOpenChange={setEditingAddress}
        onSave={handleSaveEditAddress}
      />

      <UsageLocationDialog
        open={usageLocationDialog.open}
        location={usageLocationDialog.location}
        existingLocations={usageLocations}
        onOpenChange={handleUsageLocationDialogOpenChange}
        onSubmit={handleSubmitUsageLocation}
      />

      <ConfirmDeleteDialog
        open={deletingLocation !== null}
        onOpenChange={handleDeleteLocationDialogOpenChange}
        title={
          deletingLocation
            ? `Delete "${deletingLocation.organisationName}"?`
            : ''
        }
        description="This action cannot be undone. This usage location will be permanently removed from this address."
        onConfirm={handleConfirmDeleteLocation}
      />
    </div>
  );
}

export function AddressDetailPageClient(props: { params: { id: string } }) {
  return (
    <VaultGate title="Address">
      {({ handle }) => (
        <AddressDetailsInner handle={handle!} addressId={props.params.id} />
      )}
    </VaultGate>
  );
}
