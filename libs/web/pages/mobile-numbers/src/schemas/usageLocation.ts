import { z } from 'zod';

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const usageLocationSchema = z.object({
  orgName: z.string().trim().min(1, 'Organisation name is required'),
  orgType: z.string().trim().min(1),
  updateMethod: z.string().trim().min(1),
  priority: z.string().trim().min(1),
  link: z
    .string()
    .trim()
    .refine((value) => !value || isHttpUrl(value), {
      message: 'Enter a valid URL, including http:// or https://',
    })
    .optional(),
  changed: z.boolean(),
});

export type UsageLocationFormValues = z.infer<typeof usageLocationSchema>;

export const USAGE_LOCATION_FORM_DEFAULTS: UsageLocationFormValues = {
  orgName: '',
  orgType: 'government',
  updateMethod: 'online',
  priority: 'normal',
  link: '',
  changed: false,
};

export function normalizeOrganisationName(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function usageLocationRecordToFormValues(location: {
  organisationName: string;
  organisationType: string;
  updateMethod: string;
  priority: string;
  link?: string;
  changed: boolean;
}): UsageLocationFormValues {
  return {
    orgName: location.organisationName,
    orgType: location.organisationType,
    updateMethod: location.updateMethod,
    priority: location.priority,
    link: location.link ?? '',
    changed: location.changed,
  };
}

export function usageLocationFormValuesToRecordFields(
  values: UsageLocationFormValues,
): {
  organisationName: string;
  orgType: string;
  updateMethod: string;
  priority: string;
  changed: boolean;
  link: string | undefined;
} {
  return {
    organisationName: values.orgName.trim(),
    orgType: values.orgType,
    updateMethod: values.updateMethod,
    priority: values.priority,
    changed: values.changed,
    link: values.link?.trim() ? values.link.trim() : undefined,
  };
}
