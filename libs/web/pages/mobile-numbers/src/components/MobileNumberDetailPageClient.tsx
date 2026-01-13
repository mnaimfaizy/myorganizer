'use client';

import { UsageLocationRecord } from '@myorganizer/core';
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
import { UsageLocationsCard } from './UsageLocationsCard';

function MobileNumberDetailsInner(props: {
  masterKeyBytes: Uint8Array;
  mobileNumberId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [label, setLabel] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [usageLocations, setUsageLocations] = useState<UsageLocationRecord[]>(
    []
  );

  useEffect(() => {
    setLoading(true);
    setNotFound(false);

    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'mobileNumbers',
      defaultValue: [],
    })
      .then(async (raw) => {
        const normalized = normalizeMobileNumbers(raw);
        const found = normalized.value.find(
          (x) => x.id === props.mobileNumberId
        );
        if (!found) {
          setNotFound(true);
          return;
        }

        setLabel(found.label);
        setMobileNumber(found.mobileNumber);
        setUsageLocations(found.usageLocations);

        if (normalized.changed) {
          await saveEncryptedData({
            masterKeyBytes: props.masterKeyBytes,
            type: 'mobileNumbers',
            value: normalized.value,
          });
        }
      })
      .catch(() => {
        toast({
          title: 'Failed to load mobile number',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [props.masterKeyBytes, props.mobileNumberId, toast]);

  if (loading) {
    return <MobileNumberDetailLoading />;
  }

  if (notFound) {
    return <MobileNumberDetailNotFound />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <BackToMobileNumbersLink />

      <MobileNumberDetailsCard label={label} mobileNumber={mobileNumber} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usage Locations</h2>
        <Button
          onClick={() =>
            router.push(
              `/dashboard/mobile-numbers/${props.mobileNumberId}/add-location`
            )
          }
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      </div>

      <UsageLocationsCard usageLocations={usageLocations} />
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
