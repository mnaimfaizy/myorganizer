import { AddressRecord, AddressStatusEnum } from '@myorganizer/core';

import {
  addAddressSchema,
  addressFormValuesToRecordFields,
  buildAddressFingerprint,
  countryCodeToName,
  countryNameToCode,
  findDuplicateAddress,
  getDefaultAddressCountryCode,
} from './addressForm';

const validFormValues = {
  label: 'Home',
  propertyNumber: '221B',
  street: 'Baker Street',
  suburb: 'London',
  state: 'Greater London',
  zipCode: 'NW1 6XE',
  countryCode: 'GB',
};

describe('addressForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('validates a structured address with a supported country', () => {
    const result = addAddressSchema.safeParse(validFormValues);

    expect(result.success).toBe(true);
  });

  it('rejects invalid postal code characters', () => {
    const result = addAddressSchema.safeParse({
      ...validFormValues,
      zipCode: 'NW1@6XE',
    });

    expect(result.success).toBe(false);
  });

  it('maps country codes and names for persisted address fields', () => {
    expect(countryCodeToName('AU')).toBe('Australia');
    expect(countryNameToCode('United Kingdom')).toBe('GB');
    expect(addressFormValuesToRecordFields(validFormValues)).toMatchObject({
      country: 'United Kingdom',
      street: 'Baker Street',
    });
  });

  it('uses the account country setting as the default country', () => {
    window.localStorage.setItem(
      'myorganizer_account_settings_v1',
      JSON.stringify({ countryCode: 'GB', preferredCurrency: 'GBP' }),
    );

    expect(getDefaultAddressCountryCode()).toBe('GB');
  });

  it('normalizes punctuation, casing, and country names for fingerprints', () => {
    expect(
      buildAddressFingerprint({
        propertyNumber: '221-B',
        street: 'BAKER   Street',
        suburb: 'London',
        state: 'Greater London',
        zipCode: 'NW1 6XE',
        country: 'United Kingdom',
      }),
    ).toBe(
      buildAddressFingerprint({
        propertyNumber: '221 B',
        street: 'Baker Street',
        suburb: 'london',
        state: 'greater london',
        zipCode: 'NW1-6XE',
        countryCode: 'GB',
      }),
    );
  });

  it('finds matching existing addresses without blocking overrides', () => {
    const existing: AddressRecord = {
      id: 'existing-address',
      label: 'Home',
      propertyNumber: '221B',
      street: 'Baker Street',
      suburb: 'London',
      state: 'Greater London',
      zipCode: 'NW1 6XE',
      country: 'United Kingdom',
      status: AddressStatusEnum.Current,
      usageLocations: [],
      createdAt: '2026-05-14T00:00:00.000Z',
    };

    expect(findDuplicateAddress(validFormValues, [existing])?.id).toBe(
      'existing-address',
    );
  });
});
