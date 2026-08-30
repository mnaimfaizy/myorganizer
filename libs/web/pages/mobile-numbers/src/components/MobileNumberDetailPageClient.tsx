'use client';

import {
  MobileNumberRecord,
  OrganisationTypeEnum,
  PriorityEnum,
  UpdateMethodEnum,
  UsageLocationRecord,
} from '@myorganizer/core';
import { Button, ConfirmDeleteDialog, useToast } from '@myorganizer/web-ui';
import {
  normalizeMobileNumbers,
  type VaultHandle,
} from '@myorganizer/web-vault';
import { useLocalVaultRevision, VaultGate } from '@myorganizer/web-vault-ui';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type AddMobileNumberFormValues } from '../schemas/mobileNumber';
import { mobileNumberFormValuesToRecordFields } from '../schemas/mobileNumber';
import {
  type UsageLocationFormValues,
  usageLocationFormValuesToRecordFields,
} from '../schemas/usageLocation';
import { parseEnumValue } from '../utils/enumUtils';
import { randomId } from '../utils/randomId';
import {
  BackToMobileNumbersLink,
  MobileNumberDetailLoading,
  MobileNumberDetailNotFound,
} from './MobileNumberDetailScaffold';
import { MobileNumberDetailsCard } from './MobileNumberDetailsCard';
import { MobileNumberEditDialog } from './MobileNumberEditDialog';
import { UsageLocationDialog } from './UsageLocationDialog';
import { UsageLocationsTable } from './UsageLocationsTable';

interface MobileNumberDetailsInnerProps {
  handle: VaultHandle;
  mobileNumberId: string;
}

function MobileNumberDetailsInner(props: MobileNumberDetailsInnerProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mobileNumbers, setMobileNumbers] = useState<MobileNumberRecord[]>([]);
  const [editingMobileNumber, setEditingMobileNumber] = useState(false);
  const [usageLocationDialog, setUsageLocationDialog] = useState<{
    open: boolean;
    location: UsageLocationRecord | null;
  }>({ open: false, location: null });
  const [deletingLocation, setDeletingLocation] =
    useState<UsageLocationRecord | null>(null);

  const mobileNumberRecord =
    mobileNumbers.find((x) => x.id === props.mobileNumberId) ?? null;
  const usageLocations = useMemo(
    () => mobileNumberRecord?.usageLocations ?? [],
    [mobileNumberRecord],
  );

  const persist = useCallback(
    async (next: MobileNumberRecord[]) => {
      try {
        await props.handle.saveEncryptedData({
          type: 'mobileNumbers',
          value: next,
        });
        setMobileNumbers(next);
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
      const nextMobileNumbers = mobileNumbers.map((x) =>
        x.id === props.mobileNumberId ? { ...x, usageLocations: next } : x,
      );
      return persist(nextMobileNumbers);
    },
    [mobileNumbers, props.mobileNumberId, persist],
  );

  // Which record the loading view has already been shown for. A reload is
  // not a first load, and only a first load may blank the page.
  const loadedKeyRef = useRef<string | null>(null);
  const loadKey = props.mobileNumberId;

  // Convergence replaces the Local Vault without passing through this
  // component, so the revision is the only thing that says the Ciphertext
  // behind this record moved. Saving here rewrites the whole list, so a stale
  // read is what gets written back over the record that arrived (#587).
  const revision = useLocalVaultRevision();

  useEffect(() => {
    let isActive = true;

    // A reload triggered by convergence must not put the page back into its
    // loading state. The render returns the loading view while `loading` is
    // true, which unmounts every open dialog — edit, usage location, confirm
    // delete — and throws away whatever the User was typing in it. Only a
    // first load, or a move to a different record, earns that.
    const isFirstLoad = loadedKeyRef.current !== loadKey;
    loadedKeyRef.current = loadKey;

    if (isFirstLoad) {
      queueMicrotask(() => {
        if (!isActive) return;
        setLoading(true);
        setNotFound(false);
      });
    }

    props.handle
      .loadDecryptedData<unknown>({
        type: 'mobileNumbers',
        defaultValue: [],
      })
      .then(async (raw) => {
        if (!isActive) return;
        const normalized = normalizeMobileNumbers(raw);
        const found = normalized.value.find(
          (x) => x.id === props.mobileNumberId,
        );
        if (!found) {
          if (isActive) setNotFound(true);
          return;
        }
        // Recomputed on every read rather than only cleared up front, because
        // a reload no longer resets it — a record that convergence brought
        // back must stop reading as not found.
        if (isActive) setNotFound(false);

        if (isActive) {
          setMobileNumbers(normalized.value);
        }

        if (normalized.changed) {
          await props.handle.saveEncryptedData({
            type: 'mobileNumbers',
            value: normalized.value,
          });
        }
      })
      .catch(() => {
        if (!isActive) return;
        toast({
          title: 'Failed to load mobile number',
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
  }, [props.mobileNumberId, props.handle, toast, revision]);

  const handleEditMobileNumber = useCallback(() => {
    setEditingMobileNumber(true);
  }, []);

  const handleSaveEditMobileNumber = useCallback(
    async (id: string, values: AddMobileNumberFormValues) => {
      const next = mobileNumbers.map((x) =>
        x.id === id
          ? {
              ...x,
              ...mobileNumberFormValuesToRecordFields(values),
            }
          : x,
      );

      await persist(next);
      toast({
        title: 'Saved',
        description: 'Mobile number updated (encrypted).',
      });
    },
    [mobileNumbers, persist, toast],
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
    return <MobileNumberDetailLoading />;
  }

  if (notFound || !mobileNumberRecord) {
    return <MobileNumberDetailNotFound />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <BackToMobileNumbersLink />

      <MobileNumberDetailsCard
        mobileNumberRecord={mobileNumberRecord}
        onEdit={handleEditMobileNumber}
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

      <MobileNumberEditDialog
        open={editingMobileNumber}
        mobileNumber={mobileNumberRecord}
        onOpenChange={setEditingMobileNumber}
        onSave={handleSaveEditMobileNumber}
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
        description="This action cannot be undone. This usage location will be permanently removed from this mobile number."
        onConfirm={handleConfirmDeleteLocation}
      />
    </div>
  );
}

export function MobileNumberDetailPageClient(props: {
  params: { id: string };
}) {
  return (
    <VaultGate title="Mobile Number">
      {({ handle }) => (
        <MobileNumberDetailsInner
          handle={handle!}
          mobileNumberId={props.params.id}
        />
      )}
    </VaultGate>
  );
}
