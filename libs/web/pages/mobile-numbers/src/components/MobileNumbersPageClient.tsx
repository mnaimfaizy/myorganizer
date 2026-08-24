'use client';

import { MobileNumberRecord } from '@myorganizer/core';
import { ConfirmDeleteDialog, useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeMobileNumbers,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useCallback, useEffect, useState } from 'react';

import { type AddMobileNumberFormValues } from '../schemas/mobileNumber';
import { mobileNumberFormValuesToRecordFields } from '../schemas/mobileNumber';
import { randomId } from '../utils/randomId';
import { AddMobileNumberDialog } from './AddMobileNumberDialog';
import { MobileNumberListCard } from './MobileNumberListCard';

interface MobileNumbersInnerProps {
  masterKeyBytes: Uint8Array;
}

function describeMobileNumberDeletion(
  mobileNumber: MobileNumberRecord | null,
): string {
  if (!mobileNumber) return '';
  const count = mobileNumber.usageLocations.length;
  if (count === 0) {
    return 'This action cannot be undone. The mobile number will be permanently removed.';
  } else if (count === 1) {
    return 'This action cannot be undone. The mobile number and its 1 usage location will be permanently removed.';
  } else {
    return `This action cannot be undone. The mobile number and its ${count} usage locations will be permanently removed.`;
  }
}

function MobileNumbersInner(props: MobileNumbersInnerProps) {
  const { toast } = useToast();

  const [items, setItems] = useState<MobileNumberRecord[]>([]);
  const [isAddMobileNumberOpen, setIsAddMobileNumberOpen] = useState(false);
  const [deletingMobileNumber, setDeletingMobileNumber] =
    useState<MobileNumberRecord | null>(null);

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'mobileNumbers',
      defaultValue: [],
    })
      .then(async (raw) => {
        const normalized = normalizeMobileNumbers(raw);
        setItems(normalized.value);
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
          title: 'Failed to load mobile numbers',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      });
  }, [props.masterKeyBytes, toast]);

  const persist = useCallback(
    async (next: MobileNumberRecord[]) => {
      setItems(next);
      try {
        await saveEncryptedData({
          masterKeyBytes: props.masterKeyBytes,
          type: 'mobileNumbers',
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

  const handleAddMobileNumber = useCallback(
    async (values: AddMobileNumberFormValues): Promise<void> => {
      const nextItem: MobileNumberRecord = {
        id: randomId(),
        ...mobileNumberFormValuesToRecordFields(values),
        usageLocations: [],
        createdAt: new Date().toISOString(),
      };

      await persist([nextItem, ...items]);
      toast({
        title: 'Saved',
        description: 'Mobile number saved (encrypted).',
      });
    },
    [items, persist, toast],
  );

  const handleRequestDelete = useCallback((item: MobileNumberRecord) => {
    setDeletingMobileNumber(item);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingMobileNumber) return;
    try {
      await persist(items.filter((x) => x.id !== deletingMobileNumber.id));
      toast({ title: 'Deleted', description: 'Mobile number removed.' });
      setDeletingMobileNumber(null);
    } catch {
      // persist() already toasted the failure; leave the dialog open for retry
    }
  }, [deletingMobileNumber, items, persist, toast]);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeletingMobileNumber(null);
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <AddMobileNumberDialog
        open={isAddMobileNumberOpen}
        onOpenChange={setIsAddMobileNumberOpen}
        onAdd={handleAddMobileNumber}
      />

      <MobileNumberListCard
        items={items}
        onAddMobileNumber={() => setIsAddMobileNumberOpen(true)}
        onRequestDelete={handleRequestDelete}
      />

      <ConfirmDeleteDialog
        open={deletingMobileNumber !== null}
        onOpenChange={handleDeleteDialogOpenChange}
        title={
          deletingMobileNumber ? `Delete "${deletingMobileNumber.label}"?` : ''
        }
        description={describeMobileNumberDeletion(deletingMobileNumber)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export function MobileNumbersPageClient() {
  return (
    <VaultGate title="Mobile Numbers">
      {({ masterKeyBytes }) => (
        <MobileNumbersInner masterKeyBytes={masterKeyBytes} />
      )}
    </VaultGate>
  );
}
