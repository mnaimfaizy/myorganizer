import {
  readVisibleAddresses,
  readVisibleMobileNumbers,
  findVisibleAddress,
  findVisibleMobileNumber,
  addressStatus,
  splitAddressesByStatus,
  readUsageLocations,
  isNotified,
  countUnnotified,
  describeToNotify,
  notifiedProgress,
  selectUsageLocationsForDetail,
  formatAddressLine,
  addressFields,
  formatMobileNumber,
  mobileNumberFields,
  describeUsageLocationMeta,
  mapsUrlForAddress,
  ORGANISATION_TYPE_LABEL,
  UPDATE_METHOD_LABEL,
  PRIORITY_LABEL,
  type DecryptedAddress,
  type DecryptedMobileNumber,
  type DecryptedUsageLocation,
} from './contactModel';

describe('contactModel', () => {
  describe('readVisibleAddresses', () => {
    it('returns all addresses with usable ids', () => {
      const records = [
        { id: 'addr1', name: 'Home' },
        { id: 'addr2', name: 'Work' },
      ];

      const result = readVisibleAddresses(records);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('addr1');
      expect(result[1].id).toBe('addr2');
    });

    it('drops entries with empty id string', () => {
      const records = [
        { id: 'addr1', name: 'Valid' },
        { id: '', name: 'Empty ID' },
      ];

      const result = readVisibleAddresses(records);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('addr1');
    });

    it('drops entries with no id field', () => {
      const records = [{ id: 'addr1', name: 'Valid' }, { name: 'No ID field' }];

      const result = readVisibleAddresses(records);

      expect(result).toHaveLength(1);
    });

    it('drops non-object entries', () => {
      const records = [{ id: 'addr1', name: 'Valid' }, null, 'string', 42];

      const result = readVisibleAddresses(records);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('addr1');
    });

    it('returns empty array for non-array input', () => {
      expect(readVisibleAddresses(null)).toEqual([]);
      expect(readVisibleAddresses(undefined)).toEqual([]);
      expect(readVisibleAddresses('string')).toEqual([]);
      expect(readVisibleAddresses({})).toEqual([]);
    });

    it('returns empty array for array of only invalid entries', () => {
      const records = [null, undefined, { name: 'No ID' }, []];

      expect(readVisibleAddresses(records)).toEqual([]);
    });
  });

  describe('readVisibleMobileNumbers', () => {
    it('returns all mobile numbers with usable ids', () => {
      const records = [
        { id: 'mob1', phoneNumber: '1234567890' },
        { id: 'mob2', phoneNumber: '9876543210' },
      ];

      const result = readVisibleMobileNumbers(records);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('mob1');
    });

    it('drops entries with empty id or no id', () => {
      const records = [
        { id: 'mob1', phoneNumber: 'valid' },
        { id: '', phoneNumber: 'empty' },
        { phoneNumber: 'no id' },
      ];

      const result = readVisibleMobileNumbers(records);

      expect(result).toHaveLength(1);
    });

    it('returns empty array for non-array input', () => {
      expect(readVisibleMobileNumbers(null)).toEqual([]);
      expect(readVisibleMobileNumbers(undefined)).toEqual([]);
    });
  });

  describe('findVisibleAddress', () => {
    const addresses = [
      { id: 'addr1', street: 'Main St' },
      { id: 'addr2', street: 'Second St' },
    ];

    it('returns the address when found', () => {
      const result = findVisibleAddress(addresses, 'addr1');

      expect(result).toEqual({ id: 'addr1', street: 'Main St' });
    });

    it('returns null when address not found', () => {
      const result = findVisibleAddress(addresses, 'nonexistent');

      expect(result).toBeNull();
    });

    it('returns null for invalid input', () => {
      expect(findVisibleAddress(null, 'addr1')).toBeNull();
      expect(findVisibleAddress({}, 'addr1')).toBeNull();
    });

    it('returns null when no addresses have usable id', () => {
      const invalid = [{ street: 'No ID' }];

      expect(findVisibleAddress(invalid, 'addr1')).toBeNull();
    });
  });

  describe('findVisibleMobileNumber', () => {
    const numbers = [
      { id: 'mob1', phoneNumber: '1234567890' },
      { id: 'mob2', phoneNumber: '9876543210' },
    ];

    it('returns the mobile number when found', () => {
      const result = findVisibleMobileNumber(numbers, 'mob2');

      expect(result).toEqual({ id: 'mob2', phoneNumber: '9876543210' });
    });

    it('returns null when not found', () => {
      expect(findVisibleMobileNumber(numbers, 'nonexistent')).toBeNull();
    });

    it('returns null for invalid input', () => {
      expect(findVisibleMobileNumber(null, 'mob1')).toBeNull();
    });
  });

  describe('addressStatus', () => {
    it('returns the status when present', () => {
      const address: DecryptedAddress = { id: 'a1', status: 'old' };
      expect(addressStatus(address)).toBe('old');
    });

    it('defaults to "current" when status is undefined', () => {
      const address: DecryptedAddress = { id: 'a1' };
      expect(addressStatus(address)).toBe('current');
    });

    it('defaults to "current" when status is null', () => {
      const address = { id: 'a1', status: null } as any;
      expect(addressStatus(address)).toBe('current');
    });
  });

  describe('splitAddressesByStatus', () => {
    it('separates current and old addresses', () => {
      const records = [
        { id: 'a1', status: 'current' as const },
        { id: 'a2', status: 'old' as const },
        { id: 'a3', status: 'current' as const },
      ];

      const result = splitAddressesByStatus(records);

      expect(result.current).toHaveLength(2);
      expect(result.old).toHaveLength(1);
      expect(result.current[0].id).toBe('a1');
      expect(result.current[1].id).toBe('a3');
      expect(result.old[0].id).toBe('a2');
    });

    it('defaults to current when status is undefined', () => {
      const records = [{ id: 'a1' }, { id: 'a2', status: 'old' as const }];

      const result = splitAddressesByStatus(records);

      expect(result.current).toHaveLength(1);
      expect(result.old).toHaveLength(1);
    });

    it('preserves order within each bucket', () => {
      const records = [
        { id: 'c1', status: 'current' as const },
        { id: 'o1', status: 'old' as const },
        { id: 'c2', status: 'current' as const },
        { id: 'o2', status: 'old' as const },
      ];

      const result = splitAddressesByStatus(records);

      expect(result.current.map((a) => a.id)).toEqual(['c1', 'c2']);
      expect(result.old.map((a) => a.id)).toEqual(['o1', 'o2']);
    });

    it('drops entries with no usable id', () => {
      const records = [
        { id: 'a1', status: 'current' as const },
        { id: '', status: 'old' as const },
        { status: 'current' as const },
      ];

      const result = splitAddressesByStatus(records);

      expect(result.current).toHaveLength(1);
      expect(result.old).toHaveLength(0);
    });

    it('returns empty buckets for non-array input', () => {
      const result = splitAddressesByStatus(null);

      expect(result.current).toEqual([]);
      expect(result.old).toEqual([]);
    });
  });

  describe('readUsageLocations', () => {
    it('returns usage locations with usable ids', () => {
      const contact: DecryptedAddress = {
        id: 'addr1',
        usageLocations: [
          {
            id: 'ul1',
            organisationName: 'Home',
            organisationType: 'other',
            updateMethod: 'online',
            changed: false,
            priority: 'normal',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'ul2',
            organisationName: 'Work',
            organisationType: 'other',
            updateMethod: 'online',
            changed: false,
            priority: 'normal',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = readUsageLocations(contact);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ul1');
    });

    it('drops locations with empty id', () => {
      const contact: DecryptedAddress = {
        id: 'addr1',
        usageLocations: [
          {
            id: 'ul1',
            organisationName: 'Valid',
            organisationType: 'other',
            updateMethod: 'online',
            changed: false,
            priority: 'normal',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: '',
            organisationName: 'Empty',
            organisationType: 'other',
            updateMethod: 'online',
            changed: false,
            priority: 'normal',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = readUsageLocations(contact);

      expect(result).toHaveLength(1);
    });

    it('returns empty array when usageLocations is not an array', () => {
      const contact: DecryptedAddress = {
        id: 'addr1',
        usageLocations: null as any,
      };

      expect(readUsageLocations(contact)).toEqual([]);
    });

    it('returns empty array when usageLocations is undefined', () => {
      const contact: DecryptedAddress = { id: 'addr1' };

      expect(readUsageLocations(contact)).toEqual([]);
    });
  });

  describe('isNotified', () => {
    it('returns true when changed is true', () => {
      const location: DecryptedUsageLocation = { id: 'ul1', changed: true };
      expect(isNotified(location)).toBe(true);
    });

    it('returns false when changed is false', () => {
      const location: DecryptedUsageLocation = { id: 'ul1', changed: false };
      expect(isNotified(location)).toBe(false);
    });

    it('defaults to false when changed is undefined', () => {
      const location: DecryptedUsageLocation = { id: 'ul1' };
      expect(isNotified(location)).toBe(false);
    });

    it('returns false when changed is null', () => {
      const location = { id: 'ul1', changed: null } as any;
      expect(isNotified(location)).toBe(false);
    });
  });

  describe('countUnnotified', () => {
    it('counts locations not yet notified', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'ul1', changed: true },
        { id: 'ul2' }, // not notified
        { id: 'ul3', changed: true },
        { id: 'ul4' }, // not notified
      ];

      expect(countUnnotified(locations)).toBe(2);
    });

    it('returns 0 when all are notified', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'ul1', changed: true },
        { id: 'ul2', changed: true },
      ];

      expect(countUnnotified(locations)).toBe(0);
    });

    it('returns length when none are notified', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'ul1' },
        { id: 'ul2' },
      ];

      expect(countUnnotified(locations)).toBe(2);
    });

    it('handles empty array', () => {
      expect(countUnnotified([])).toBe(0);
    });
  });

  describe('describeToNotify', () => {
    it('returns count string when some unnotified', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'ul1', changed: true },
        { id: 'ul2' },
        { id: 'ul3' },
      ];

      expect(describeToNotify(locations)).toBe('2 to notify');
    });

    it('returns "1 to notify" for single unnotified', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'ul1', changed: true },
        { id: 'ul2' },
      ];

      expect(describeToNotify(locations)).toBe('1 to notify');
    });

    it('returns undefined when all notified', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'ul1', changed: true },
        { id: 'ul2', changed: true },
      ];

      expect(describeToNotify(locations)).toBeUndefined();
    });

    it('returns undefined for empty array', () => {
      expect(describeToNotify([])).toBeUndefined();
    });
  });

  describe('notifiedProgress', () => {
    it('returns notified and total count', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'ul1', changed: true },
        { id: 'ul2' },
        { id: 'ul3', changed: true },
      ];

      const progress = notifiedProgress(locations);

      expect(progress).toEqual({ notified: 2, total: 3 });
    });

    it('returns 0 notified when none are notified', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'ul1' },
        { id: 'ul2' },
      ];

      expect(notifiedProgress(locations)).toEqual({ notified: 0, total: 2 });
    });

    it('returns all notified when all are notified', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'ul1', changed: true },
      ];

      expect(notifiedProgress(locations)).toEqual({ notified: 1, total: 1 });
    });

    it('handles empty array', () => {
      expect(notifiedProgress([])).toEqual({ notified: 0, total: 0 });
    });
  });

  describe('selectUsageLocationsForDetail', () => {
    it('puts all unnotified before all notified', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'notif1', changed: true, priority: 'low' as const },
        { id: 'unnotif1', priority: 'high' as const },
        { id: 'notif2', changed: true, priority: 'high' as const },
        { id: 'unnotif2', priority: 'low' as const },
      ];

      const result = selectUsageLocationsForDetail(locations);

      const unnotifIds = result.slice(0, 2).map((l) => l.id);
      const notifIds = result.slice(2).map((l) => l.id);

      expect(unnotifIds).toContain('unnotif1');
      expect(unnotifIds).toContain('unnotif2');
      expect(notifIds).toContain('notif1');
      expect(notifIds).toContain('notif2');
    });

    it('sorts unnotified by priority (high > medium > normal > low)', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'low', priority: 'low' as const },
        { id: 'high', priority: 'high' as const },
        { id: 'medium', priority: 'medium' as const },
      ];

      const result = selectUsageLocationsForDetail(locations);

      expect(result[0].id).toBe('high');
      expect(result[1].id).toBe('medium');
      expect(result[2].id).toBe('low');
    });

    it('sorts notified by priority (high > medium > normal > low)', () => {
      const locations: DecryptedUsageLocation[] = [
        { id: 'notif-low', changed: true, priority: 'low' as const },
        { id: 'notif-high', changed: true, priority: 'high' as const },
        { id: 'notif-medium', changed: true, priority: 'medium' as const },
      ];

      const result = selectUsageLocationsForDetail(locations);

      expect(result[0].id).toBe('notif-high');
      expect(result[1].id).toBe('notif-medium');
      expect(result[2].id).toBe('notif-low');
    });

    it('uses createdAt as tiebreaker within priority', () => {
      const locations: DecryptedUsageLocation[] = [
        {
          id: 'early',
          priority: 'high' as const,
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'late',
          priority: 'high' as const,
          createdAt: '2026-01-02T00:00:00Z',
        },
      ];

      const result = selectUsageLocationsForDetail(locations);

      expect(result[0].id).toBe('early');
      expect(result[1].id).toBe('late');
    });

    it('handles empty array', () => {
      expect(selectUsageLocationsForDetail([])).toEqual([]);
    });
  });

  describe('formatAddressLine', () => {
    it('joins structured fields in postal order', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        propertyNumber: '123',
        street: 'Main St',
        suburb: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        country: 'USA',
      };

      const line = formatAddressLine(address);

      expect(line).toBe('123, Main St, Springfield, IL, 62701, USA');
    });

    it('skips missing structured fields', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        street: 'Main St',
        state: 'IL',
      };

      const line = formatAddressLine(address);

      expect(line).toBe('Main St, IL');
    });

    it('trims whitespace from fields', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        street: '  Main St  ',
        state: '  IL  ',
      };

      const line = formatAddressLine(address);

      expect(line).toBe('Main St, IL');
    });

    it('falls back to legacy address field when no structured fields', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        address: 'Legacy address line',
      };

      const line = formatAddressLine(address);

      expect(line).toBe('Legacy address line');
    });

    it('prefers structured over legacy even when legacy is present', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        street: 'Main St',
        address: 'Legacy line',
      };

      const line = formatAddressLine(address);

      expect(line).toBe('Main St');
    });

    it('returns empty string when nothing present', () => {
      const address: DecryptedAddress = { id: 'a1' };

      expect(formatAddressLine(address)).toBe('');
    });

    it('trims legacy address', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        address: '  legacy  ',
      };

      expect(formatAddressLine(address)).toBe('legacy');
    });
  });

  describe('addressFields', () => {
    it('returns all structured fields when present', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        propertyNumber: '123',
        street: 'Main St',
        suburb: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        country: 'USA',
      };

      const fields = addressFields(address);

      expect(fields).toHaveLength(6);
      expect(fields[0]).toEqual({
        id: 'propertyNumber',
        label: 'Property / unit number',
        value: '123',
      });
      expect(fields[5]).toEqual({
        id: 'country',
        label: 'Country',
        value: 'USA',
      });
    });

    it('skips empty and whitespace-only fields', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        propertyNumber: '123',
        street: '   ',
        suburb: 'Springfield',
      };

      const fields = addressFields(address);

      expect(fields).toHaveLength(2);
      expect(fields[0].id).toBe('propertyNumber');
      expect(fields[1].id).toBe('suburb');
    });

    it('includes legacy address only when no structured fields present', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        address: 'Legacy address',
      };

      const fields = addressFields(address);

      expect(fields).toHaveLength(1);
      expect(fields[0].id).toBe('address');
      expect(fields[0].value).toBe('Legacy address');
    });

    it('excludes legacy address when structured fields are present', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        street: 'Main St',
        address: 'Legacy address',
      };

      const fields = addressFields(address);

      expect(fields).toHaveLength(1);
      expect(fields[0].id).toBe('street');
    });

    it('returns empty array when nothing present', () => {
      const address: DecryptedAddress = { id: 'a1' };

      expect(addressFields(address)).toEqual([]);
    });

    it('preserves field order: propertyNumber, street, suburb, state, zipCode, country', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        country: 'USA',
        street: 'Main St',
        propertyNumber: '123',
        state: 'IL',
        suburb: 'Springfield',
        zipCode: '62701',
      };

      const fields = addressFields(address);

      expect(fields.map((f) => f.id)).toEqual([
        'propertyNumber',
        'street',
        'suburb',
        'state',
        'zipCode',
        'country',
      ]);
    });
  });

  describe('formatMobileNumber', () => {
    it('joins country code and phone number', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        countryCode: '+1',
        phoneNumber: '5551234567',
      };

      expect(formatMobileNumber(mobile)).toBe('+1 5551234567');
    });

    it('skips missing structured fields', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        phoneNumber: '5551234567',
      };

      expect(formatMobileNumber(mobile)).toBe('5551234567');
    });

    it('trims whitespace from fields', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        countryCode: '  +1  ',
        phoneNumber: '  555-1234  ',
      };

      expect(formatMobileNumber(mobile)).toBe('+1 555-1234');
    });

    it('falls back to legacy mobileNumber when no structured fields', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        mobileNumber: '1234567890',
      };

      expect(formatMobileNumber(mobile)).toBe('1234567890');
    });

    it('prefers structured over legacy', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        phoneNumber: '5551234567',
        mobileNumber: 'legacy',
      };

      expect(formatMobileNumber(mobile)).toBe('5551234567');
    });

    it('returns empty string when nothing present', () => {
      const mobile: DecryptedMobileNumber = { id: 'm1' };

      expect(formatMobileNumber(mobile)).toBe('');
    });
  });

  describe('mobileNumberFields', () => {
    it('returns structured fields when present', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        countryCode: '+1',
        phoneNumber: '5551234567',
      };

      const fields = mobileNumberFields(mobile);

      expect(fields).toHaveLength(2);
      expect(fields[0]).toEqual({
        id: 'countryCode',
        label: 'Country code',
        value: '+1',
      });
      expect(fields[1]).toEqual({
        id: 'phoneNumber',
        label: 'Phone number',
        value: '5551234567',
      });
    });

    it('skips empty and whitespace-only fields', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        countryCode: '+1',
        phoneNumber: '   ',
      };

      const fields = mobileNumberFields(mobile);

      expect(fields).toHaveLength(1);
      expect(fields[0].id).toBe('countryCode');
    });

    it('includes legacy mobileNumber only when no structured fields present', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        mobileNumber: '1234567890',
      };

      const fields = mobileNumberFields(mobile);

      expect(fields).toHaveLength(1);
      expect(fields[0].id).toBe('mobileNumber');
    });

    it('excludes legacy mobileNumber when structured fields are present', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        countryCode: '+1',
        mobileNumber: 'legacy',
      };

      const fields = mobileNumberFields(mobile);

      expect(fields).toHaveLength(1);
      expect(fields[0].id).toBe('countryCode');
    });

    it('returns empty array when nothing present', () => {
      const mobile: DecryptedMobileNumber = { id: 'm1' };

      expect(mobileNumberFields(mobile)).toEqual([]);
    });

    it('preserves field order: countryCode, phoneNumber, legacy mobileNumber', () => {
      const mobile: DecryptedMobileNumber = {
        id: 'm1',
        phoneNumber: '5551234567',
        countryCode: '+1',
      };

      const fields = mobileNumberFields(mobile);

      expect(fields.map((f) => f.id)).toEqual(['countryCode', 'phoneNumber']);
    });
  });

  describe('describeUsageLocationMeta', () => {
    it('joins organisation type, update method, and priority', () => {
      const location: DecryptedUsageLocation = {
        id: 'ul1',
        organisationType: 'bank',
        updateMethod: 'online',
        priority: 'high',
      };

      const meta = describeUsageLocationMeta(location);

      expect(meta).toBe('Bank · Online · High');
    });

    it('includes only present fields', () => {
      const location: DecryptedUsageLocation = {
        id: 'ul1',
        organisationType: 'employer',
        priority: 'medium',
      };

      const meta = describeUsageLocationMeta(location);

      expect(meta).toBe('Employer · Medium');
    });

    it('returns empty string when no fields present', () => {
      const location: DecryptedUsageLocation = { id: 'ul1' };

      expect(describeUsageLocationMeta(location)).toBe('');
    });

    it('uses labels from pinned tables', () => {
      const location: DecryptedUsageLocation = {
        id: 'ul1',
        organisationType: 'university',
        updateMethod: 'phone',
        priority: 'low',
      };

      const meta = describeUsageLocationMeta(location);

      expect(meta).toBe('University · Phone · Low');
    });
  });

  describe('mapsUrlForAddress', () => {
    it('returns Apple Maps URL for iOS', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        propertyNumber: '123',
        street: 'Main St',
      };

      const url = mapsUrlForAddress(address, 'ios');

      expect(url).toBe('https://maps.apple.com/?q=123%2C%20Main%20St');
    });

    it('returns Google Maps URL for Android', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        propertyNumber: '123',
        street: 'Main St',
      };

      const url = mapsUrlForAddress(address, 'android');

      expect(url).toBe(
        'https://www.google.com/maps/search/?api=1&query=123%2C%20Main%20St',
      );
    });

    it('URL-encodes address components', () => {
      const address: DecryptedAddress = {
        id: 'a1',
        street: 'Main St',
        suburb: 'New York',
      };

      const iosUrl = mapsUrlForAddress(address, 'ios');
      const androidUrl = mapsUrlForAddress(address, 'android');

      expect(iosUrl).toContain('%20'); // URL-encoded space
      expect(androidUrl).toContain('%20');
      expect(iosUrl).toContain('%2C'); // URL-encoded comma
      expect(androidUrl).toContain('%2C');
    });

    it('handles empty address line', () => {
      const address: DecryptedAddress = { id: 'a1' };

      const iosUrl = mapsUrlForAddress(address, 'ios');
      const androidUrl = mapsUrlForAddress(address, 'android');

      expect(iosUrl).toBe('https://maps.apple.com/?q=');
      expect(androidUrl).toBe(
        'https://www.google.com/maps/search/?api=1&query=',
      );
    });
  });

  describe('Label tables', () => {
    it('ORGANISATION_TYPE_LABEL has all expected keys', () => {
      expect(ORGANISATION_TYPE_LABEL.government).toBe('Government');
      expect(ORGANISATION_TYPE_LABEL.bank).toBe('Bank');
      expect(ORGANISATION_TYPE_LABEL.employer).toBe('Employer');
    });

    it('UPDATE_METHOD_LABEL has all expected keys', () => {
      expect(UPDATE_METHOD_LABEL.online).toBe('Online');
      expect(UPDATE_METHOD_LABEL.phone).toBe('Phone');
      expect(UPDATE_METHOD_LABEL.inPerson).toBe('In person');
    });

    it('PRIORITY_LABEL has all expected keys', () => {
      expect(PRIORITY_LABEL.high).toBe('High');
      expect(PRIORITY_LABEL.medium).toBe('Medium');
      expect(PRIORITY_LABEL.normal).toBe('Normal');
      expect(PRIORITY_LABEL.low).toBe('Low');
    });
  });
});
