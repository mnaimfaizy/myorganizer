/**
 * Tests for computing vault sync status from queue status and unsent changes.
 */

import { VaultBlobType } from '@myorganizer/app-api-client';

import { computeVaultSyncStatus } from './vaultSyncStatus';
import type { VaultSyncQueueStatus } from './vaultSyncQueue';

describe('computeVaultSyncStatus', () => {
  /**
   * Helper to create a mock handle with configurable hasUnsentChanges behavior.
   */
  function createMockHandle(unsentMap: Map<string, boolean>) {
    return {
      hasUnsentChanges: jest.fn(async (field: string) => {
        return unsentMap.get(field) ?? false;
      }),
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
});
