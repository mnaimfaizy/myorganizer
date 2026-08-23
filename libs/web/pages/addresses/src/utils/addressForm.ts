import {
  AddressRecord,
  COUNTRIES,
  getAccountSettings,
} from '@myorganizer/core';

import {
  type AddAddressFormValues,
  isAddressCountryCode,
} from '../schemas/address';

export type AddressCountryOption = {
  value: string;
  label: string;
};

export const ADDRESS_COUNTRY_OPTIONS: AddressCountryOption[] = COUNTRIES.map(
  (country) => ({
    value: country.code,
    label: `${country.name} (${country.code})`,
  }),
);

export function countryCodeToName(value: string): string {
  return COUNTRIES.find((country) => country.code === value)?.name ?? value;
}

export function countryNameToCode(value: string | undefined): string | null {
  if (!value) return null;

  const normalizedValue = normalizeText(value);
  return (
    COUNTRIES.find((country) => normalizeText(country.name) === normalizedValue)
      ?.code ?? null
  );
}

export function getDefaultAddressCountryCode(): string {
  const settings = getAccountSettings();
  return isAddressCountryCode(settings.countryCode)
    ? settings.countryCode
    : 'AU';
}

export function addressFormValuesToRecordFields(
  values: AddAddressFormValues,
): Pick<
  AddressRecord,
  | 'label'
  | 'propertyNumber'
  | 'street'
  | 'suburb'
  | 'state'
  | 'zipCode'
  | 'country'
> {
  return {
    label: values.label.trim(),
    propertyNumber: toOptionalTrimmedString(values.propertyNumber),
    street: values.street.trim(),
    suburb: values.suburb.trim(),
    state: values.state.trim(),
    zipCode: values.zipCode.trim(),
    country: countryCodeToName(values.countryCode),
  };
}

export function createAddressPreview(values: AddAddressFormValues) {
  return addressFormValuesToRecordFields(values);
}

type FingerprintInput = Partial<
  Pick<
    AddressRecord,
    | 'id'
    | 'propertyNumber'
    | 'street'
    | 'suburb'
    | 'state'
    | 'zipCode'
    | 'country'
  >
> & {
  countryCode?: string;
};

export function buildAddressFingerprint(value: FingerprintInput): string {
  const country = value.countryCode
    ? value.countryCode
    : (countryNameToCode(value.country) ?? value.country);

  return [
    value.propertyNumber,
    value.street,
    value.suburb,
    value.state,
    value.zipCode,
    country,
  ]
    .map(normalizeText)
    .join('|');
}

export function findDuplicateAddress(
  values: AddAddressFormValues,
  items: AddressRecord[],
  excludeId?: string,
): AddressRecord | null {
  const nextFingerprint = buildAddressFingerprint({
    ...addressFormValuesToRecordFields(values),
    countryCode: values.countryCode,
  });

  if (!nextFingerprint.replace(/\|/g, '')) return null;

  return (
    items.find(
      (item) =>
        item.id !== excludeId &&
        buildAddressFingerprint(item) === nextFingerprint,
    ) ?? null
  );
}

function toOptionalTrimmedString(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeText(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
