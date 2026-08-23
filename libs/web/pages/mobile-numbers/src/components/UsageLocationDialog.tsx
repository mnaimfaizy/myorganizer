'use client';

import {
  OrganisationTypeEnum,
  UpdateMethodEnum,
  UsageLocationRecord,
} from '@myorganizer/core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@myorganizer/web-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  normalizeOrganisationName,
  USAGE_LOCATION_FORM_DEFAULTS,
  usageLocationRecordToFormValues,
  type UsageLocationFormValues,
  usageLocationSchema,
} from '../schemas/usageLocation';
import { enumOptions, titleCase } from '../utils/enumUtils';
import {
  UsageLocationFormFields,
  type SelectOption,
} from './UsageLocationFormFields';

interface UsageLocationDialogProps {
  open: boolean;
  /** null → add mode; a record → edit mode with that record loaded */
  location: UsageLocationRecord | null;
  /** All usage locations already attached to this mobile number, for duplicate detection */
  existingLocations: UsageLocationRecord[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: UsageLocationFormValues,
    editingId: string | null,
  ) => Promise<void>;
}

export function UsageLocationDialog({
  open,
  location,
  existingLocations,
  onOpenChange,
  onSubmit,
}: UsageLocationDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);

  const form = useForm<UsageLocationFormValues>({
    resolver: zodResolver(usageLocationSchema),
    defaultValues: USAGE_LOCATION_FORM_DEFAULTS,
    mode: 'onChange',
  });

  const orgName = form.watch('orgName');

  const orgTypeOptions = useMemo<SelectOption[]>(
    () =>
      enumOptions(OrganisationTypeEnum).map((v) => ({
        value: v,
        label: titleCase(v),
      })),
    [],
  );

  const updateMethodOptions = useMemo<SelectOption[]>(
    () =>
      enumOptions(UpdateMethodEnum).map((v) => ({
        value: v,
        label: titleCase(v),
      })),
    [],
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;

    if (location) {
      form.reset(usageLocationRecordToFormValues(location));
    } else {
      form.reset(USAGE_LOCATION_FORM_DEFAULTS);
    }
    setDuplicateAcknowledged(false);
  }, [open, location, form]);

  // Detect duplicate organisation
  const duplicateLocation = useMemo(() => {
    const normalizedOrgName = normalizeOrganisationName(orgName);
    if (!normalizedOrgName) return null;

    return (
      existingLocations.find(
        (existingLocation) =>
          existingLocation.id !== location?.id &&
          normalizeOrganisationName(existingLocation.organisationName) ===
            normalizedOrgName,
      ) ?? null
    );
  }, [orgName, existingLocations, location?.id]);

  // Reset duplicate acknowledgement when org name changes
  useEffect(() => {
    setDuplicateAcknowledged(false);
  }, [orgName]);

  const handleSubmit = useCallback(
    async (values: UsageLocationFormValues) => {
      if (duplicateLocation && !duplicateAcknowledged) {
        setDuplicateAcknowledged(true);
        return;
      }

      setIsSaving(true);
      try {
        await onSubmit(values, location?.id ?? null);
        onOpenChange(false);
      } catch {
        // onSubmit rejection means save failed; dialog stays open for retry
      } finally {
        setIsSaving(false);
      }
    },
    [
      duplicateLocation,
      duplicateAcknowledged,
      location?.id,
      onSubmit,
      onOpenChange,
    ],
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  const handleOrgNameChange = useCallback(
    (value: string) => {
      form.setValue('orgName', value, { shouldValidate: true });
    },
    [form],
  );

  const handleOrgTypeChange = useCallback(
    (value: string) => {
      form.setValue('orgType', value, { shouldValidate: true });
    },
    [form],
  );

  const handleUpdateMethodChange = useCallback(
    (value: string) => {
      form.setValue('updateMethod', value, { shouldValidate: true });
    },
    [form],
  );

  const handlePriorityChange = useCallback(
    (value: string) => {
      form.setValue('priority', value, { shouldValidate: true });
    },
    [form],
  );

  const handleLinkChange = useCallback(
    (value: string) => {
      form.setValue('link', value, { shouldValidate: true });
    },
    [form],
  );

  const handleChangedChange = useCallback(
    (value: boolean) => {
      form.setValue('changed', value, { shouldValidate: true });
    },
    [form],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSaving}
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {location ? 'Edit usage location' : 'Add usage location'}
          </DialogTitle>
          <DialogDescription>
            Track an organisation that needs to be told about this mobile
            number.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <UsageLocationFormFields
            orgName={orgName}
            orgType={form.watch('orgType')}
            updateMethod={form.watch('updateMethod')}
            priority={form.watch('priority')}
            link={form.watch('link') ?? ''}
            changed={form.watch('changed')}
            duplicateOrganisationName={duplicateLocation?.organisationName}
            duplicateAcknowledged={duplicateAcknowledged}
            fieldErrors={{
              orgName: form.formState.errors.orgName?.message,
              link: form.formState.errors.link?.message,
            }}
            orgTypeOptions={orgTypeOptions}
            updateMethodOptions={updateMethodOptions}
            onOrgNameChange={handleOrgNameChange}
            onOrgTypeChange={handleOrgTypeChange}
            onUpdateMethodChange={handleUpdateMethodChange}
            onPriorityChange={handlePriorityChange}
            onLinkChange={handleLinkChange}
            onChangedChange={handleChangedChange}
          />

          <DialogFooter className="mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.formState.isValid || isSaving}
            >
              {duplicateLocation && !duplicateAcknowledged
                ? 'Review duplicate'
                : location
                  ? 'Save changes'
                  : 'Add location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
