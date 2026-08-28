import { VaultBlobType } from '@myorganizer/app-api-client';
import type { VaultSyncStatus } from '@myorganizer/web-vault';
import {
  VAULT_BLOB_TYPE_LABELS,
  describeVaultSyncStatus,
  vaultBlobTypeLabel,
} from './vaultSyncMessages';

describe('vaultSyncMessages', () => {
  describe('vaultBlobTypeLabel', () => {
    test('returns label for Addresses', () => {
      expect(vaultBlobTypeLabel(VaultBlobType.Addresses)).toBe('Addresses');
    });

    test('returns label for Groceries', () => {
      expect(vaultBlobTypeLabel(VaultBlobType.Groceries)).toBe('Grocery Lists');
    });

    test('returns label for MobileNumbers', () => {
      expect(vaultBlobTypeLabel(VaultBlobType.MobileNumbers)).toBe(
        'Mobile Numbers',
      );
    });

    test('returns label for Subscriptions', () => {
      expect(vaultBlobTypeLabel(VaultBlobType.Subscriptions)).toBe(
        'Subscriptions',
      );
    });

    test('returns label for Tasks', () => {
      expect(vaultBlobTypeLabel(VaultBlobType.Tasks)).toBe('Tasks');
    });

    test('returns label for Todos', () => {
      expect(vaultBlobTypeLabel(VaultBlobType.Todos)).toBe('Todos');
    });

    test('every VaultBlobType member has a label via constant', () => {
      const allTypes: VaultBlobType[] = [
        VaultBlobType.Addresses,
        VaultBlobType.Groceries,
        VaultBlobType.MobileNumbers,
        VaultBlobType.Subscriptions,
        VaultBlobType.Tasks,
        VaultBlobType.Todos,
      ];

      for (const type of allTypes) {
        expect(VAULT_BLOB_TYPE_LABELS[type]).toBeDefined();
        expect(typeof VAULT_BLOB_TYPE_LABELS[type]).toBe('string');
      }
    });
  });

  describe('describeVaultSyncStatus', () => {
    test('null status returns pending tone with no labels', () => {
      const reading = describeVaultSyncStatus(null);
      expect(reading).toEqual({
        tone: 'pending',
        label: null,
        detail: null,
        canRetry: false,
      });
    });

    test('synced status returns ok tone with no labels', () => {
      const status: VaultSyncStatus = {
        kind: 'synced',
        pendingTypes: [],
        terminalFailures: [],
        retrying: false,
      };

      const reading = describeVaultSyncStatus(status);
      expect(reading).toEqual({
        tone: 'ok',
        label: null,
        detail: null,
        canRetry: false,
      });
    });

    test('pending status with single type returns correct label and detail', () => {
      const status: VaultSyncStatus = {
        kind: 'pending',
        pendingTypes: [VaultBlobType.Tasks],
        terminalFailures: [],
        retrying: false,
      };

      const reading = describeVaultSyncStatus(status);
      expect(reading.tone).toBe('pending');
      expect(reading.label).toBe('Changes not yet sent');
      expect(reading.detail).toBe(
        'Not yet reached the server: Tasks. Your edits are saved on this device.',
      );
      expect(reading.canRetry).toBe(true);
    });

    test('pending status with multiple types lists all types', () => {
      const status: VaultSyncStatus = {
        kind: 'pending',
        pendingTypes: [VaultBlobType.Tasks, VaultBlobType.Groceries],
        terminalFailures: [],
        retrying: false,
      };

      const reading = describeVaultSyncStatus(status);
      expect(reading.detail).toContain('Tasks');
      expect(reading.detail).toContain('Grocery Lists');
      expect(reading.detail).toContain('Not yet reached the server');
    });

    test('pending status without retrying does not include retry text', () => {
      const status: VaultSyncStatus = {
        kind: 'pending',
        pendingTypes: [VaultBlobType.Tasks],
        terminalFailures: [],
        retrying: false,
      };

      const reading = describeVaultSyncStatus(status);
      expect(reading.detail).not.toContain('Retrying automatically');
    });

    test('pending status with retrying includes retry text', () => {
      const status: VaultSyncStatus = {
        kind: 'pending',
        pendingTypes: [VaultBlobType.Tasks],
        terminalFailures: [],
        retrying: true,
      };

      const reading = describeVaultSyncStatus(status);
      expect(reading.detail).toContain('Retrying automatically.');
    });

    test('session-ended status returns error tone with session message', () => {
      const status: VaultSyncStatus = {
        kind: 'session-ended',
        pendingTypes: [],
        terminalFailures: [],
        retrying: false,
      };

      const reading = describeVaultSyncStatus(status);
      expect(reading.tone).toBe('error');
      expect(reading.label).toBe('Sync stopped — sign in again');
      expect(reading.detail).toContain('session ended');
      expect(reading.detail).toContain('Sign in again');
      expect(reading.canRetry).toBe(true);
    });

    test('terminal status with single failure returns error tone with type name', () => {
      const status: VaultSyncStatus = {
        kind: 'terminal',
        pendingTypes: [],
        terminalFailures: [{ type: VaultBlobType.Groceries, status: 422 }],
        retrying: false,
      };

      const reading = describeVaultSyncStatus(status);
      expect(reading.tone).toBe('error');
      expect(reading.label).toBe('Some changes could not be saved');
      expect(reading.detail).toContain('Grocery Lists');
      expect(reading.detail).toContain('server rejected');
      expect(reading.canRetry).toBe(true);
    });

    test('terminal status does not contain "not synced yet" or "not yet reached"', () => {
      const status: VaultSyncStatus = {
        kind: 'terminal',
        pendingTypes: [],
        terminalFailures: [{ type: VaultBlobType.Tasks, status: 422 }],
        retrying: false,
      };

      const reading = describeVaultSyncStatus(status);
      expect(reading.detail).not.toMatch(/not synced yet/i);
      expect(reading.detail).not.toMatch(/not yet reached the server/i);
    });

    test('terminal status with multiple failures names all affected types', () => {
      const status: VaultSyncStatus = {
        kind: 'terminal',
        pendingTypes: [],
        terminalFailures: [
          { type: VaultBlobType.Groceries, status: 422 },
          { type: VaultBlobType.Tasks, status: 422 },
          { type: VaultBlobType.Subscriptions, status: 422 },
        ],
        retrying: false,
      };

      const reading = describeVaultSyncStatus(status);
      expect(reading.detail).toContain('Grocery Lists');
      expect(reading.detail).toContain('Tasks');
      expect(reading.detail).toContain('Subscriptions');
    });

    test('security: output contains only fixed template text and blob type labels', () => {
      const status: VaultSyncStatus = {
        kind: 'terminal',
        pendingTypes: [],
        terminalFailures: [{ type: VaultBlobType.Tasks, status: 422 }],
        retrying: false,
      };

      const reading = describeVaultSyncStatus(status);

      // Verify the text is composed only of safe, fixed parts — no leaked error objects
      for (const text of [reading.label, reading.detail]) {
        if (text) {
          expect(text).toBeDefined();
          expect(text).not.toMatch(/\[object/); // no object stringification
          expect(text).not.toMatch(/error/i); // no error keyword
          expect(text).not.toMatch(/stack/i); // no stack trace
          expect(text).not.toMatch(/at /); // no stack frames
        }
      }
    });
  });
});
