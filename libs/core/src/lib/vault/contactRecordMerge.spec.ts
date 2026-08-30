import { mergeAddresses, mergeMobileNumbers } from './contactRecordMerge';
import type { AddressRecord, MobileNumberRecord } from './contactRecords';
import type { VaultBlobEnvelope } from './vaultBlobEnvelope';

describe('contactRecordMerge', () => {
  describe('mergeAddresses', () => {
    describe('union by id', () => {
      it('keeps addresses only in local', () => {
        const address: AddressRecord = {
          id: '1',
          label: 'Home',
          status: 'current',
          usageLocations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        const local: VaultBlobEnvelope<AddressRecord[]> = {
          records: [address],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<AddressRecord[]> = {
          records: [],
          deletions: {},
        };
        const result = mergeAddresses(local, remote);
        expect(result.records).toEqual([address]);
      });

      it('keeps addresses only in remote', () => {
        const address: AddressRecord = {
          id: '1',
          label: 'Work',
          status: 'current',
          usageLocations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        const local: VaultBlobEnvelope<AddressRecord[]> = {
          records: [],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<AddressRecord[]> = {
          records: [address],
          deletions: {},
        };
        const result = mergeAddresses(local, remote);
        expect(result.records).toEqual([address]);
      });

      it('keeps both addresses with different ids', () => {
        const local: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Home',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '2',
              label: 'Work',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeAddresses(local, remote);
        expect(result.records).toHaveLength(2);
      });
    });

    describe('updatedAt collision resolution', () => {
      it('keeps remote when remote updatedAt is newer', () => {
        const local: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Old Label',
              status: 'old',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'New Label',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-03T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeAddresses(local, remote);
        expect(result.records[0].label).toBe('New Label');
      });

      it('keeps local when local updatedAt is newer', () => {
        const local: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'New Label',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-03T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Old Label',
              status: 'old',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeAddresses(local, remote);
        expect(result.records[0].label).toBe('New Label');
      });
    });

    describe('createdAt fallback when updatedAt is absent', () => {
      it('uses createdAt when updatedAt is absent on both', () => {
        const local: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Older',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Newer',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeAddresses(local, remote);
        expect(result.records[0].label).toBe('Newer');
      });
    });

    describe('usageLocations are preserved', () => {
      it('keeps winning address with its own usageLocations intact', () => {
        const localUsageLocations = [
          {
            id: 'loc-1',
            organisationName: 'Bank A',
            organisationType: 'bank' as const,
            updateMethod: 'online' as const,
            changed: false,
            priority: 'high' as const,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ];
        const local: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Home',
              status: 'current',
              usageLocations: localUsageLocations,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-03T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Home (New)',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeAddresses(local, remote);
        expect(result.records[0].usageLocations).toBe(localUsageLocations);
      });
    });

    describe('deletion log precedence', () => {
      it('buries an address that was deleted', () => {
        const local: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Home',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: { '1': '2026-01-02T00:00:00.000Z' },
        };
        const remote: VaultBlobEnvelope<AddressRecord[]> = {
          records: [],
          deletions: {},
        };
        const result = mergeAddresses(local, remote);
        expect(result.records).toEqual([]);
      });

      it('deletion works in both directions', () => {
        const local: VaultBlobEnvelope<AddressRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Home',
              status: 'current',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<AddressRecord[]> = {
          records: [],
          deletions: { '1': '2026-01-02T00:00:00.000Z' },
        };
        const result = mergeAddresses(local, remote);
        expect(result.records).toEqual([]);
      });
    });
  });

  describe('mergeMobileNumbers', () => {
    describe('union by id', () => {
      it('keeps mobile numbers only in local', () => {
        const number: MobileNumberRecord = {
          id: '1',
          label: 'Personal',
          usageLocations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        const local: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [number],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [],
          deletions: {},
        };
        const result = mergeMobileNumbers(local, remote);
        expect(result.records).toEqual([number]);
      });

      it('keeps mobile numbers only in remote', () => {
        const number: MobileNumberRecord = {
          id: '1',
          label: 'Work',
          usageLocations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        const local: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [number],
          deletions: {},
        };
        const result = mergeMobileNumbers(local, remote);
        expect(result.records).toEqual([number]);
      });

      it('keeps both mobile numbers with different ids', () => {
        const local: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Personal',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '2',
              label: 'Work',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeMobileNumbers(local, remote);
        expect(result.records).toHaveLength(2);
      });
    });

    describe('updatedAt collision resolution', () => {
      it('keeps remote when remote updatedAt is newer', () => {
        const local: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Old',
              phoneNumber: '1111111111',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'New',
              phoneNumber: '2222222222',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-03T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeMobileNumbers(local, remote);
        expect(result.records[0].label).toBe('New');
        expect(result.records[0].phoneNumber).toBe('2222222222');
      });

      it('keeps local when local updatedAt is newer', () => {
        const local: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'New',
              phoneNumber: '2222222222',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-03T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Old',
              phoneNumber: '1111111111',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeMobileNumbers(local, remote);
        expect(result.records[0].label).toBe('New');
        expect(result.records[0].phoneNumber).toBe('2222222222');
      });
    });

    describe('createdAt fallback when updatedAt is absent', () => {
      it('uses createdAt when updatedAt is absent on both', () => {
        const local: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Older',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Newer',
              usageLocations: [],
              createdAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeMobileNumbers(local, remote);
        expect(result.records[0].label).toBe('Newer');
      });
    });

    describe('usageLocations are preserved', () => {
      it('keeps winning mobile number with its own usageLocations intact', () => {
        const localUsageLocations = [
          {
            id: 'loc-1',
            organisationName: 'Bank A',
            organisationType: 'bank' as const,
            updateMethod: 'phone' as const,
            changed: false,
            priority: 'high' as const,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ];
        const local: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Personal',
              usageLocations: localUsageLocations,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-03T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Personal',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const result = mergeMobileNumbers(local, remote);
        expect(result.records[0].usageLocations).toBe(localUsageLocations);
      });
    });

    describe('deletion log precedence', () => {
      it('buries a mobile number that was deleted', () => {
        const local: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Personal',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: { '1': '2026-01-02T00:00:00.000Z' },
        };
        const remote: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [],
          deletions: {},
        };
        const result = mergeMobileNumbers(local, remote);
        expect(result.records).toEqual([]);
      });

      it('deletion works in both directions', () => {
        const local: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [
            {
              id: '1',
              label: 'Personal',
              usageLocations: [],
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          deletions: {},
        };
        const remote: VaultBlobEnvelope<MobileNumberRecord[]> = {
          records: [],
          deletions: { '1': '2026-01-02T00:00:00.000Z' },
        };
        const result = mergeMobileNumbers(local, remote);
        expect(result.records).toEqual([]);
      });
    });
  });
});
