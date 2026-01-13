'use client';

import {
  OrganisationTypeEnum,
  PriorityEnum,
  UpdateMethodEnum,
  UsageLocationRecord,
} from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeAddresses,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';

import { enumOptions, parseEnumValue, titleCase } from '../utils/enumUtils';
import { randomId } from '../utils/randomId';
import { AddUsageLocationCard } from './AddUsageLocationCard';
import {
  AddressDetailLoading,
  AddressDetailNotFound,
  BackToAddressesLink,
} from './AddressDetailScaffold';
import { AddressDetailsCard } from './AddressDetailsCard';
import { UsageLocationsCard } from './UsageLocationsCard';

const addUsageLocationSchema = z.object({
  orgName: z.string().trim().min(1),
  orgType: z.string().trim().min(1),
  updateMethod: z.string().trim().min(1),
  priority: z.string().trim().min(1),
  link: z.string().optional(),
  changed: z.boolean(),
});

type AddUsageLocationFormValues = z.infer<typeof addUsageLocationSchema>;

function AddressDetailsInner(props: {
  masterKeyBytes: Uint8Array;
  addressId: string;
}) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('');
  const [usageLocations, setUsageLocations] = useState<UsageLocationRecord[]>(
    []
  );

  const usageForm = useForm<AddUsageLocationFormValues>({
    resolver: zodResolver(addUsageLocationSchema),
    defaultValues: {
      orgName: '',
      orgType: 'government',
      updateMethod: 'online',
      priority: 'normal',
      link: '',
      changed: false,
    },
    mode: 'onChange',
  });

  const orgName = usageForm.watch('orgName');
  const orgType = usageForm.watch('orgType');
  const updateMethod = usageForm.watch('updateMethod');
  const priority = usageForm.watch('priority');
  const link = usageForm.watch('link') ?? '';
  const changed = usageForm.watch('changed');

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

  const orgTypeOptions = useMemo(
    () =>
      enumOptions(OrganisationTypeEnum).map((v) => ({
        value: v,
        label: titleCase(v),
      })),
    []
  );

  const updateMethodOptions = useMemo(
    () =>
      enumOptions(UpdateMethodEnum).map((v) => ({
        value: v,
        label: titleCase(v),
      })),
    []
  );

  const canAddUsage = usageForm.formState.isValid;

  async function persistUsage(nextUsage: UsageLocationRecord[]) {
    const raw = await loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'addresses',
      defaultValue: [],
    });

    const normalized = normalizeAddresses(raw);
    const nextAddresses = normalized.value.map((x) =>
      x.id === props.addressId ? { ...x, usageLocations: nextUsage } : x
    );

    await saveEncryptedData({
      masterKeyBytes: props.masterKeyBytes,
      type: 'addresses',
      value: nextAddresses,
    });

    setUsageLocations(nextUsage);
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

      <UsageLocationsCard usageLocations={usageLocations} />

      <AddUsageLocationCard
        orgName={orgName}
        orgType={orgType}
        updateMethod={updateMethod}
        priority={priority}
        link={link}
        changed={changed}
        canAddUsage={canAddUsage}
        orgTypeOptions={orgTypeOptions}
        updateMethodOptions={updateMethodOptions}
        onOrgNameChange={(value) =>
          usageForm.setValue('orgName', value, { shouldValidate: true })
        }
        onOrgTypeChange={(value) =>
          usageForm.setValue('orgType', value, { shouldValidate: true })
        }
        onUpdateMethodChange={(value) =>
          usageForm.setValue('updateMethod', value, { shouldValidate: true })
        }
        onPriorityChange={(value) =>
          usageForm.setValue('priority', value, { shouldValidate: true })
        }
        onLinkChange={(value) =>
          usageForm.setValue('link', value, { shouldValidate: true })
        }
        onChangedChange={(value) =>
          usageForm.setValue('changed', value, { shouldValidate: true })
        }
        onAddUsage={usageForm.handleSubmit(async (values) => {
          const now = new Date().toISOString();
          const next: UsageLocationRecord = {
            id: randomId(),
            organisationName: values.orgName.trim(),
            organisationType: parseEnumValue(
              OrganisationTypeEnum,
              values.orgType,
              OrganisationTypeEnum.Other
            ),
            updateMethod: parseEnumValue(
              UpdateMethodEnum,
              values.updateMethod,
              UpdateMethodEnum.Online
            ),
            changed: values.changed,
            link: values.link?.trim() ? values.link.trim() : undefined,
            priority: parseEnumValue(
              PriorityEnum,
              values.priority,
              PriorityEnum.Normal
            ),
            createdAt: now,
            changedAt: values.changed ? now : undefined,
          };

          try {
            await persistUsage([next, ...usageLocations]);
            usageForm.reset({
              orgName: '',
              orgType: values.orgType,
              updateMethod: values.updateMethod,
              priority: values.priority,
              link: '',
              changed: false,
            });
            toast({
              title: 'Saved',
              description: 'Usage location saved (encrypted).',
            });
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            toast({
              title: 'Failed to save',
              description: message,
              variant: 'destructive',
            });
          }
        })}
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
