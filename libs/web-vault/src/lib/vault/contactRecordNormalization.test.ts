// Every fixture below supplies its own `id` and `createdAt`, so neither
// `randomId` nor the clock is reached — no mock and no fake timers.
import {
  normalizeAddresses,
  normalizeMobileNumbers,
} from './contactRecordNormalization';

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
});
