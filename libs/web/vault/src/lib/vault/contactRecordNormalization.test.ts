// Every fixture below supplies its own `id` and `createdAt`, so neither
// `randomId` nor the clock is reached — no mock and no fake timers.
import {
  normalizeAddresses,
  normalizeMobileNumbers,
} from './contactRecordNormalization';
import {
  expectSavedEnvelope,
  storeHolding,
} from './unknownFieldsRoundTrip.testutil';
import { saveVaultRecords } from './vaultRecordWrite';

describe('contactRecordNormalization', () => {
  describe('normalizeAddresses', () => {
    describe('envelope acceptance', () => {
      it('returns same value and changed flag for bare array as before', () => {
        const bareArray = [
          {
            id: '1',
            label: 'Home',
            status: 'current',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ];
        const resultFromBare = normalizeAddresses(bareArray);
        const resultFromEnvelope = normalizeAddresses({
          records: bareArray,
          deletions: {},
        });
        expect(resultFromEnvelope.value).toEqual(resultFromBare.value);
        expect(resultFromEnvelope.changed).toBe(resultFromBare.changed);
      });

      it('deletion log does not appear in normalized records', () => {
        const result = normalizeAddresses({
          records: [
            {
              id: '1',
              label: 'Home',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: { someOtherId: '2026-01-01T00:00:00.000Z' },
        });
        expect(result.value).toHaveLength(1);
        expect(result.value[0].id).toBe('1');
        expect(result.value[0].label).toBe('Home');
      });

      it('carries updatedAt through from input', () => {
        const updatedAt = '2026-01-02T12:34:56.789Z';
        const result = normalizeAddresses([
          {
            id: '1',
            label: 'Home',
            status: 'current',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt,
          },
        ]);
        expect(result.value[0].updatedAt).toBe(updatedAt);
        expect(result.changed).toBe(false);
      });

      it('omits updatedAt when absent in input without marking changed', () => {
        const result = normalizeAddresses([
          {
            id: '1',
            label: 'Home',
            status: 'current',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(false);
      });

      it('handles null records in envelope like bare null', () => {
        const resultFromNull = normalizeAddresses(null);
        const resultFromNullEnvelope = normalizeAddresses({
          records: null,
          deletions: {},
        });
        expect(resultFromNullEnvelope.value).toEqual(resultFromNull.value);
        expect(resultFromNullEnvelope.changed).toBe(resultFromNull.changed);
      });

      it('drops unparseable updatedAt', () => {
        const result = normalizeAddresses([
          {
            id: '1',
            label: 'Home',
            status: 'current',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: 'banana',
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(true);
      });

      it('drops whitespace-only updatedAt', () => {
        const result = normalizeAddresses([
          {
            id: '1',
            label: 'Home',
            status: 'current',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '   ',
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(true);
      });

      it('drops empty updatedAt', () => {
        const result = normalizeAddresses([
          {
            id: '1',
            label: 'Home',
            status: 'current',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '',
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(true);
      });

      it('drops numeric updatedAt', () => {
        const result = normalizeAddresses([
          {
            id: '1',
            label: 'Home',
            status: 'current',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: 42,
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(true);
      });
    });
  });

  describe('normalizeMobileNumbers', () => {
    describe('envelope acceptance', () => {
      it('returns same value and changed flag for bare array as before', () => {
        const bareArray = [
          {
            id: '1',
            label: 'Personal',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ];
        const resultFromBare = normalizeMobileNumbers(bareArray);
        const resultFromEnvelope = normalizeMobileNumbers({
          records: bareArray,
          deletions: {},
        });
        expect(resultFromEnvelope.value).toEqual(resultFromBare.value);
        expect(resultFromEnvelope.changed).toBe(resultFromBare.changed);
      });

      it('deletion log does not appear in normalized records', () => {
        const result = normalizeMobileNumbers({
          records: [
            {
              id: '1',
              label: 'Personal',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: { someOtherId: '2026-01-01T00:00:00.000Z' },
        });
        expect(result.value).toHaveLength(1);
        expect(result.value[0].id).toBe('1');
        expect(result.value[0].label).toBe('Personal');
      });

      it('carries updatedAt through from input', () => {
        const updatedAt = '2026-01-02T12:34:56.789Z';
        const result = normalizeMobileNumbers([
          {
            id: '1',
            label: 'Personal',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt,
          },
        ]);
        expect(result.value[0].updatedAt).toBe(updatedAt);
        expect(result.changed).toBe(false);
      });

      it('omits updatedAt when absent in input without marking changed', () => {
        const result = normalizeMobileNumbers([
          {
            id: '1',
            label: 'Personal',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(false);
      });

      it('handles null records in envelope like bare null', () => {
        const resultFromNull = normalizeMobileNumbers(null);
        const resultFromNullEnvelope = normalizeMobileNumbers({
          records: null,
          deletions: {},
        });
        expect(resultFromNullEnvelope.value).toEqual(resultFromNull.value);
        expect(resultFromNullEnvelope.changed).toBe(resultFromNull.changed);
      });

      it('drops unparseable updatedAt', () => {
        const result = normalizeMobileNumbers([
          {
            id: '1',
            label: 'Personal',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: 'banana',
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(true);
      });

      it('drops whitespace-only updatedAt', () => {
        const result = normalizeMobileNumbers([
          {
            id: '1',
            label: 'Personal',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '   ',
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(true);
      });

      it('drops empty updatedAt', () => {
        const result = normalizeMobileNumbers([
          {
            id: '1',
            label: 'Personal',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '',
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(true);
      });

      it('drops numeric updatedAt', () => {
        const result = normalizeMobileNumbers([
          {
            id: '1',
            label: 'Personal',
            usageLocations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: 42,
          },
        ]);
        expect(result.value[0].updatedAt).toBeUndefined();
        expect(result.changed).toBe(true);
      });
    });
  });

  describe('unknown fields (ADR 0114 decision 3)', () => {
    const createdAt = '2026-01-01T00:00:00.000Z';

    const usageLocation = {
      id: 'use-1',
      organisationName: 'Westpac',
      organisationType: 'bank',
      updateMethod: 'online',
      changed: false,
      priority: 'high',
      createdAt,
      futureUsageKey: 'kept',
    };

    it('keeps an unknown field on an Address and on its nested Usage Location through normalize-then-save', async () => {
      const stored = {
        records: [
          {
            id: 'addr-1',
            label: 'Home',
            street: '1 Main St',
            suburb: 'Sydney',
            state: 'NSW',
            status: 'current',
            usageLocations: [usageLocation],
            createdAt,
            futureAddressKey: { source: 'web-2' },
          },
        ],
        deletions: {},
      };
      const { store, saveEncryptedData } = storeHolding(stored);

      const { value } = normalizeAddresses(stored);
      await saveVaultRecords(store, 'addresses', value);

      expectSavedEnvelope(saveEncryptedData, {
        type: 'addresses',
        value: {
          records: [
            {
              id: 'addr-1',
              label: 'Home',
              street: '1 Main St',
              suburb: 'Sydney',
              state: 'NSW',
              status: 'current',
              usageLocations: [usageLocation],
              createdAt,
              futureAddressKey: { source: 'web-2' },
            },
          ],
          deletions: {},
        },
      });
    });

    it('keeps an unknown field on a Mobile Number through normalize-then-save', async () => {
      const stored = {
        records: [
          {
            id: 'mob-1',
            label: 'Mobile',
            countryCode: '+61',
            phoneNumber: '400111222',
            usageLocations: [],
            createdAt,
            futureMobileKey: true,
          },
        ],
        deletions: {},
      };
      const { store, saveEncryptedData } = storeHolding(stored);

      const { value } = normalizeMobileNumbers(stored);
      await saveVaultRecords(store, 'mobileNumbers', value);

      expectSavedEnvelope(saveEncryptedData, {
        type: 'mobileNumbers',
        value: {
          records: [
            {
              id: 'mob-1',
              label: 'Mobile',
              countryCode: '+61',
              phoneNumber: '400111222',
              usageLocations: [],
              createdAt,
              futureMobileKey: true,
            },
          ],
          deletions: {},
        },
      });
    });

    it('does not mark changed when an Address and its Usage Location carry only unknown extra fields', () => {
      const result = normalizeAddresses([
        {
          id: 'addr-1',
          label: 'Home',
          status: 'current',
          usageLocations: [usageLocation],
          createdAt,
          futureAddressKey: { source: 'web-2' },
        },
      ]);
      expect(result.value[0].usageLocations).toEqual([usageLocation]);
      expect(result.value[0]).toHaveProperty('futureAddressKey');
      expect(result.changed).toBe(false);
    });

    it('does not mark changed when a Mobile Number carries only unknown extra fields', () => {
      const result = normalizeMobileNumbers([
        {
          id: 'mob-1',
          label: 'Mobile',
          countryCode: '+61',
          phoneNumber: '400111222',
          usageLocations: [],
          createdAt,
          futureMobileKey: true,
        },
      ]);
      expect(result.value[0]).toHaveProperty('futureMobileKey', true);
      expect(result.changed).toBe(false);
    });

    it('migrates the legacy changeType to updateMethod and does not carry it as an unknown field', () => {
      const result = normalizeAddresses([
        {
          id: 'addr-1',
          label: 'Home',
          status: 'current',
          createdAt,
          usageLocations: [
            {
              id: 'use-1',
              organisationName: 'Westpac',
              organisationType: 'bank',
              changeType: 'Phone',
              changed: false,
              priority: 'high',
              createdAt,
            },
          ],
        },
      ]);
      expect(result.value[0].usageLocations).toEqual([
        {
          id: 'use-1',
          organisationName: 'Westpac',
          organisationType: 'bank',
          updateMethod: 'phone',
          changed: false,
          priority: 'high',
          createdAt,
        },
      ]);
      expect(result.value[0].usageLocations[0]).not.toHaveProperty(
        'changeType',
      );
      expect(result.changed).toBe(true);
    });
  });
});
