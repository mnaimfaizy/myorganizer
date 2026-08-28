/**
 * Tests for the Vault Handle sync sink queue — the thing that turns a local
 * vault save into a Vault Push through the converge primitive.
 *
 * The queue holds types, never payloads. A marked type stays marked until a
 * drain converges it. Coalescing is structural: multiple marks of the same
 * type in one turn → one drain call that reads the Local Vault at drain time.
 */

// === Global setup for jsdom ===
if (
  typeof (globalThis as unknown as { TextEncoder?: unknown }).TextEncoder ===
  'undefined'
) {
  const { TextEncoder, TextDecoder } = require('util');
  (globalThis as unknown as Record<string, unknown>).TextEncoder = TextEncoder;
  (globalThis as unknown as Record<string, unknown>).TextDecoder = TextDecoder;
}

// === Polyfill crypto.subtle for Node's jsdom environment ===
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).crypto?.subtle) {
  const { webcrypto } = require('crypto');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).crypto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).crypto = {};
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto.subtle = webcrypto.subtle;
}

import type { AxiosResponse } from 'axios';
import { VaultBlobType } from '@myorganizer/app-api-client';
import type { VaultBlobEnvelope } from '@myorganizer/core';

import { createVaultHandle } from './vaultHandle';
import {
  createVaultSyncQueue,
  type VaultSyncDrainScheduler,
  VAULT_SYNC_DRAIN_DELAY_MS,
} from './vaultSyncQueue';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('createVaultSyncQueue', () => {
  const passphrase = 'test pass 2026';

  /**
   * Helper to safely get a call argument from a mock.
   */
  function getCallArg<T>(
    mock: { mock: { calls: unknown[][] } },
    callIndex: number,
    argIndex = 0,
  ): T | undefined {
    return (mock.mock.calls[callIndex] as unknown[])?.[argIndex] as
      | T
      | undefined;
  }

  /**
   * Helper to create a properly typed API double for vault operations.
   */
  function createApiDouble() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getVaultBlob: jest.fn<Promise<AxiosResponse<any>>, [any?]>(),
      putVaultBlob: jest.fn<
        Promise<
          AxiosResponse<{
            ok: boolean;
            etag: string;
            updatedAt: string;
            message: string;
          }>
        >,
        [
          {
            type: VaultBlobType;
            putVaultBlobRequest: unknown;
            ifMatch?: string;
          },
        ]
      >(),
    };
  }

  /**
   * Helper to create a vault handle bound to an owner with WebCrypto.
   */
  async function setupHandle(
    owner: string,
    payload?: unknown,
    type: 'tasks' | 'groceries' | 'addresses' = 'tasks',
  ) {
    const handle = createVaultHandle({ owner });
    await handle.initialize({ passphrase });
    await handle.unlockWithPassphrase({ passphrase });

    if (payload) {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: payload,
        deletions: {},
      };
      await handle.saveEncryptedData({ type, value: envelope });
    }

    return handle;
  }

  /**
   * Helper to format putVaultBlob response.
   */
  function formatPutVaultBlobResponse(etag: string): AxiosResponse<{
    ok: boolean;
    etag: string;
    updatedAt: string;
    message: string;
  }> {
    return {
      data: {
        ok: true,
        etag,
        updatedAt: '2026-01-01T00:00:00.000Z',
        message: 'OK',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { headers: {} as any },
    } as unknown as AxiosResponse<{
      ok: boolean;
      etag: string;
      updatedAt: string;
      message: string;
    }>;
  }

  test('should mark a type and schedule drain', async () => {
    // Matrix row: "mark a type"
    const handle = await setupHandle('user-1');
    const api = createApiDouble();
    const prompt = jest.fn();

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultSyncDrainScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const queue = createVaultSyncQueue({ api, prompt, schedule });

    // Mark a type
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    // Verify type is marked
    expect(queue.unsentTypes()).toEqual([VaultBlobType.Tasks]);

    // Verify schedule was called exactly once
    expect(scheduledCallbacks).toHaveLength(1);

    // Verify no API calls yet (drain hasn't run)
    expect(api.putVaultBlob).not.toHaveBeenCalled();
    expect(api.getVaultBlob).not.toHaveBeenCalled();
  });

  test('should coalesce multiple marks into one drain per turn', async () => {
    // Matrix row: "queue holds types not payloads"
    const handle = await setupHandle('user-1');
    const api = createApiDouble();
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-new'));

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultSyncDrainScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const queue = createVaultSyncQueue({ api, prompt: jest.fn(), schedule });

    // Mark the same type multiple times in one turn
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    // Only one callback scheduled
    expect(scheduledCallbacks).toHaveLength(1);

    // unsentTypes still has only one entry
    expect(queue.unsentTypes()).toEqual([VaultBlobType.Tasks]);
  });

  test('should read local vault ciphertext at drain time', async () => {
    // Matrix row: "coalescing"
    // Ensures drain reads the Local Vault when it runs, not at mark time
    const handle = await setupHandle('user-1', [
      { id: 'task-a', title: 'Task A' },
    ]);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    // Save dirty state with Task B
    const envelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'task-b', title: 'Task B' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope });

    const api = createApiDouble();
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-2'));

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultSyncDrainScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule,
    });

    // Mark the type
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    // Run the scheduled drain
    expect(scheduledCallbacks).toHaveLength(1);
    const result = await queue.drain(handle);

    // Verify drain result is well-formed
    expect(result.converged.length).toBeGreaterThan(0);

    // Verify putVaultBlob was called
    expect(api.putVaultBlob).toHaveBeenCalledTimes(1);

    // Get the ciphertext from the call
    const callArg = getCallArg<{
      type: VaultBlobType;
      putVaultBlobRequest: { type: VaultBlobType; blob: unknown };
    }>(api.putVaultBlob, 0);

    // Verify the ciphertext matches the current Local Vault (Task B's blob)
    const currentVault = handle.loadVault();
    const expectedBlob = currentVault?.data.tasks;
    expect(callArg?.putVaultBlobRequest.blob).toEqual({
      iv: expectedBlob?.iv,
      ciphertext: expectedBlob?.ciphertext,
      version: 1, // toEncryptedBlobV1 always includes version: 1
    });
  });

  test('should clear marks after successful drain', async () => {
    // Matrix row: "drain clears marks"
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const api = createApiDouble();
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-2'));

    const scheduledCallbacks: Array<() => void> = [];
    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (cb) => scheduledCallbacks.push(cb),
    });

    // Mark a type
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    // Verify it's marked
    expect(queue.unsentTypes()).toHaveLength(1);

    // Run the drain via queue.drain (which the callback triggers)
    const result = await queue.drain(handle);

    // Verify converged has one entry
    expect(result).toEqual(
      expect.objectContaining({
        converged: expect.arrayContaining([
          expect.objectContaining({ type: VaultBlobType.Tasks }),
        ]),
        failed: [],
      }),
    );

    // Verify marks are cleared
    expect(queue.unsentTypes()).toEqual([]);
  });

  test('should converge two marked types', async () => {
    // Matrix row: "two types marked"
    const handle = await setupHandle('user-1', []);

    // Save dirty data for both types
    const tasksEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 't1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: tasksEnvelope });
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    // Make tasks dirty again
    const tasksDirtyEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 't2' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'tasks',
      value: tasksDirtyEnvelope,
    });

    const addressesEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'a1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'addresses',
      value: addressesEnvelope,
    });
    await handle.recordPushSuccess({ type: 'addresses', etag: 'etag-2' });

    // Make addresses dirty
    const addressesDirtyEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'a2' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'addresses',
      value: addressesDirtyEnvelope,
    });

    const api = createApiDouble();
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-new'));

    const scheduledCallbacks: Array<() => void> = [];
    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (cb) => scheduledCallbacks.push(cb),
    });

    // Mark two types
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });
    queue.vaultBlobChanged({ type: VaultBlobType.Addresses, handle });

    // Drain both
    await queue.drain(handle);

    // Both should converge (or have been attempted)
    expect(api.putVaultBlob).toHaveBeenCalledTimes(2);
  });

  test('should not make API calls when queue is empty', async () => {
    // Matrix row: "nothing marked"
    const handle = await setupHandle('user-1', []);

    const api = createApiDouble();
    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (cb) => cb(),
    });

    const result = await queue.drain(handle);

    // No API calls
    expect(api.putVaultBlob).not.toHaveBeenCalled();
    expect(api.getVaultBlob).not.toHaveBeenCalled();

    // Result reflects no work
    expect(result).toEqual({ converged: [], failed: [] });
  });

  test('drain resolves on failed send and re-marks the type', async () => {
    // Matrix row: "failed send"
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    // Make it dirty
    const envelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'task-1', title: 'Task' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope });

    const api = createApiDouble();
    const networkError = new Error('Network error');
    // Error without a response.status property (network failure)
    api.putVaultBlob.mockRejectedValue(networkError);

    const scheduledCallbacks: Array<() => void> = [];
    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (cb) => scheduledCallbacks.push(cb),
    });

    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    // Drain should resolve, not reject
    const result = await queue.drain(handle);

    // Verify failure was recorded
    expect(result).toEqual(
      expect.objectContaining({
        failed: expect.arrayContaining([
          expect.objectContaining({ type: VaultBlobType.Tasks }),
        ]),
      }),
    );

    // Verify type is still marked for retry
    expect(queue.unsentTypes()).toContain(VaultBlobType.Tasks);
  });

  test('should preserve local vault on failed send', async () => {
    // Matrix row: "failed send" - verify local ciphertext unchanged
    const handle = await setupHandle('user-1', [
      { id: 'task-1', title: 'Task' },
    ]);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    // Make it dirty
    const envelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'task-2', title: 'New task' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope });

    // Capture the ciphertext before drain
    const vaultBefore = handle.loadVault();
    const ciphertextBefore = vaultBefore?.data.tasks;

    const api = createApiDouble();
    api.putVaultBlob.mockRejectedValue(new Error('Network error'));

    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (cb) => cb(),
    });

    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    await queue.drain(handle);

    // Verify local vault ciphertext is unchanged
    const vaultAfter = handle.loadVault();
    const ciphertextAfter = vaultAfter?.data.tasks;

    expect(ciphertextAfter).toEqual(ciphertextBefore);
  });

  test('failure is not retried within the same drain', async () => {
    // Matrix row: "failure is not retried inside one drain"
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    // Make vault dirty
    const envelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'task-1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope });

    const api = createApiDouble();
    api.putVaultBlob.mockRejectedValue(new Error('Network error'));

    const scheduledCallbacks: Array<() => void> = [];
    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (cb) => scheduledCallbacks.push(cb),
    });

    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    const result = await queue.drain(handle);

    // putVaultBlob called exactly once
    expect(api.putVaultBlob).toHaveBeenCalledTimes(1);

    // Failure recorded
    expect(result.failed).toHaveLength(1);
  });

  test('later drain retries a failed type', async () => {
    // Matrix row: "a later drain retries a failure"
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    // Make vault dirty
    const envelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'task-1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope });

    const api = createApiDouble();
    let callCount = 0;
    api.putVaultBlob.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call fails
        throw new Error('Network error');
      }
      // Second call succeeds
      return formatPutVaultBlobResponse('etag-2');
    });

    const scheduledCallbacks: Array<() => void> = [];
    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (cb) => scheduledCallbacks.push(cb),
    });

    // First mark and drain
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    const firstResult = await queue.drain(handle);

    // First drain failed
    expect(firstResult.failed).toHaveLength(1);
    expect(queue.unsentTypes()).toContain(VaultBlobType.Tasks);

    // Make vault dirty again for second drain
    const envelope2: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'task-2' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope2 });

    // Run a second drain (mark + schedule, then drain again)
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    const secondResult = await queue.drain(handle);

    // Second drain succeeds
    expect(secondResult.converged).toHaveLength(1);
    expect(secondResult.converged[0]?.type).toBe(VaultBlobType.Tasks);
    expect(queue.unsentTypes()).toEqual([]);
  });

  test('save landing mid-drain re-marks the type for the same drain loop', async () => {
    // Matrix row: "save landing mid-drain"
    // Verify that if vaultBlobChanged is called during converge (simulating a save arriving
    // while the converge is in flight), the type is re-marked for pickup in the same drain
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    // Make vault dirty initially
    const envelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'task-1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope });

    const api = createApiDouble();
    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _cb: () => void,
      ) => {
        // Deliberately never calls the drain callback - this tests that the queue
        // can handle a scheduler that never fires, leaving marks stranded until
        // a subsequent call or explicit drain.
        return;
      },
    });

    let putCallCount = 0;
    api.putVaultBlob.mockImplementation(async () => {
      putCallCount++;
      if (putCallCount === 1) {
        // Simulate a save arriving mid-converge by re-marking the type
        queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });
      }
      return formatPutVaultBlobResponse(`etag-${putCallCount}`);
    });

    // Initial mark
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    // Verify type is marked before drain
    expect(queue.unsentTypes()).toContain(VaultBlobType.Tasks);

    const result = await queue.drain(handle);

    // When a save lands mid-converge (re-marking the type), the re-mark is
    // picked up by takeNext() again (since hasUnsentChanges is false after
    // the successful send, it's not added to stalled). This produces two
    // converged entries in one drain: the successful send, then a 'nothing'
    // when it's picked up again with no unsent changes.
    expect(result.converged).toHaveLength(2);
    expect(result.converged[0]?.outcome).toEqual(
      expect.objectContaining({ kind: 'sent' }),
    );
    expect(result.converged[1]?.outcome).toEqual(
      expect.objectContaining({ kind: 'nothing', reason: 'in-sync' }),
    );
    expect(api.putVaultBlob).toHaveBeenCalledTimes(1);
  });

  test('scheduler controls when drain is triggered', async () => {
    // Matrix row: "scheduler only changes latency"
    const handle = await setupHandle('user-1', []);

    const api = createApiDouble();
    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultSyncDrainScheduler = (cb) => {
      scheduledCallbacks.push(cb);
      // Never call the callback
    };

    const queue = createVaultSyncQueue({ api, prompt: jest.fn(), schedule });

    // Mark a type
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    // No API calls because scheduler never invoked the drain
    expect(api.putVaultBlob).not.toHaveBeenCalled();

    // But the type is still marked
    expect(queue.unsentTypes()).toContain(VaultBlobType.Tasks);

    // Type not lost
    expect(queue.unsentTypes()).toHaveLength(1);
  });

  test('scheduler can be re-armed after first drain', async () => {
    // Matrix row: "scheduler re-arms"
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const api = createApiDouble();
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-new'));

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultSyncDrainScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const queue = createVaultSyncQueue({ api, prompt: jest.fn(), schedule });

    // First mark and run drain
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });
    expect(scheduledCallbacks).toHaveLength(1);

    const callback1 = scheduledCallbacks[0]!;
    callback1();

    // Clear for next mark
    scheduledCallbacks.length = 0;

    // Mark again
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    // Schedule should have been called again
    expect(scheduledCallbacks).toHaveLength(1);
  });

  test('drain serializes concurrent operations through promise chain', async () => {
    // Ensure drains are serialized, not concurrent
    const handle = await setupHandle('user-1', []);

    // Save dirty data for both types
    const tasksEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 't1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: tasksEnvelope });
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const tasksDirtyEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 't2' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'tasks',
      value: tasksDirtyEnvelope,
    });

    const addressesEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'a1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'addresses',
      value: addressesEnvelope,
    });
    await handle.recordPushSuccess({ type: 'addresses', etag: 'etag-2' });

    const addressesDirtyEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'a2' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'addresses',
      value: addressesDirtyEnvelope,
    });

    const api = createApiDouble();
    const putOrder: string[] = [];

    api.putVaultBlob.mockImplementation(async (params) => {
      putOrder.push(
        params.type === VaultBlobType.Tasks ? 'tasks' : 'addresses',
      );
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      return formatPutVaultBlobResponse('etag-new');
    });

    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _cb: () => void,
      ) => {
        // Deliberately never calls the drain callback for this test
        return;
      },
    });

    // Mark two types
    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });
    queue.vaultBlobChanged({ type: VaultBlobType.Addresses, handle });

    // Call drain which processes both types sequentially
    await queue.drain(handle);

    // Both should have been called in the order they were marked (insertion order)
    expect(api.putVaultBlob).toHaveBeenCalledTimes(2);
    expect(putOrder).toEqual(['tasks', 'addresses']);
  });

  test('drain returns the outcome from convergeVaultBlob', async () => {
    // Verify the drain result structure matches VaultSyncDrainResult
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    // Make vault dirty
    const envelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'task-1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope });

    const api = createApiDouble();
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-new'));

    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _cb: () => void,
      ) => {
        // Deliberately don't call the callback - we'll call drain explicitly
        return;
      },
    });

    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    const result = await queue.drain(handle);

    // Result has the expected structure
    expect(result).toHaveProperty('converged');
    expect(result).toHaveProperty('failed');

    // One type converged (the marked one)
    expect(result.converged).toHaveLength(1);
    expect(result.failed).toHaveLength(0);

    // Converged entry has type and outcome with the actual values
    expect(result.converged[0]?.type).toBe(VaultBlobType.Tasks);
    expect(result.converged[0]?.outcome).toEqual(
      expect.objectContaining({ kind: 'sent' }),
    );
  });

  test('prompt is not called on non-conflicting converge', async () => {
    // Verify prompt is not called unless there is a conflict
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const api = createApiDouble();
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-2'));

    const prompt = jest.fn();
    const queue = createVaultSyncQueue({
      api,
      prompt,
      schedule: (cb) => cb(),
    });

    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

    await queue.drain(handle);

    // Prompt should never be called for a clean, unconflicted send
    expect(prompt).not.toHaveBeenCalled();
  });

  test('drain correctly reports both converged and failed entries', async () => {
    // Matrix-inspired test: verify drain result contains both converged and failed
    const handle = await setupHandle('user-1', []);

    // Save dirty data for both types
    const tasksEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 't1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: tasksEnvelope });
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const tasksDirtyEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 't2' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'tasks',
      value: tasksDirtyEnvelope,
    });

    const addressesEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'a1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'addresses',
      value: addressesEnvelope,
    });
    await handle.recordPushSuccess({ type: 'addresses', etag: 'etag-2' });

    const addressesDirtyEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'a2' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'addresses',
      value: addressesDirtyEnvelope,
    });

    const api = createApiDouble();
    let putCount = 0;
    api.putVaultBlob.mockImplementation(async () => {
      putCount++;
      if (putCount === 1) {
        // First (Tasks) succeeds
        return formatPutVaultBlobResponse('etag-new-tasks');
      }
      // Second (Addresses) fails
      throw new Error('Network error');
    });

    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _cb: () => void,
      ) => {
        // Deliberately never calls the drain callback for this test
        return;
      },
    });

    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });
    queue.vaultBlobChanged({ type: VaultBlobType.Addresses, handle });

    const result = await queue.drain(handle);

    // One converged, one failed
    expect(result.converged).toHaveLength(1);
    expect(result.failed).toHaveLength(1);

    expect(result.converged[0]?.type).toBe(VaultBlobType.Tasks);
    expect(result.failed[0]?.type).toBe(VaultBlobType.Addresses);
  });

  test('default scheduler uses VAULT_SYNC_DRAIN_DELAY_MS timeout', async () => {
    // Verify the default scheduler schedules with setTimeout at the correct delay
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const api = createApiDouble();
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');

    try {
      const queue = createVaultSyncQueue({
        api,
        prompt: jest.fn(),
        // schedule omitted — will use default drainAfterDelay
      });

      queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });

      // Verify setTimeout was called with the correct delay
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        VAULT_SYNC_DRAIN_DELAY_MS,
      );

      // Scheduling is not draining — drain runs only when the callback fires
      expect(api.putVaultBlob).not.toHaveBeenCalled();
      expect(queue.unsentTypes()).toContain(VaultBlobType.Tasks);
    } finally {
      // The spy calls through, so a real one-second timer is armed. Today it
      // never fires — this test sits near the end of the suite — but that is
      // position, not safety: were it to fire mid-suite it would drain against
      // a handle this test has finished with. Clear it and the safety is
      // deliberate.
      setTimeoutSpy.mock.results.forEach((result) => {
        if (result.type === 'return') clearTimeout(result.value);
      });
      setTimeoutSpy.mockRestore();
    }
  });

  test('deferred conflict keeps type marked for next drain', async () => {
    // Test that a deferred conflict does not silently drop the mark
    const handle = await setupHandle(
      'user-1',
      { catalog: [], lists: [] },
      'groceries',
    );
    await handle.recordPushSuccess({ type: 'groceries', etag: 'etag-1' });

    // Make dirty
    const dirtyEnvelope: VaultBlobEnvelope<unknown> = {
      records: { catalog: [{ id: 'cat-1', name: 'Produce' }], lists: [] },
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'groceries', value: dirtyEnvelope });

    // Create a conflicting remote blob (different Ciphertext)
    const remoteEnvelope: VaultBlobEnvelope<unknown> = {
      records: { catalog: [{ id: 'cat-2', name: 'Dairy' }], lists: [] },
      deletions: {},
    };

    // Temporarily save remote to capture its blob
    await handle.saveEncryptedData({
      type: 'groceries',
      value: remoteEnvelope,
    });
    const remoteVault = handle.loadVault();
    const remoteBlob = remoteVault?.data.groceries;
    if (!remoteBlob) throw new Error('Failed to capture remote blob');

    // Restore local dirty state
    await handle.saveEncryptedData({ type: 'groceries', value: dirtyEnvelope });

    const api = createApiDouble();
    let putCount = 0;
    api.putVaultBlob.mockImplementation(async () => {
      putCount++;
      if (putCount === 1) {
        // First attempt fails with 409 (conflict)
        const error = Object.assign(new Error('conflict'), {
          response: { status: 409 },
        });
        throw error;
      }
      // Should not reach here in this test
      return formatPutVaultBlobResponse('etag-new');
    });

    api.getVaultBlob.mockResolvedValue({
      data: {
        etag: 'etag-remote',
        updatedAt: '2026-01-01T00:00:00.000Z',
        type: VaultBlobType.Groceries,
        blob: {
          iv: remoteBlob.iv,
          ciphertext: remoteBlob.ciphertext,
          version: 1,
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} as any },
    } as unknown as AxiosResponse);

    const prompt = jest.fn().mockResolvedValue('defer' as const);

    const queue = createVaultSyncQueue({
      api,
      prompt,
      schedule: (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _cb: () => void,
      ) => {
        return;
      },
    });

    queue.vaultBlobChanged({ type: VaultBlobType.Groceries, handle });

    // First drain encounters conflict, user defers
    const result = await queue.drain(handle);

    // Verify the outcome
    expect(result.converged).toHaveLength(1);
    expect(result.converged[0]?.outcome).toEqual(
      expect.objectContaining({
        kind: 'asked',
        reason: 'strategy',
        decision: 'defer',
      }),
    );
    expect(result.failed).toHaveLength(0);

    // CRITICAL: Type must still be marked, not silently dropped
    expect(queue.unsentTypes()).toContain(VaultBlobType.Groceries);

    // Verify prompt was called once (deferred type not retried forever)
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  test('successful send clears marks (does not re-mark)', async () => {
    // Verify that a successful 'sent' outcome does not re-mark the type
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    // Make dirty
    const envelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'task-1', title: 'Task' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope });

    const api = createApiDouble();
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-2'));

    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _cb: () => void,
      ) => {
        return;
      },
    });

    queue.vaultBlobChanged({ type: VaultBlobType.Tasks, handle });
    expect(queue.unsentTypes()).toContain(VaultBlobType.Tasks);

    await queue.drain(handle);

    // After successful send, type should be cleared
    expect(queue.unsentTypes()).toEqual([]);
  });

  test('a save through a handle wired to the queue sends once, carrying the final state', async () => {
    // End-to-end: handle's saveEncryptedData triggers sink, which marks queue,
    // which drains and sends — no manual vaultBlobChanged() call in this test.
    const api = createApiDouble();
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-sent'));

    const scheduled: Array<() => void> = [];
    const queue = createVaultSyncQueue({
      api,
      prompt: jest.fn(),
      schedule: (cb) => {
        scheduled.push(cb);
      },
    });

    // The handle is built WITH the queue as its sink — this is the wiring under test
    const handle = createVaultHandle({ owner: 'user-e2e', syncSink: queue });
    await handle.initialize({ passphrase });
    await handle.unlockWithPassphrase({ passphrase });

    // Record a baseline push so the types can be marked unsent
    const baselineEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'baseline' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: baselineEnvelope });
    await handle.recordPushSuccess({ type: 'tasks', etag: 'baseline-etag' });

    // Three saves with clearly different content
    const envelopeA: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'A', title: 'Save A' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelopeA });

    const envelopeB: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'B', title: 'Save B' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelopeB });

    const envelopeC: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'C', title: 'Save C' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelopeC });

    // Three saves, one mark, nothing sent yet
    expect(queue.unsentTypes()).toEqual([VaultBlobType.Tasks]);
    expect(scheduled).toHaveLength(1);
    expect(api.putVaultBlob).not.toHaveBeenCalled();

    // Run the drain
    await queue.drain(handle);

    // One send, carrying the FINAL state (envelope C's ciphertext)
    expect(api.putVaultBlob).toHaveBeenCalledTimes(1);
    const sent = api.putVaultBlob.mock.calls[0]?.[0] as any;
    const finalVault = handle.loadVault();
    expect(sent?.putVaultBlobRequest.blob.iv).toBe(finalVault?.data.tasks?.iv);
    expect(sent?.putVaultBlobRequest.blob.ciphertext).toBe(
      finalVault?.data.tasks?.ciphertext,
    );
  });
});
