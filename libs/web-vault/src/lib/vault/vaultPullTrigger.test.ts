/**
 * Tests for the Vault Pull trigger — the debounced scheduler that asks the
 * server what changed elsewhere.
 *
 * The trigger collapses multiple requestCheck calls into one scheduled pass,
 * uses the most recently reported handle, and stops permanently on 401/403
 * (session loss). check() bypasses debounce, and passes are serialized so
 * concurrent calls do not race.
 */

import type { AxiosResponse } from 'axios';
import { VaultBlobType } from '@myorganizer/app-api-client';

import { createVaultHandle } from './vaultHandle';
import {
  createVaultPullTrigger,
  type VaultPullTriggerScheduler,
  VAULT_PULL_DEBOUNCE_MS,
} from './vaultPullTrigger';
import { localToServerMeta } from './vaultShapes';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('createVaultPullTrigger', () => {
  const passphrase = 'test pass 2026';

  /**
   * Helper to create a properly typed API double for vault operations.
   */
  function createApiDouble(handle?: Awaited<ReturnType<typeof setupHandle>>) {
    const api = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getVaultMeta: jest.fn<Promise<AxiosResponse<any>>, []>(),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [any]
      >(),
    };

    // Default getVaultMeta returns server meta matching local vault identity
    if (handle) {
      const localVault = handle.loadVault();
      if (localVault) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.getVaultMeta.mockResolvedValue({
          data: {
            etag: 'meta-etag',
            updatedAt: '2026-01-01T00:00:00.000Z',
            meta: localToServerMeta(localVault),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} as any },
        } as unknown as AxiosResponse<any>);
      }
    }

    return api;
  }

  /**
   * Helper to create a vault handle bound to an owner with WebCrypto.
   */
  async function setupHandle(owner: string) {
    const handle = createVaultHandle({ owner });
    await handle.initialize({ passphrase });
    await handle.unlockWithPassphrase({ passphrase });
    return handle;
  }

  test('should coalesce multiple requestCheck calls into one scheduled pass', async () => {
    // Matrix row: "Debounce coalescing"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    // 404 makes all types resolve quickly without further calls
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultPullTriggerScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule,
    });

    // Call requestCheck three times in the same turn
    trigger.requestCheck(handle);
    trigger.requestCheck(handle);
    trigger.requestCheck(handle);

    // Only one callback should be scheduled, not three
    expect(scheduledCallbacks).toHaveLength(1);
    // No API calls yet
    expect(api.getVaultBlob).not.toHaveBeenCalled();
  });

  test('should use the most recent handle for a scheduled pass', async () => {
    // Matrix row: "Scheduled pass uses the most recent handle"
    const handleA = await setupHandle('user-a');
    const handleB = await setupHandle('user-b');

    // Spy on each handle's lastPushedEtag to verify only handleB is used
    const spyA = jest.spyOn(handleA, 'lastPushedEtag');
    const spyB = jest.spyOn(handleB, 'lastPushedEtag');

    const api = createApiDouble(handleB);
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultPullTriggerScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule,
    });

    // Mark handleA, then handleB
    trigger.requestCheck(handleA);
    trigger.requestCheck(handleB);

    // Only one callback scheduled
    expect(scheduledCallbacks).toHaveLength(1);

    // Run the scheduled callback
    const callback = scheduledCallbacks[0];
    expect(callback).toBeDefined();
    if (callback) {
      await callback();
    }

    // Verify that handleB (the most recent) was used
    expect(spyB).toHaveBeenCalled();
    // And handleA was not used (proving B won, not A)
    expect(spyA).not.toHaveBeenCalled();

    spyA.mockRestore();
    spyB.mockRestore();
  });

  test('check() should bypass debounce and run immediately', async () => {
    // Matrix row: "check() bypasses debounce"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultPullTriggerScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule,
    });

    // Call check() directly without scheduling delay
    const result = await trigger.check(handle);

    // Result should have the expected shape
    expect(result).toHaveProperty('checked');
    expect(result).toHaveProperty('failed');
    expect(result).toHaveProperty('stoppedUnauthenticated');

    // No schedule callback should have been called
    expect(scheduledCallbacks).toHaveLength(0);

    // API should have been called immediately
    expect(api.getVaultBlob).toHaveBeenCalled();
  });

  test('should serialize concurrent check() calls', async () => {
    // Matrix row: "Serialization"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockImplementation(async () => {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw { response: { status: 404 } };
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // Capture call count before operations
    const callCountBefore = api.getVaultBlob.mock.calls.length;

    // Call check twice back-to-back without awaiting the first
    const promise1 = trigger.check(handle);
    const promise2 = trigger.check(handle);

    // Both should resolve without throwing
    const result1 = await promise1;
    const result2 = await promise2;

    // Both results should be well-formed
    expect(result1).toHaveProperty('checked');
    expect(result2).toHaveProperty('checked');

    // Both passes should have run (not dropped or raced into a single call)
    // Each pass iterates through VAULT_BLOB_TYPES; 404 doesn't break the loop.
    // So two complete passes = at least 2 calls total (one per type minimum).
    expect(api.getVaultBlob.mock.calls.length).toBeGreaterThan(
      callCountBefore + 1,
    );
  });

  test('should stop and not retry on 401 response', async () => {
    // Matrix row: "Stop-and-no-retry on 401"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    // First call: 401
    api.getVaultBlob.mockRejectedValueOnce({
      response: { status: 401 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // First check encounters 401
    const result1 = await trigger.check(handle);
    expect(result1.stoppedUnauthenticated).toBe(true);
    expect(result1.checked).toHaveLength(0);
    expect(result1.failed).toHaveLength(0);

    // First call count
    const firstCallCount = api.getVaultBlob.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // Second check should resolve immediately without calling API
    const result2 = await trigger.check(handle);
    expect(result2.stoppedUnauthenticated).toBe(true);
    expect(result2.checked).toHaveLength(0);
    expect(result2.failed).toHaveLength(0);

    // API should not have been called again
    expect(api.getVaultBlob).toHaveBeenCalledTimes(firstCallCount);
  });

  test('should stop and not retry on 403 response', async () => {
    // Matrix row: "Stop-and-no-retry on 403"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    // First call: 403
    api.getVaultBlob.mockRejectedValueOnce({
      response: { status: 403 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // First check encounters 403
    const result1 = await trigger.check(handle);
    expect(result1.stoppedUnauthenticated).toBe(true);
    expect(result1.checked).toHaveLength(0);
    expect(result1.failed).toHaveLength(0);

    // First call count
    const firstCallCount = api.getVaultBlob.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // Second check should resolve immediately without calling API
    const result2 = await trigger.check(handle);
    expect(result2.stoppedUnauthenticated).toBe(true);
    expect(result2.checked).toHaveLength(0);
    expect(result2.failed).toHaveLength(0);

    // API should not have been called again
    expect(api.getVaultBlob).toHaveBeenCalledTimes(firstCallCount);
  });

  test('should not schedule when trigger is stopped', async () => {
    // Matrix row: "Stopped + requestCheck"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValueOnce({
      response: { status: 401 },
    });

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultPullTriggerScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule,
    });

    // Stop the trigger with a 401
    await trigger.check(handle);
    expect(scheduledCallbacks).toHaveLength(0); // No schedule from check()

    // Now try to requestCheck on the stopped trigger
    trigger.requestCheck(handle);

    // Should not have scheduled anything
    expect(scheduledCallbacks).toHaveLength(0);
  });

  test('should return stopped result immediately after trigger stopped via requestCheck+schedule', async () => {
    // Matrix row: "Stopped + requestCheck then schedule"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue({
      response: { status: 401 },
    });

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultPullTriggerScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule,
    });

    // First, trigger a stop via requestCheck and schedule
    trigger.requestCheck(handle);
    expect(scheduledCallbacks).toHaveLength(1);

    // Run the scheduled callback (this will hit 401 and stop)
    const firstCallback = scheduledCallbacks[0];
    expect(firstCallback).toBeDefined();
    if (firstCallback) {
      firstCallback();
    }

    // Give the event loop a chance to run the check() promise
    // so that stopped flag is actually set
    await new Promise((r) => setTimeout(r, 0));

    // Verify trigger is stopped
    const firstCallCount = api.getVaultBlob.mock.calls.length;

    // Now request another check on the stopped trigger (should be a no-op)
    trigger.requestCheck(handle);

    // No new schedule should have been triggered (still length 1)
    expect(scheduledCallbacks).toHaveLength(1);

    // And if we call check directly, it should be a no-op
    const result = await trigger.check(handle);
    expect(result.stoppedUnauthenticated).toBe(true);

    // API should not have been called again
    expect(api.getVaultBlob).toHaveBeenCalledTimes(firstCallCount);
  });

  test('should use default scheduler with real timers', async () => {
    // Matrix row: "Default scheduler"
    // Verify the default scheduler schedules with setTimeout at the correct delay
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');

    try {
      const trigger = createVaultPullTrigger({
        api,
        prompt: jest.fn(),
        // No schedule override — uses default debounceAfterDelay
      });

      // Call requestCheck
      trigger.requestCheck(handle);

      // Verify setTimeout was called with the correct delay
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        VAULT_PULL_DEBOUNCE_MS,
      );

      // Scheduling is not running the pass yet
      expect(api.getVaultBlob).not.toHaveBeenCalled();
    } finally {
      // Clean up any timers that were set
      setTimeoutSpy.mock.results.forEach((result) => {
        if (result.type === 'return') clearTimeout(result.value);
      });
      setTimeoutSpy.mockRestore();
    }
  });

  test('should allow multiple requestCheck calls with different handles and use latest', async () => {
    // Extended test: verify handle switching behavior across multiple turns
    const handle1 = await setupHandle('user-1');
    const handle2 = await setupHandle('user-2');

    const api = createApiDouble();
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const scheduledCallbacks: Array<() => void> = [];
    const schedule: VaultPullTriggerScheduler = (cb) => {
      scheduledCallbacks.push(cb);
    };

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule,
    });

    // Request with handle1
    trigger.requestCheck(handle1);
    expect(scheduledCallbacks).toHaveLength(1);

    // Spy on handle1's lastPushedEtag to verify it's used in first pass
    const spy1 = jest.spyOn(handle1, 'lastPushedEtag');
    const firstCallback = scheduledCallbacks[0];
    expect(firstCallback).toBeDefined();
    if (firstCallback) {
      firstCallback();
      // Give the event loop a chance to run the check() promise
      await new Promise((r) => setTimeout(r, 0));
    }
    // Verify first pass used handle1
    expect(spy1).toHaveBeenCalled();
    spy1.mockRestore();

    // Clear callbacks and make a fresh request with handle2
    scheduledCallbacks.length = 0;
    trigger.requestCheck(handle2);
    expect(scheduledCallbacks).toHaveLength(1);

    // Spy on handle2's lastPushedEtag to verify it's used in second pass
    const spy2 = jest.spyOn(handle2, 'lastPushedEtag');
    const secondCallback = scheduledCallbacks[0];
    expect(secondCallback).toBeDefined();
    if (secondCallback) {
      secondCallback();
      // Give the event loop a chance to run the check() promise
      await new Promise((r) => setTimeout(r, 0));
    }

    // Verify second pass used handle2
    expect(spy2).toHaveBeenCalled();
    spy2.mockRestore();
  });

  test('should handle check() after trigger is stopped via check()', async () => {
    // Matrix row: "Stopped + direct check()"
    const handle = await setupHandle('user-1');
    const api = createApiDouble();
    api.getVaultBlob.mockRejectedValueOnce({
      response: { status: 401 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // Stop via check()
    const result1 = await trigger.check(handle);
    expect(result1.stoppedUnauthenticated).toBe(true);

    const firstCallCount = api.getVaultBlob.mock.calls.length;

    // Check again after stopped
    const result2 = await trigger.check(handle);
    expect(result2.stoppedUnauthenticated).toBe(true);
    expect(result2.checked).toHaveLength(0);
    expect(result2.failed).toHaveLength(0);

    // No new API calls
    expect(api.getVaultBlob).toHaveBeenCalledTimes(firstCallCount);
  });

  // ===== Different-Vault Identity Refusal Test (ADR 0067 T1) =====

  test('trigger-driven pass with different vault identity refuses rather than takes', async () => {
    const handle = await setupHandle('user-1');

    // Create a different vault's meta to simulate a different vault on the server
    const differentVaultHandle = createVaultHandle({ owner: 'user-2' });
    await differentVaultHandle.initialize({ passphrase: 'different key' });
    const differentVaultMeta = localToServerMeta(
      differentVaultHandle.loadVault()!,
    );

    const api = createApiDouble(handle);

    // Mock getVaultMeta to return the different vault's meta
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.getVaultMeta.mockResolvedValue({
      data: {
        etag: 'different-meta-etag',
        updatedAt: '2026-01-01T00:00:00.000Z',
        meta: differentVaultMeta,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} as any },
    } as unknown as AxiosResponse<any>);

    // Mock getVaultBlob to return a blob (changed, not 304) so convergence is triggered
    // and getVaultMeta is called
    api.getVaultBlob.mockResolvedValue({
      data: {
        etag: 'changed-etag',
        updatedAt: '2026-01-02T00:00:00.000Z',
        type: VaultBlobType.Tasks,
        blob: { version: 1, iv: 'some-iv', ciphertext: 'some-ct' },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} as any },
    } as unknown as AxiosResponse<any>);

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // Run check directly to get the result
    const result = await trigger.check(handle);

    // Verify that getVaultMeta was called to get the server's meta
    expect(api.getVaultMeta).toHaveBeenCalled();

    // Asserted on the converged entries themselves rather than inside a
    // conditional walk: a pass that converged nothing would satisfy an
    // `if (kind === 'converged')` body that never runs, and this test would
    // then prove nothing at all.
    const converged = result.checked.filter(
      (entry) => entry.outcome.kind === 'converged',
    );
    expect(converged.length).toBeGreaterThan(0);
    converged.forEach((entry) => {
      expect(entry.outcome).toEqual({
        kind: 'converged',
        outcome: { kind: 'refused', reason: 'different-vault' },
      });
    });

    // Verify no putVaultBlob was attempted
    expect(api.putVaultBlob).not.toHaveBeenCalled();
  });
});
