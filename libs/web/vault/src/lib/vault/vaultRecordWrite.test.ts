import type { VaultBlobEnvelope } from '@myorganizer/vault-core';

import {
  type EditableVaultRecordType,
  type VaultRecordStore,
  deleteVaultRecordAndSave,
  saveVaultRecords,
} from './vaultRecordWrite';

describe('vaultRecordWrite', () => {
  let store: VaultRecordStore;
  let loadDecryptedDataMock: jest.Mock;
  let saveEncryptedDataMock: jest.Mock;

  beforeEach(() => {
    loadDecryptedDataMock = jest.fn();
    saveEncryptedDataMock = jest.fn().mockResolvedValue(undefined);
    store = {
      loadDecryptedData: loadDecryptedDataMock,
      saveEncryptedData: saveEncryptedDataMock,
    };
  });

  describe('saveVaultRecords', () => {
    const type: EditableVaultRecordType = 'tasks';

    test('should save envelope with deletions from stored payload', async () => {
      const record1 = { id: 'task-1', title: 'Task 1' };
      const record2 = { id: 'task-2', title: 'Task 2' };
      const records = [record1, record2];

      const storedEnvelope: VaultBlobEnvelope<unknown> = {
        records: [{ id: 'old-task', title: 'Old' }],
        deletions: { 'deleted-task': '2026-01-01T10:00:00.000Z' },
      };
      loadDecryptedDataMock.mockResolvedValue(storedEnvelope);

      await saveVaultRecords(store, type, records);

      expect(loadDecryptedDataMock).toHaveBeenCalledWith({
        type,
        defaultValue: null,
      });
      expect(saveEncryptedDataMock).toHaveBeenCalledWith({
        type,
        value: {
          records,
          deletions: { 'deleted-task': '2026-01-01T10:00:00.000Z' },
        },
      });
    });

    test('should save envelope with empty deletions from bare legacy array', async () => {
      const records = [
        { id: 'task-1', title: 'Task 1' },
        { id: 'task-2', title: 'Task 2' },
      ];

      const legacyPayload = [{ id: 'old-task', title: 'Old' }];
      loadDecryptedDataMock.mockResolvedValue(legacyPayload);

      await saveVaultRecords(store, type, records);

      expect(saveEncryptedDataMock).toHaveBeenCalledWith({
        type,
        value: {
          records,
          deletions: {},
        },
      });
    });

    test('should save envelope with empty deletions when nothing stored', async () => {
      const records = [{ id: 'task-1', title: 'Task 1' }];
      loadDecryptedDataMock.mockResolvedValue(null);

      await saveVaultRecords(store, type, records);

      expect(saveEncryptedDataMock).toHaveBeenCalledWith({
        type,
        value: {
          records,
          deletions: {},
        },
      });
    });

    test('should sanitize deletion log by dropping unusable entries', async () => {
      const records = [{ id: 'task-1', title: 'Task 1' }];

      const storedEnvelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: {
          a: null as unknown as string,
          b: 'not-a-date',
          c: '2026-01-01T10:00:00.000Z',
          d: '', // empty id
        },
      };
      loadDecryptedDataMock.mockResolvedValue(storedEnvelope);

      await saveVaultRecords(store, type, records);

      const savedValue = (saveEncryptedDataMock.mock.calls[0] as unknown[])[0];
      const envelope = (savedValue as Record<string, unknown>)
        .value as VaultBlobEnvelope<unknown>;
      expect(envelope.deletions).toEqual({
        c: '2026-01-01T10:00:00.000Z',
      });
    });

    test('should reject when loadDecryptedData rejects', async () => {
      const records = [{ id: 'task-1', title: 'Task 1' }];
      const error = new Error('Decryption failed');
      loadDecryptedDataMock.mockRejectedValue(error);

      await expect(saveVaultRecords(store, type, records)).rejects.toThrow(
        'Decryption failed',
      );
      expect(saveEncryptedDataMock).not.toHaveBeenCalled();
    });

    test('should work with addresses type', async () => {
      const type: EditableVaultRecordType = 'addresses';
      const records = [
        {
          id: 'addr-1',
          line1: '123 Main St',
          city: 'City',
          country: 'Country',
        },
      ];
      loadDecryptedDataMock.mockResolvedValue(null);

      await saveVaultRecords(store, type, records);

      expect(loadDecryptedDataMock).toHaveBeenCalledWith({
        type,
        defaultValue: null,
      });
      expect(saveEncryptedDataMock).toHaveBeenCalledWith({
        type,
        value: expect.objectContaining({
          records,
          deletions: {},
        }),
      });
    });
  });

  describe('deleteVaultRecordAndSave', () => {
    const type: EditableVaultRecordType = 'tasks';
    const deletedAt = '2026-01-01T12:00:00.000Z';

    test('should remove record by id and record deletion', async () => {
      const record1 = { id: 'task-1', title: 'Task 1' };
      const record2 = { id: 'task-2', title: 'Task 2' };
      const records = [record1, record2];

      loadDecryptedDataMock.mockResolvedValue(null);

      const remaining = await deleteVaultRecordAndSave(
        store,
        type,
        records,
        'task-1',
        deletedAt,
      );

      expect(remaining).toEqual([record2]);
      expect(saveEncryptedDataMock).toHaveBeenCalledWith({
        type,
        value: {
          records: [record2],
          deletions: { 'task-1': deletedAt },
        },
      });
    });

    test('should keep existing deletion log entries', async () => {
      const records = [
        { id: 'task-1', title: 'Task 1' },
        { id: 'task-2', title: 'Task 2' },
      ];

      const storedEnvelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: {
          'task-3': '2026-01-01T10:00:00.000Z',
          'task-4': '2026-01-01T11:00:00.000Z',
        },
      };
      loadDecryptedDataMock.mockResolvedValue(storedEnvelope);

      await deleteVaultRecordAndSave(store, type, records, 'task-1', deletedAt);

      const savedValue = (saveEncryptedDataMock.mock.calls[0] as unknown[])[0];
      const envelope = (savedValue as Record<string, unknown>)
        .value as VaultBlobEnvelope<unknown>;
      expect(envelope.deletions).toEqual({
        'task-3': '2026-01-01T10:00:00.000Z',
        'task-4': '2026-01-01T11:00:00.000Z',
        'task-1': deletedAt,
      });
    });

    test('should replace old deletion entry with newer one for same id', async () => {
      const records = [{ id: 'task-1', title: 'Task 1' }];
      const olderDeletionTime = '2026-01-01T10:00:00.000Z';
      const newerDeletionTime = '2026-01-01T12:00:00.000Z';

      const storedEnvelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: { 'task-1': olderDeletionTime },
      };
      loadDecryptedDataMock.mockResolvedValue(storedEnvelope);

      await deleteVaultRecordAndSave(
        store,
        type,
        records,
        'task-1',
        newerDeletionTime,
      );

      const savedValue = (saveEncryptedDataMock.mock.calls[0] as unknown[])[0];
      const envelope = (savedValue as Record<string, unknown>)
        .value as VaultBlobEnvelope<unknown>;
      expect(envelope.deletions['task-1']).toBe(newerDeletionTime);
    });

    test('should keep older deletion entry when new deletion time is older', async () => {
      const records = [{ id: 'task-1', title: 'Task 1' }];
      const newerStoredTime = '2026-01-01T12:00:00.000Z';
      const olderDeletionTime = '2026-01-01T10:00:00.000Z';

      const storedEnvelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: { 'task-1': newerStoredTime },
      };
      loadDecryptedDataMock.mockResolvedValue(storedEnvelope);

      await deleteVaultRecordAndSave(
        store,
        type,
        records,
        'task-1',
        olderDeletionTime,
      );

      const savedValue = (saveEncryptedDataMock.mock.calls[0] as unknown[])[0];
      const envelope = (savedValue as Record<string, unknown>)
        .value as VaultBlobEnvelope<unknown>;
      expect(envelope.deletions['task-1']).toBe(newerStoredTime);
    });

    test('should record deletion even when record not in list', async () => {
      const records = [{ id: 'task-1', title: 'Task 1' }];
      loadDecryptedDataMock.mockResolvedValue(null);

      const remaining = await deleteVaultRecordAndSave(
        store,
        type,
        records,
        'task-999', // not in list
        deletedAt,
      );

      expect(remaining).toEqual(records);
      expect(saveEncryptedDataMock).toHaveBeenCalledWith({
        type,
        value: {
          records,
          deletions: { 'task-999': deletedAt },
        },
      });
    });

    test('should return remaining records with same object references', async () => {
      const record1 = { id: 'task-1', title: 'Task 1' };
      const record2 = { id: 'task-2', title: 'Task 2' };
      const record3 = { id: 'task-3', title: 'Task 3' };
      const records = [record1, record2, record3];

      loadDecryptedDataMock.mockResolvedValue(null);

      const remaining = await deleteVaultRecordAndSave(
        store,
        type,
        records,
        'task-2',
        deletedAt,
      );

      expect(remaining).toHaveLength(2);
      expect(remaining[0]).toBe(record1);
      expect(remaining[1]).toBe(record3);
    });

    test('should reject when loadDecryptedData rejects', async () => {
      const records = [{ id: 'task-1', title: 'Task 1' }];
      const error = new Error('Decryption failed');
      loadDecryptedDataMock.mockRejectedValue(error);

      await expect(
        deleteVaultRecordAndSave(store, type, records, 'task-1', deletedAt),
      ).rejects.toThrow('Decryption failed');
      expect(saveEncryptedDataMock).not.toHaveBeenCalled();
    });

    test('should work with mobile numbers type', async () => {
      const type: EditableVaultRecordType = 'mobileNumbers';
      const records = [
        { id: 'num-1', number: '+1234567890' },
        { id: 'num-2', number: '+0987654321' },
      ];

      loadDecryptedDataMock.mockResolvedValue(null);

      const remaining = await deleteVaultRecordAndSave(
        store,
        type,
        records,
        'num-1',
        deletedAt,
      );

      expect(remaining).toEqual([{ id: 'num-2', number: '+0987654321' }]);
      expect(saveEncryptedDataMock).toHaveBeenCalledWith({
        type,
        value: expect.objectContaining({
          deletions: { 'num-1': deletedAt },
        }),
      });
    });

    test('should work with subscriptions type', async () => {
      const type: EditableVaultRecordType = 'subscriptions';
      const records = [
        { id: 'sub-1', name: 'Service 1' },
        { id: 'sub-2', name: 'Service 2' },
      ];

      loadDecryptedDataMock.mockResolvedValue(null);

      const remaining = await deleteVaultRecordAndSave(
        store,
        type,
        records,
        'sub-2',
        deletedAt,
      );

      expect(remaining).toEqual([{ id: 'sub-1', name: 'Service 1' }]);
    });
  });
});
