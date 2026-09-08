/**
 * Tests for computing vault sync status from queue status and unsent changes.
 */

import { VaultBlobType } from '@myorganizer/app-api-client';

import { computeVaultSyncStatus } from './vaultSyncStatus';
import type { VaultSyncQueueStatus } from './vaultSyncQueue';
import type { VaultStorageV1 } from './localVaultStorage';
import { vaultIdentityOf } from './vaultMetaConverge';
import { localToServerMeta } from './vaultShapes';

describe('computeVaultSyncStatus', () => {
  /**
   * Helper to create a mock handle with configurable hasUnsentChanges, loadVault, and observedVaultIdentity behavior.
   */
  function createMockHandle(
    unsentMap: Map<string, boolean>,
    options: {
      vault?: any;
      observedIdentity?: string;
    } = {},
  ) {
    return {
      hasUnsentChanges: jest.fn(async (field: string) => {
        return unsentMap.get(field) ?? false;
      }),
      loadVault: jest.fn(() => options.vault ?? null),
      observedVaultIdentity: jest.fn(() => options.observedIdentity),
    };
  }

  /**
   * Helper to create a queue status with defaults.
   */
  function createQueueStatus(
    overrides: Partial<VaultSyncQueueStatus> = {},
  ): VaultSyncQueueStatus {
    return {
      unsentTypes: [],
      terminalFailures: [],
      sessionEnded: false,
      retryScheduled: false,
      ...overrides,
    };
  }

  test('all types clean → synced, no pending, empty arrays', async () => {
    const handle = createMockHandle(new Map());
    const queueStatus = createQueueStatus();

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('synced');
    expect(result.pendingTypes).toEqual([]);
    expect(result.terminalFailures).toEqual([]);
    expect(result.retrying).toBe(false);
  });

  test('one type dirty, nothing else → pending, retrying false', async () => {
    const unsentMap = new Map([['tasks', true]]);
    const handle = createMockHandle(unsentMap);
    const queueStatus = createQueueStatus({ retryScheduled: false });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('pending');
    expect(result.pendingTypes).toContain(VaultBlobType.Tasks);
    expect(result.retrying).toBe(false);
  });

  test('one type dirty → pending, retrying true when retryScheduled is true', async () => {
    const unsentMap = new Map([['tasks', true]]);
    const handle = createMockHandle(unsentMap);
    const queueStatus = createQueueStatus({ retryScheduled: true });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('pending');
    expect(result.pendingTypes).toContain(VaultBlobType.Tasks);
    expect(result.retrying).toBe(true);
  });

  test('terminal failure present → kind terminal even when pending types exist', async () => {
    const unsentMap = new Map([['addresses', true]]);
    const handle = createMockHandle(unsentMap);
    const queueStatus = createQueueStatus({
      terminalFailures: [{ type: VaultBlobType.Tasks, status: 422 }],
    });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('terminal');
    expect(result.pendingTypes).toContain(VaultBlobType.Addresses);
    expect(result.terminalFailures).toHaveLength(1);
    expect(result.terminalFailures[0]?.type).toBe(VaultBlobType.Tasks);
    expect(result.terminalFailures[0]?.status).toBe(422);
  });

  test('terminal type is skipped (not asked for hasUnsentChanges)', async () => {
    const unsentMap = new Map([['tasks', true]]);
    const handle = createMockHandle(unsentMap);
    const queueStatus = createQueueStatus({
      terminalFailures: [{ type: VaultBlobType.Tasks, status: 422 }],
    });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    // Tasks is terminal, so it should NOT be in pendingTypes
    expect(result.pendingTypes).not.toContain(VaultBlobType.Tasks);

    // Verify hasUnsentChanges was never called for tasks
    const hasUnsentChangesCalls = (handle.hasUnsentChanges as jest.Mock).mock
      .calls;
    const tasksFieldCalls = hasUnsentChangesCalls.filter(
      (call) => call[0] === 'tasks',
    );
    expect(tasksFieldCalls).toHaveLength(0);
  });

  test('sessionEnded true → kind session-ended, takes priority', async () => {
    const unsentMap = new Map([['tasks', true]]);
    const handle = createMockHandle(unsentMap);
    const queueStatus = createQueueStatus({
      sessionEnded: true,
      terminalFailures: [{ type: VaultBlobType.Addresses, status: 422 }],
    });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('session-ended');
    expect(result.pendingTypes).toContain(VaultBlobType.Tasks);
    expect(result.terminalFailures).toHaveLength(1);
    expect(result.retrying).toBe(false);
  });

  test('sessionEnded, terminalFailures, and pendingTypes all present → sessionEnded wins', async () => {
    const unsentMap = new Map([
      ['groceries', true],
      ['addresses', false],
    ]);
    const handle = createMockHandle(unsentMap);
    const queueStatus = createQueueStatus({
      sessionEnded: true,
      terminalFailures: [
        { type: VaultBlobType.MobileNumbers, status: 422 },
        { type: VaultBlobType.Tasks, status: 422 },
      ],
      retryScheduled: false,
    });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('session-ended');
    expect(result.pendingTypes).toContain(VaultBlobType.Groceries);
    expect(result.terminalFailures).toHaveLength(2);
  });

  test('multiple terminal failures included in result', async () => {
    const handle = createMockHandle(new Map());
    const queueStatus = createQueueStatus({
      terminalFailures: [
        { type: VaultBlobType.Tasks, status: 422 },
        { type: VaultBlobType.Addresses, status: 422 },
      ],
    });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('terminal');
    expect(result.terminalFailures).toHaveLength(2);
    expect(result.terminalFailures.map((f) => f.type)).toContain(
      VaultBlobType.Tasks,
    );
    expect(result.terminalFailures.map((f) => f.type)).toContain(
      VaultBlobType.Addresses,
    );
  });

  test('multiple pending types included in result', async () => {
    const unsentMap = new Map([
      ['tasks', true],
      ['addresses', true],
    ]);
    const handle = createMockHandle(unsentMap);
    const queueStatus = createQueueStatus();

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('pending');
    expect(result.pendingTypes).toHaveLength(2);
    expect(result.pendingTypes).toContain(VaultBlobType.Tasks);
    expect(result.pendingTypes).toContain(VaultBlobType.Addresses);
  });

  test('terminal type excluded from pending even if hasUnsentChanges says unsent', async () => {
    const unsentMap = new Map([['tasks', true]]);
    const handle = createMockHandle(unsentMap);
    const queueStatus = createQueueStatus({
      terminalFailures: [{ type: VaultBlobType.Tasks, status: 422 }],
    });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    // Even though hasUnsentChanges returns true for tasks, it's not in pendingTypes
    // because it's in terminalFailures
    expect(result.pendingTypes).not.toContain(VaultBlobType.Tasks);
    expect(result.terminalFailures).toHaveLength(1);
  });

  test('retrying field is false for terminal kind', async () => {
    const handle = createMockHandle(new Map());
    const queueStatus = createQueueStatus({
      terminalFailures: [{ type: VaultBlobType.Tasks, status: 422 }],
      retryScheduled: true,
    });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('terminal');
    expect(result.retrying).toBe(false);
  });

  test('retrying field is false for session-ended kind', async () => {
    const handle = createMockHandle(new Map());
    const queueStatus = createQueueStatus({
      sessionEnded: true,
      retryScheduled: true,
    });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('session-ended');
    expect(result.retrying).toBe(false);
  });

  test('retrying field is false for synced kind', async () => {
    const handle = createMockHandle(new Map());
    const queueStatus = createQueueStatus({ retryScheduled: true });

    const result = await computeVaultSyncStatus({ handle, queueStatus });

    expect(result.kind).toBe('synced');
    expect(result.retrying).toBe(false);
  });

  test('iterated all types to build pending (not early exit)', async () => {
    // Verify that all 6 types are checked even when some are terminal
    const unsentMap = new Map([
      ['tasks', true],
      ['addresses', true],
      ['groceries', false],
      ['mobileNumbers', false],
      ['subscriptions', false],
      ['todos', false],
    ]);
    const handle = createMockHandle(unsentMap);
    const queueStatus = createQueueStatus({
      terminalFailures: [
        { type: VaultBlobType.Todos, status: 422 }, // excluded from pending
      ],
    });

    await computeVaultSyncStatus({ handle, queueStatus });

    // Should have called hasUnsentChanges for all except todos (which is terminal)
    const callCount = (handle.hasUnsentChanges as jest.Mock).mock.calls.length;
    expect(callCount).toBe(5); // All 6 types minus todos which is skipped
  });

  describe('Observed Vault Identity and standoff detection', () => {
    /**
     * Minimal vault fixture for testing standoff — contains only what vaultIdentityOf reads.
     * No Master Key or plaintext needed.
     */
    function makeMinimalVault(saltValue = 'default-salt'): VaultStorageV1 {
      return {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: saltValue,
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'passphrase-iv',
          ciphertext: 'passphrase-ct',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'recovery-iv',
          ciphertext: 'recovery-ct',
        },
        data: {},
      };
    }

    test('no local vault + observed identity → no standoff (cannot compare)', async () => {
      const handle = createMockHandle(new Map(), {
        vault: null, // No local vault
        observedIdentity: 'some-observed-identity',
      });
      const queueStatus = createQueueStatus();

      const result = await computeVaultSyncStatus({ handle, queueStatus });

      // Even though observedVaultIdentity is defined, no local vault means no standoff
      expect(result.kind).not.toBe('standoff');
      expect(result.kind).toBe('synced'); // All evidence says synced
    });

    test('local vault + undefined observed identity → no standoff (under-reporting)', async () => {
      const vault = makeMinimalVault();
      const handle = createMockHandle(new Map(), {
        vault,
        observedIdentity: undefined, // Never observed
      });
      const queueStatus = createQueueStatus();

      const result = await computeVaultSyncStatus({ handle, queueStatus });

      // No observation means no standoff — under-report rather than guess
      expect(result.kind).not.toBe('standoff');
      expect(result.kind).toBe('synced');
    });

    test('local vault + matching observed identity → no standoff (self-clearing)', async () => {
      // The vault's own identity matches the observed one
      const vault = makeMinimalVault('matching-salt');
      const expectedIdentity = vaultIdentityOf(localToServerMeta(vault));

      const handle = createMockHandle(new Map(), {
        vault,
        observedIdentity: expectedIdentity, // Matches local vault's own
      });
      const queueStatus = createQueueStatus();

      const result = await computeVaultSyncStatus({ handle, queueStatus });

      // Standoff clears on its own — local and observed match
      expect(result.kind).not.toBe('standoff');
      expect(result.kind).toBe('synced');
    });

    test('local vault + matching identity then re-derives as not standoff', async () => {
      // Start with differing identity, then it matches
      const vault = makeMinimalVault('local-salt');
      const expectedIdentity = vaultIdentityOf(localToServerMeta(vault));

      // Create a handle that initially has a different observed identity
      let observedId: string | undefined = 'different-identity';
      const handle = {
        hasUnsentChanges: jest.fn(async () => false),
        loadVault: jest.fn(() => vault),
        observedVaultIdentity: jest.fn(() => observedId),
      };

      // First call: differing identity → standoff
      const queueStatus = createQueueStatus();
      let result = await computeVaultSyncStatus({ handle, queueStatus });
      expect(result.kind).toBe('standoff');

      // Now update the observed identity to match
      observedId = expectedIdentity;

      // Second call: matching identity → not standoff anymore
      result = await computeVaultSyncStatus({ handle, queueStatus });
      expect(result.kind).not.toBe('standoff');
      expect(result.kind).toBe('synced');
    });

    test('local vault + differing observed identity → standoff', async () => {
      const vault = makeMinimalVault('local-salt');
      // Use a different salt to create a different identity
      const differentVault = makeMinimalVault('different-salt');
      const observedIdentity = vaultIdentityOf(localToServerMeta(differentVault));

      const handle = createMockHandle(new Map(), {
        vault,
        observedIdentity,
      });
      const queueStatus = createQueueStatus();

      const result = await computeVaultSyncStatus({ handle, queueStatus });

      expect(result.kind).toBe('standoff');
      expect(result.pendingTypes).toEqual([]);
      expect(result.terminalFailures).toEqual([]);
      expect(result.retrying).toBe(false);
    });

    test('standoff + pending types → both recorded in standoff status', async () => {
      const vault = makeMinimalVault('local-salt');
      const differentVault = makeMinimalVault('different-salt');
      const observedIdentity = vaultIdentityOf(localToServerMeta(differentVault));

      const unsentMap = new Map([['tasks', true]]);
      const handle = createMockHandle(unsentMap, {
        vault,
        observedIdentity,
      });
      const queueStatus = createQueueStatus();

      const result = await computeVaultSyncStatus({ handle, queueStatus });

      expect(result.kind).toBe('standoff');
      expect(result.pendingTypes).toContain(VaultBlobType.Tasks);
      expect(result.terminalFailures).toEqual([]);
      expect(result.retrying).toBe(false);
    });

    test('standoff + terminal failures → both recorded in standoff status', async () => {
      const vault = makeMinimalVault('local-salt');
      const differentVault = makeMinimalVault('different-salt');
      const observedIdentity = vaultIdentityOf(localToServerMeta(differentVault));

      const handle = createMockHandle(new Map(), {
        vault,
        observedIdentity,
      });
      const queueStatus = createQueueStatus({
        terminalFailures: [{ type: VaultBlobType.Addresses, status: 422 }],
      });

      const result = await computeVaultSyncStatus({ handle, queueStatus });

      expect(result.kind).toBe('standoff');
      expect(result.terminalFailures).toHaveLength(1);
      expect(result.terminalFailures[0]?.type).toBe(VaultBlobType.Addresses);
      expect(result.retrying).toBe(false);
    });

    test('session-ended takes priority over standoff', async () => {
      const vault = makeMinimalVault('local-salt');
      const differentVault = makeMinimalVault('different-salt');
      const observedIdentity = vaultIdentityOf(localToServerMeta(differentVault));

      const handle = createMockHandle(new Map(), {
        vault,
        observedIdentity,
      });
      const queueStatus = createQueueStatus({ sessionEnded: true });

      const result = await computeVaultSyncStatus({ handle, queueStatus });

      // session-ended is checked before standoff
      expect(result.kind).toBe('session-ended');
      expect(result.retrying).toBe(false);
    });

    test('standoff takes priority over terminal', async () => {
      const vault = makeMinimalVault('local-salt');
      const differentVault = makeMinimalVault('different-salt');
      const observedIdentity = vaultIdentityOf(localToServerMeta(differentVault));

      const handle = createMockHandle(new Map(), {
        vault,
        observedIdentity,
      });
      const queueStatus = createQueueStatus({
        terminalFailures: [{ type: VaultBlobType.Tasks, status: 422 }],
      });

      const result = await computeVaultSyncStatus({ handle, queueStatus });

      // standoff is checked before terminal
      expect(result.kind).toBe('standoff');
      expect(result.terminalFailures).toHaveLength(1);
      expect(result.retrying).toBe(false);
    });

    test('vault-locked case: no Master Key needed for standoff derivation', async () => {
      // A vault fixture that would require a Master Key to decrypt, but identity derivation should work anyway
      const vault = makeMinimalVault('locked-salt');
      const differentVault = makeMinimalVault('different-salt');
      const observedIdentity = vaultIdentityOf(localToServerMeta(differentVault));

      const handle = createMockHandle(new Map(), {
        vault,
        observedIdentity,
      });
      const queueStatus = createQueueStatus();

      // This should work even though the vault is "locked" (loadVault returns a vault without any decrypt capability)
      // because vaultIdentityOf only reads the salt from kdf, not any encrypted data
      const result = await computeVaultSyncStatus({ handle, queueStatus });

      expect(result.kind).toBe('standoff');
      // No assertion about isUnlocked needed — it's not in the Pick, proving unlock is not required
    });
  });
});
