'use client';

import { MobileNumberRecord } from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeMobileNumbers,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';

import { randomId } from '../utils/randomId';
import { AddMobileNumberCard } from './AddMobileNumberCard';
import { MobileNumberListCard } from './MobileNumberListCard';

const addMobileNumberSchema = z
  .object({
    label: z.string().trim().min(1, 'Label is required'),
    countryCode: z.string().min(1, 'Country code is required'),
    phoneNumber: z
      .string()
      .trim()
      .min(1, 'Phone number is required')
      .regex(
        /^[0-9\s\-\(\)]+$/,
        'Only numbers, spaces, hyphens, and parentheses allowed'
      ),
  })
  .refine(
    (data) => {
      const digits = data.phoneNumber.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    },
    {
      message: 'Phone number must be between 7 and 15 digits',
      path: ['phoneNumber'],
    }
  );

type AddMobileNumberFormValues = z.infer<typeof addMobileNumberSchema>;

function MobileNumbersInner(props: { masterKeyBytes: Uint8Array }) {
  const { toast } = useToast();

  const [items, setItems] = useState<MobileNumberRecord[]>([]);

  const addForm = useForm<AddMobileNumberFormValues>({
    resolver: zodResolver(addMobileNumberSchema),
    defaultValues: {
      label: 'Personal',
      countryCode: '+1',
      phoneNumber: '',
    },
    mode: 'onChange',
  });

  const label = addForm.watch('label');
  const countryCode = addForm.watch('countryCode');
  const phoneNumber = addForm.watch('phoneNumber');
  const canAdd = addForm.formState.isValid;

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

  async function persist(next: MobileNumberRecord[]) {
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
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <AddMobileNumberCard
        label={label}
        countryCode={countryCode}
        phoneNumber={phoneNumber}
        canAdd={canAdd}
        onLabelChange={(value) =>
          addForm.setValue('label', value, { shouldValidate: true })
        }
        onCountryCodeChange={(value) =>
          addForm.setValue('countryCode', value, { shouldValidate: true })
        }
        onPhoneNumberChange={(value) =>
          addForm.setValue('phoneNumber', value, { shouldValidate: true })
        }
        onAdd={addForm.handleSubmit(async (values) => {
          const nextItem: MobileNumberRecord = {
            id: randomId(),
            label: values.label.trim(),
            countryCode: values.countryCode,
            phoneNumber: values.phoneNumber.trim(),
            usageLocations: [],
            createdAt: new Date().toISOString(),
          };

          await persist([nextItem, ...items]);
          addForm.reset({
            label: values.label,
            countryCode: values.countryCode,
            phoneNumber: '',
          });
          toast({
            title: 'Saved',
            description: 'Mobile number saved (encrypted).',
          });
        })}
      />

      <MobileNumberListCard
        items={items}
        onDelete={async (id) => {
          const next = items.filter((x) => x.id !== id);
          await persist(next);
          toast({
            title: 'Deleted',
            description: 'Mobile number removed.',
          });
        }}
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
