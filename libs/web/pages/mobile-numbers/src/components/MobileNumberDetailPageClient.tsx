'use client';

import { MobileNumberRecord, UsageLocationRecord } from '@myorganizer/core';
import { Button, useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeMobileNumbers,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Plus } from 'lucide-react';

import {
  BackToMobileNumbersLink,
  MobileNumberDetailLoading,
  MobileNumberDetailNotFound,
} from './MobileNumberDetailScaffold';
import { MobileNumberDetailsCard } from './MobileNumberDetailsCard';
import { UsageLocationsTable } from './UsageLocationsTable';

function MobileNumberDetailsInner(props: {
  masterKeyBytes: Uint8Array;
  mobileNumberId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [mobileNumberRecord, setMobileNumberRecord] =
    useState<MobileNumberRecord | null>(null);
  const [usageLocations, setUsageLocations] = useState<UsageLocationRecord[]>(
    [],
  );

  useEffect(() => {
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) return;
      setLoading(true);
      setNotFound(false);
    });

    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
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

        if (isActive) {
          setMobileNumberRecord(found);
          setUsageLocations(found.usageLocations);
        }

        if (normalized.changed) {
          await saveEncryptedData({
            masterKeyBytes: props.masterKeyBytes,
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
  }, [props.masterKeyBytes, props.mobileNumberId, toast]);

  async function handleDeleteLocation(locationId: string) {
    try {
      const updatedLocations = usageLocations.filter(
        (l) => l.id !== locationId,
      );

      const raw = await loadDecryptedData<unknown>({
        masterKeyBytes: props.masterKeyBytes,
        type: 'mobileNumbers',
        defaultValue: [],
      });

      const normalized = normalizeMobileNumbers(raw);
      const nextMobileNumbers = normalized.value.map((x) =>
        x.id === props.mobileNumberId
          ? { ...x, usageLocations: updatedLocations }
          : x,
      );

      await saveEncryptedData({
        masterKeyBytes: props.masterKeyBytes,
        type: 'mobileNumbers',
        value: nextMobileNumbers,
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
      `/dashboard/mobile-numbers/${props.mobileNumberId}/add-location?edit=${location.id}`,
    );
  }

  if (loading) {
    return <MobileNumberDetailLoading />;
  }

  if (notFound || !mobileNumberRecord) {
    return <MobileNumberDetailNotFound />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <BackToMobileNumbersLink />

      <MobileNumberDetailsCard mobileNumberRecord={mobileNumberRecord} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usage Locations</h2>
        <Button
          onClick={() =>
            router.push(
              `/dashboard/mobile-numbers/${props.mobileNumberId}/add-location`,
            )
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

export function MobileNumberDetailPageClient(props: {
  params: { id: string };
}) {
  return (
    <VaultGate title="Mobile Number">
      {({ masterKeyBytes }) => (
        <MobileNumberDetailsInner
          masterKeyBytes={masterKeyBytes}
          mobileNumberId={props.params.id}
        />
      )}
    </VaultGate>
  );
}
