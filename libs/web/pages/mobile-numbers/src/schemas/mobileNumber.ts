import { z } from 'zod';

export const addMobileNumberSchema = z
  .object({
    label: z.string().trim().min(1, 'Label is required'),
    countryCode: z.string().min(1, 'Country code is required'),
    phoneNumber: z
      .string()
      .trim()
      .min(1, 'Phone number is required')
      .regex(
        /^[0-9\s\-()]+$/,
        'Only numbers, spaces, hyphens, and parentheses allowed',
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
    },
  );

export type AddMobileNumberFormValues = z.infer<typeof addMobileNumberSchema>;

export const MOBILE_NUMBER_FORM_DEFAULTS: AddMobileNumberFormValues = {
  label: 'Personal',
  countryCode: '+1',
  phoneNumber: '',
};

export function mobileNumberFormValuesToRecordFields(
  values: AddMobileNumberFormValues,
): { label: string; countryCode: string; phoneNumber: string } {
  return {
    label: values.label.trim(),
    countryCode: values.countryCode,
    phoneNumber: values.phoneNumber.trim(),
  };
}

export function mobileNumberRecordToFormValues(record: {
  label: string;
  countryCode?: string;
  phoneNumber?: string;
}): AddMobileNumberFormValues {
  return {
    label: record.label,
    countryCode: record.countryCode ?? MOBILE_NUMBER_FORM_DEFAULTS.countryCode,
    phoneNumber: record.phoneNumber ?? '',
  };
}
