/**
 * Tests for the Vault Pull trigger — the debounced scheduler that asks the
 * server what changed elsewhere.
 *
 * The trigger collapses multiple requestCheck calls into one scheduled pass,
 * uses the most recently reported handle, and stops permanently on 401/403
 * (session loss). check() bypasses debounce, and newer passes supersede
 * outstanding ones, aborting them rather than queuing behind them.
 */

import type { AxiosResponse } from 'axios';
import { VaultBlobType } from '@myorganizer/app-api-client';

import { createVaultHandle } from './vaultHandle';
import {
  createVaultPullTrigger,
  type VaultPullTriggerScheduler,
  VAULT_PULL_DEBOUNCE_MS,
  VAULT_PULL_PASS_BUDGET_MS,
} from './vaultPullTrigger';
import { VAULT_BLOB_TYPES } from './vaultBlobFields';
import { localToServerMeta } from './vaultShapes';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('createVaultPullTrigger', () => {
  const passphrase = 'test pass 2026';

  /**
   * An axios-shaped 200 response, which is all any double here answers with.
   */
  function axiosOk<T>(data: T): AxiosResponse<T> {
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    } as unknown as AxiosResponse<T>;
  }

  /**
   * Helper to create a properly typed API double for vault operations.
   */
  function createApiDouble(handle?: Awaited<ReturnType<typeof setupHandle>>) {
    const api = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getVaultMeta: jest.fn<Promise<AxiosResponse<any>>, [any]>(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getVaultBlob: jest.fn<Promise<AxiosResponse<any>>, [any, any]>(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getVaultBlobInventory: jest.fn<Promise<AxiosResponse<any>>, [any, any]>(),
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

    // Default getVaultBlobInventory returns an inventory naming EVERY type
    // with etags differing from any Sync Bookmark, so per-type reads happen
    api.getVaultBlobInventory.mockResolvedValue(
      axiosOk({
        etag: 'inventory-etag-v1',
        blobs: VAULT_BLOB_TYPES.map((type) => ({
          type,
          etag: `server-etag-${type}`,
          updatedAt: '2026-01-01T00:00:00.000Z',
        })),
      }),
    );

    // Default getVaultMeta returns server meta matching local vault identity
    if (handle) {
      const localVault = handle.loadVault();
      if (localVault) {
        api.getVaultMeta.mockResolvedValue(
          axiosOk({
            etag: 'meta-etag',
            updatedAt: '2026-01-01T00:00:00.000Z',
            meta: localToServerMeta(localVault),
          }),
        );
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

  /**
   * Helper to configure getVaultBlobInventory to hang on first call, then answer.
   * Used by tests that verify a second pass can supersede a hanging first pass.
   */
  function setupHangThenAnswerInventory(
    api: ReturnType<typeof createApiDouble>,
    options: {
      firstCallDelay?: number;
      firstCallEtag?: string;
      secondCallEtag?: string;
    } = {},
  ) {
    const {
      firstCallDelay = 0,
      firstCallEtag = 'inventory-etag-v1',
      secondCallEtag = 'inventory-etag-v2',
    } = options;
    let inventoryCallCount = 0;
    api.getVaultBlobInventory.mockImplementation(async () => {
      inventoryCallCount++;
      if (inventoryCallCount === 1) {
        // First call: optionally delay, then hang (never resolves)
        if (firstCallDelay > 0) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(
                axiosOk({
                  etag: firstCallEtag,
                  blobs: VAULT_BLOB_TYPES.map((type) => ({
                    type,
                    etag: `server-etag-${type}`,
                    updatedAt: '2026-01-01T00:00:00.000Z',
                  })),
                }),
              );
            }, firstCallDelay);
          });
        }
        return new Promise(() => {}); // Hang forever
      }
      // Later calls answer immediately
      return axiosOk({
        etag: secondCallEtag,
        blobs: VAULT_BLOB_TYPES.map((type) => ({
          type,
          etag: `server-etag-${type}`,
          updatedAt: '2026-01-01T00:00:00.000Z',
        })),
      });
    });
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

    // Run the scheduled callback and wait for the async check() to complete
    const callback = scheduledCallbacks[0];
    expect(callback).toBeDefined();
    if (callback) {
      callback();
      // Give the event loop a chance to run the async check()
      await new Promise((resolve) => setTimeout(resolve, 0));
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

  // ===== Status and Subscribe Tests =====

  test('status() returns sessionEnded false initially', async () => {
    // Matrix row: "status() before any pass"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // No passes run yet
    const status = trigger.status();
    expect(status).toEqual({ sessionEnded: false, stalledTypes: [] });
  });

  test('status() returns sessionEnded false after a successful pass', async () => {
    // Matrix row: "status() after successful pass"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    // 404 makes all types resolve quickly as "nothing changed"
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // Run a check that succeeds (404 is not a stop condition)
    await trigger.check(handle);

    const status = trigger.status();
    expect(status).toEqual({ sessionEnded: false, stalledTypes: [] });
  });

  test('status() returns sessionEnded true after a 401 pass', async () => {
    // Matrix row: "status() after 401/403 pass"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValueOnce({
      response: { status: 401 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // Run a check that hits 401
    await trigger.check(handle);

    const status = trigger.status();
    expect(status).toEqual({ sessionEnded: true, stalledTypes: [] });
  });

  test('unsubscribe prevents the listener from being notified on stop', async () => {
    // Matrix row: "subscribe() registration and unsubscribe effectiveness"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValueOnce({
      response: { status: 401 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const listener = jest.fn();
    const unsubscribe = trigger.subscribe(listener);

    // Unsubscribe BEFORE the stop event that would notify
    unsubscribe();

    // Run check that hits 401 and would normally stop and notify
    await trigger.check(handle);

    // Listener should not have been called, proving unsubscribe worked
    expect(listener).not.toHaveBeenCalled();
  });

  test('listener is called when trigger stops via 401', async () => {
    // Matrix row: "Listener notification on stop (401)"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValueOnce({
      response: { status: 401 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const listener = jest.fn();
    trigger.subscribe(listener);

    // Run a check that hits 401
    const result = await trigger.check(handle);
    expect(result.stoppedUnauthenticated).toBe(true);

    // Listener should have been called exactly once with no arguments
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith();
  });

  test('listener is called when trigger stops via 403', async () => {
    // Matrix row: "Listener notification on stop (403)"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValueOnce({
      response: { status: 403 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const listener = jest.fn();
    trigger.subscribe(listener);

    // Run a check that hits 403
    const result = await trigger.check(handle);
    expect(result.stoppedUnauthenticated).toBe(true);

    // Listener should have been called exactly once
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith();
  });

  test('listener is NOT called for a successful pass', async () => {
    // Matrix row: "Listener not called on success"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    // 404 is not a stop condition
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const listener = jest.fn();
    trigger.subscribe(listener);

    // Run a check that succeeds
    await trigger.check(handle);

    // Listener should not have been called
    expect(listener).not.toHaveBeenCalled();
  });

  test('listener IS called when a non-401/403 failure leaves types stalled', async () => {
    // Matrix row: "Listener called when types are stalled by 500 errors"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    // 500 is not a stop condition, but leaves every type unanswered/failed
    api.getVaultBlob.mockRejectedValue({
      response: { status: 500 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const listener = jest.fn();
    trigger.subscribe(listener);

    // Run a check that fails with 500 — this leaves types stalled
    await trigger.check(handle);

    // Listener SHOULD have been called exactly once (stalledTypes changed from [] to populated)
    expect(listener).toHaveBeenCalledTimes(1);

    // stalledTypes should now contain every VAULT_BLOB_TYPES member (order-insensitive)
    const status = trigger.status();
    expect(status.sessionEnded).toBe(false);
    const stalledTypesSorted = [...status.stalledTypes].sort();
    const expectedTypesSorted = [...VAULT_BLOB_TYPES].sort();
    expect(stalledTypesSorted).toEqual(expectedTypesSorted);
  });

  test('multiple listeners are all notified on stop', async () => {
    // Matrix row: "Multiple listeners"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValueOnce({
      response: { status: 401 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const listener1 = jest.fn();
    const listener2 = jest.fn();
    const listener3 = jest.fn();
    trigger.subscribe(listener1);
    trigger.subscribe(listener2);
    trigger.subscribe(listener3);

    // Run a check that stops the trigger
    await trigger.check(handle);

    // All listeners should have been called exactly once
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);
  });

  test('no double notification when check() is called again after stopped', async () => {
    // Matrix row: "No double notification on stopped state"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue({
      response: { status: 401 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const listener = jest.fn();
    trigger.subscribe(listener);

    // First check stops the trigger
    const result1 = await trigger.check(handle);
    expect(result1.stoppedUnauthenticated).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Second check on the already-stopped trigger
    const result2 = await trigger.check(handle);
    expect(result2.stoppedUnauthenticated).toBe(true);

    // Listener should not have been called again
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // ===== ETag Carry Tests (ADR 0087, vaultPullTrigger contract) =====

  test('first pass carries inventoryEtag to second pass when all types answered', async () => {
    // Matrix row: "ETag carry on full pass"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    // All types answer 404 (not an error, so all types are answered)
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // First pass: should send ifNoneMatch undefined (no prior etag)
    const result1 = await trigger.check(handle);
    expect(result1.inventoryEtag).toBe('inventory-etag-v1');
    expect(api.getVaultBlobInventory).toHaveBeenNthCalledWith(
      1,
      {
        ifNoneMatch: undefined,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    // Reset mocks to count second pass separately
    api.getVaultBlobInventory.mockClear();

    // Second pass: should send ifNoneMatch with the first pass's etag
    const result2 = await trigger.check(handle);
    expect(api.getVaultBlobInventory).toHaveBeenNthCalledWith(
      1,
      {
        ifNoneMatch: 'inventory-etag-v1',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    // Second pass also echoes back the same etag
    expect(result2.inventoryEtag).toBe('inventory-etag-v1');
  });

  test('etag NOT carried to next pass when first pass left a type in failed', async () => {
    // Matrix row: "ETag not carried when types unanswered"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    let callCount = 0;
    api.getVaultBlob.mockImplementation(async () => {
      callCount++;
      // First call fails with 500, leaving type unanswered
      if (callCount === 1) {
        throw { response: { status: 500 } };
      }
      throw { response: { status: 404 } };
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // First pass: leaves a type in failed
    const result1 = await trigger.check(handle);
    expect(result1.failed.length).toBeGreaterThan(0);
    // Verify etag was set
    expect(result1.inventoryEtag).toBe('inventory-etag-v1');

    // Reset to count second pass calls
    api.getVaultBlobInventory.mockClear();
    callCount = 0;

    // Second pass: should NOT carry etag (types were left unanswered)
    await trigger.check(handle);
    expect(api.getVaultBlobInventory).toHaveBeenNthCalledWith(
      1,
      {
        ifNoneMatch: undefined,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test('401 on inventory stops trigger; no later pass reaches network', async () => {
    // Matrix row: "ETag not carried on 401/403"
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    api.getVaultBlobInventory.mockRejectedValue({
      response: { status: 401 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // First pass: hits 401 on inventory
    const result1 = await trigger.check(handle);
    expect(result1.stoppedUnauthenticated).toBe(true);
    // No etag when pass stopped
    expect(result1.inventoryEtag).toBeUndefined();

    // Reset for second pass
    api.getVaultBlobInventory.mockClear();

    // Trigger is stopped, so second check returns immediately without calling api
    const result2 = await trigger.check(handle);
    expect(result2.stoppedUnauthenticated).toBe(true);
    // No API call since trigger is stopped
    expect(api.getVaultBlobInventory).not.toHaveBeenCalled();
  });

  test('first pass converging one type does NOT carry etag to second pass', async () => {
    // Matrix row: "ETag not carried when type converged"
    // A type that converges (even with a successful outcome) leaves work for the next pass,
    // so the etag must not carry. The next pass re-asks the inventory.
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    // Override inventory to only list one type, so only that type is asked about
    api.getVaultBlobInventory.mockResolvedValue(
      axiosOk({
        etag: 'inventory-etag-v1',
        blobs: [
          {
            type: VAULT_BLOB_TYPES[0],
            etag: `server-etag-${VAULT_BLOB_TYPES[0]}`,
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    // Mock getVaultBlob to return a blob (triggers convergeVaultBlob)
    api.getVaultBlob.mockResolvedValue(
      axiosOk({
        etag: 'blob-etag-1',
        updatedAt: '2026-01-02T00:00:00.000Z',
        type: VAULT_BLOB_TYPES[0],
        blob: { version: 1, iv: 'some-iv', ciphertext: 'some-ct' },
      }),
    );

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // First pass
    const result1 = await trigger.check(handle);

    // Verify at least one type converged
    const converged = result1.checked.filter(
      (entry) => entry.outcome.kind === 'converged',
    );
    expect(converged.length).toBeGreaterThan(0);

    // Verify no failed types (all answered or converged)
    expect(result1.failed).toHaveLength(0);

    // Reset mocks for second pass
    api.getVaultBlobInventory.mockClear();

    // Second pass: etag should NOT be carried because first pass converged a type
    await trigger.check(handle);
    expect(api.getVaultBlobInventory).toHaveBeenNthCalledWith(
      1,
      {
        ifNoneMatch: undefined,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test('first pass converging to refusal does NOT carry etag to second pass', async () => {
    // Matrix row: "ETag not carried when type converged (refused)"
    // A type converged to refusal (different vault) is left unanswered, so the etag must not carry.
    // The next pass re-evaluates that type instead of being answered 304 and skipping it forever.
    const handle = await setupHandle('user-1');

    // Create a different vault to simulate a different vault on the server
    const differentVaultHandle = createVaultHandle({ owner: 'user-2' });
    await differentVaultHandle.initialize({ passphrase: 'different key' });
    const differentVault = differentVaultHandle.loadVault();
    if (!differentVault) {
      throw new Error('Vault failed to load');
    }
    const differentVaultMeta = localToServerMeta(differentVault);

    const api = createApiDouble(handle);

    // Mock getVaultMeta to return the different vault's meta
    api.getVaultMeta.mockResolvedValue(
      axiosOk({
        etag: 'different-meta-etag',
        updatedAt: '2026-01-01T00:00:00.000Z',
        meta: differentVaultMeta,
      }),
    );

    // Mock getVaultBlob to return a blob (triggers convergeVaultBlob, which will refuse)
    api.getVaultBlob.mockResolvedValue(
      axiosOk({
        etag: 'blob-etag',
        updatedAt: '2026-01-02T00:00:00.000Z',
        type: VAULT_BLOB_TYPES[0],
        blob: { version: 1, iv: 'some-iv', ciphertext: 'some-ct' },
      }),
    );

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // First pass: converges with refusal
    const result1 = await trigger.check(handle);

    // Verify convergence with refusal
    const converged = result1.checked.filter(
      (entry) => entry.outcome.kind === 'converged',
    );
    expect(converged.length).toBeGreaterThan(0);
    converged.forEach((entry) => {
      expect(entry.outcome).toEqual({
        kind: 'converged',
        outcome: { kind: 'refused', reason: 'different-vault' },
      });
    });

    // Reset mocks for second pass
    api.getVaultBlobInventory.mockClear();

    // Second pass: etag should NOT be carried (so refusal is re-evaluated, not skipped)
    await trigger.check(handle);
    expect(api.getVaultBlobInventory).toHaveBeenNthCalledWith(
      1,
      {
        ifNoneMatch: undefined,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  // ===== T1: A newer pass supersedes an outstanding one (#697) =====
  test('T1: A newer pass supersedes an outstanding one, allowing later checks to run (#697)', async () => {
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    // First pass hangs, second pass succeeds
    setupHangThenAnswerInventory(api);
    api.getVaultBlob.mockRejectedValue({ response: { status: 404 } });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // Start first pass (will hang on inventory)
    const promise1 = trigger.check(handle);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify first pass is stuck on inventory read
    expect(api.getVaultBlobInventory).toHaveBeenCalledTimes(1);

    // Start second pass (should supersede the first and run independently)
    const result2Promise = trigger.check(handle);

    // Await second pass — it should complete despite first pass hanging
    const result2 = await result2Promise;
    expect(result2.superseded).toBe(false);

    // Verify second pass called inventory (independently from first)
    expect(api.getVaultBlobInventory).toHaveBeenCalledTimes(2);

    // Await first pass — should resolve with superseded: true
    const result1 = await promise1;
    expect(result1.superseded).toBe(true);
    expect(result1.checked).toEqual([]);
    expect(result1.failed).toEqual([]);
    expect(result1.stoppedUnauthenticated).toBe(false);
  }, 3000);

  // ===== T2: Superseded pass's abort signal is aborted =====
  test("T2: The superseded pass's abort signal is aborted before the newer pass starts", async () => {
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    let capturedSignal: AbortSignal | undefined;
    let inventoryCallCount = 0;
    api.getVaultBlobInventory.mockImplementation(async (...args) => {
      inventoryCallCount++;
      if (inventoryCallCount === 1) {
        // Capture the signal from the first call
        capturedSignal = (args[1] as any)?.signal;
        // Never settle on first call
        return new Promise(() => {});
      }
      // Second call answers normally
      return axiosOk({
        etag: 'inventory-etag-v1',
        blobs: VAULT_BLOB_TYPES.map((type) => ({
          type,
          etag: `server-etag-${type}`,
          updatedAt: '2026-01-01T00:00:00.000Z',
        })),
      });
    });

    api.getVaultBlob.mockRejectedValue({ response: { status: 404 } });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // Start first pass
    const promise1 = trigger.check(handle);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify signal exists and is not yet aborted
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect((capturedSignal as AbortSignal).aborted).toBe(false);

    // Start second pass to supersede the first
    const result2Promise = trigger.check(handle);

    // Give a tick for the abort to propagate
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Now the signal should be aborted
    expect((capturedSignal as AbortSignal).aborted).toBe(true);

    // The first pass should resolve with superseded: true
    const result1 = await promise1;
    expect(result1.superseded).toBe(true);

    // Second pass should resolve normally
    const result2 = await result2Promise;
    expect(result2.superseded).toBe(false);
  }, 3000);

  // ===== T3: Non-superseded pass is not marked superseded =====
  test('T3: A pass that ran to its end is not marked superseded', async () => {
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    api.getVaultBlob.mockRejectedValue({ response: { status: 404 } });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const result = await trigger.check(handle);
    expect(result.superseded).toBe(false);
    expect(result.checked.length).toBeGreaterThan(0);
  });

  // ===== T4: Pass over budget resolves with unanswered types failed =====
  test('T4: A pass over its budget resolves with its unanswered types in failed', async () => {
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    // Inventory answers normally
    api.getVaultBlobInventory.mockResolvedValue(
      axiosOk({
        etag: 'inventory-etag-v1',
        blobs: VAULT_BLOB_TYPES.map((type) => ({
          type,
          etag: `server-etag-${type}`,
          updatedAt: '2026-01-01T00:00:00.000Z',
        })),
      }),
    );

    // getVaultBlob never settles, listening for abort to reject
    api.getVaultBlob.mockImplementation(
      (params, options) =>
        new Promise((resolve, reject) => {
          const signal = (options as any)?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(signal.reason || new Error('Aborted'));
            });
          }
          // Otherwise hang forever
        }),
    );

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
      budgetMs: 10,
    });

    const result = await trigger.check(handle);
    expect(result.superseded).toBe(false);
    // All types must be in failed since budget aborted before any could finish
    expect(result.checked).toHaveLength(0);
    expect(result.failed).toHaveLength(VAULT_BLOB_TYPES.length);
    // Every failed type must be from VAULT_BLOB_TYPES (sorted comparison)
    const failedTypes = result.failed.map((f) => f.type).sort();
    const expectedTypes = [...VAULT_BLOB_TYPES].sort();
    expect(failedTypes).toEqual(expectedTypes);
    // Every failed entry must have an error mentioning the budget
    for (const failed of result.failed) {
      expect(failed.error).toBeDefined();
      const errorMsg = (failed.error as Error).message || '';
      expect(errorMsg.toLowerCase()).toContain('budget');
    }
  }, 3000);

  // ===== T4b: Budget ends a pass whose request ignores abort =====
  test('T4b: Budget ends a pass whose request ignores the abort entirely', async () => {
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    // getVaultBlobInventory returns an unresolved promise with no abort listener
    // This simulates a request that ignores the abort signal entirely
    api.getVaultBlobInventory.mockImplementation(
      () => new Promise(() => {}), // Never settles, no abort listener
    );

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
      budgetMs: 10,
    });

    const result = await trigger.check(handle);
    // Pass must still resolve despite the hung request (via untilAborted)
    expect(result.superseded).toBe(false);
    // Inventory read failed, so every type is unanswered
    expect(result.checked).toHaveLength(0);
    expect(result.failed).toHaveLength(VAULT_BLOB_TYPES.length);
  }, 3000);

  // ===== T6: Superseded pass does not move remembered ETag =====
  test('T6: A superseded pass does not move the remembered inventory ETag', async () => {
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    // Clean pass to establish the etag
    api.getVaultBlob.mockRejectedValue({ response: { status: 404 } });
    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const result1 = await trigger.check(handle);
    expect(result1.inventoryEtag).toBe('inventory-etag-v1');

    // Clear mock and set up second scenario: first pass hangs, second pass runs
    api.getVaultBlobInventory.mockClear();
    setupHangThenAnswerInventory(api, {
      firstCallEtag: 'inventory-etag-v1',
      secondCallEtag: 'inventory-etag-v2',
    });

    // Start first pass (hangs)
    const promise1 = trigger.check(handle);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Start second pass
    const result2Promise = trigger.check(handle);

    // Wait for first pass to resolve (with superseded: true)
    const result1b = await promise1;
    expect(result1b.superseded).toBe(true);

    // Wait for second pass to resolve
    await result2Promise;

    // Verify that second pass sent the original etag (not modified by the abandoned first pass)
    expect(api.getVaultBlobInventory).toHaveBeenNthCalledWith(
      2,
      { ifNoneMatch: 'inventory-etag-v1' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  }, 3000);

  // ===== T6b: Late-finishing superseded pass does not clobber successor's ETag =====
  test('T6b: A superseded pass that finishes late must not clobber successor ETag', async () => {
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    // First call takes ~50ms; later calls answer immediately
    setupHangThenAnswerInventory(api, {
      firstCallDelay: 50,
      firstCallEtag: 'inventory-etag-v1',
      secondCallEtag: 'inventory-etag-v2',
    });

    api.getVaultBlob.mockRejectedValue({ response: { status: 404 } });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // Start pass 1 (slow inventory)
    const promise1 = trigger.check(handle);

    // Immediately start pass 2 (should supersede pass 1)
    const promise2 = trigger.check(handle);

    // Wait for pass 2 to complete
    const result2 = await promise2;
    expect(result2.superseded).toBe(false);

    // Wait for pass 1 to finish (it will be marked superseded)
    const result1 = await promise1;
    expect(result1.superseded).toBe(true);

    // Wait to ensure pass 1 has finished writing before starting pass 3
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Run pass 3 and verify it got pass 2's ETag, not pass 1's
    // (Pass 2 answered with inventory-etag-v2, pass 1 would have had inventory-etag-v1)
    const result3 = await trigger.check(handle);
    expect(result3.superseded).toBe(false);
    expect(api.getVaultBlobInventory).toHaveBeenNthCalledWith(
      3,
      { ifNoneMatch: 'inventory-etag-v2' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  }, 3000);

  // ===== T7: VAULT_PULL_PASS_BUDGET_MS is the default =====
  test('T7: VAULT_PULL_PASS_BUDGET_MS is the default and is 10 seconds', async () => {
    expect(VAULT_PULL_PASS_BUDGET_MS).toBe(10_000);

    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue({ response: { status: 404 } });

    // Create trigger without budgetMs to use default
    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // A fast pass should not abort
    const result = await trigger.check(handle);
    expect(result.superseded).toBe(false);
    expect(result.failed).toHaveLength(0);
  });

  // ===== stalledTypes behavior: population, recovery, and notification =====

  test('stalledTypes populated after a failing pass (budget exceeded)', async () => {
    // Behavior: A pass that runs over budget leaves all types in failed,
    // and stalledTypes reflects those failed types.
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    // Inventory answers normally
    api.getVaultBlobInventory.mockResolvedValue(
      axiosOk({
        etag: 'inventory-etag-v1',
        blobs: VAULT_BLOB_TYPES.map((type) => ({
          type,
          etag: `server-etag-${type}`,
          updatedAt: '2026-01-01T00:00:00.000Z',
        })),
      }),
    );

    // getVaultBlob never settles, listening for abort to reject
    api.getVaultBlob.mockImplementation(
      (params, options) =>
        new Promise((resolve, reject) => {
          const signal = (options as any)?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(signal.reason || new Error('Aborted'));
            });
          }
          // Otherwise hang forever
        }),
    );

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
      budgetMs: 10,
    });

    // Run a check that hits budget and leaves all types failed
    const result = await trigger.check(handle);
    expect(result.superseded).toBe(false);
    expect(result.failed).toHaveLength(VAULT_BLOB_TYPES.length);

    // Verify stalledTypes now matches failed types
    const status = trigger.status();
    expect(status.sessionEnded).toBe(false);
    const stalledTypesSorted = [...status.stalledTypes].sort();
    const expectedTypesSorted = [...VAULT_BLOB_TYPES].sort();
    expect(stalledTypesSorted).toEqual(expectedTypesSorted);
  }, 3000);

  test('superseded pass does not update stalledTypes', async () => {
    // Behavior: Start a first pass whose per-type reads fail (populating stalledTypes),
    // then start and await a second pass that supersedes an in-flight one.
    // The superseded pass's outcome never lands in stalledTypes.
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    // First, populate stalledTypes with a failing pass
    api.getVaultBlob.mockRejectedValue({
      response: { status: 500 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    // Run first pass to populate stalledTypes
    const result1 = await trigger.check(handle);
    expect(result1.failed.length).toBeGreaterThan(0);

    const statusAfterFirst = trigger.status();
    const stalledAfterFirst = [...statusAfterFirst.stalledTypes].sort();
    expect(stalledAfterFirst.length).toBeGreaterThan(0);

    // Now set up a hanging inventory for the second pass (to be superseded)
    let inventoryCallCount = 0;
    api.getVaultBlobInventory.mockImplementation(async (...args) => {
      inventoryCallCount++;
      if (inventoryCallCount === 1) {
        // First call from second pass: hang indefinitely
        return new Promise(() => {});
      }
      // Should not reach here in this test
      return axiosOk({
        etag: 'inventory-etag-v1',
        blobs: VAULT_BLOB_TYPES.map((type) => ({
          type,
          etag: `server-etag-${type}`,
          updatedAt: '2026-01-01T00:00:00.000Z',
        })),
      });
    });

    api.getVaultBlob.mockRejectedValue({ response: { status: 404 } });

    // Start second pass (will hang on inventory)
    const promise2 = trigger.check(handle);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify it's hanging
    expect(inventoryCallCount).toBe(1);

    // Start third pass to supersede the second (will hang too or answer)
    let inventoryCallCount2 = 0;
    api.getVaultBlobInventory.mockImplementation(async () => {
      inventoryCallCount2++;
      return axiosOk({
        etag: 'inventory-etag-v1',
        blobs: VAULT_BLOB_TYPES.map((type) => ({
          type,
          etag: `server-etag-${type}`,
          updatedAt: '2026-01-01T00:00:00.000Z',
        })),
      });
    });

    const promise3 = trigger.check(handle);

    // Await both passes
    const result2 = await promise2;
    const result3 = await promise3;

    // result2 should be superseded
    expect(result2.superseded).toBe(true);
    // result3 should not be superseded
    expect(result3.superseded).toBe(false);

    // stalledTypes should reflect only completed non-superseded passes.
    // After the superseding pass (result3, which answered 404 for all types),
    // stalledTypes should be empty (404 is a valid answer, not a failure).
    const statusAfterSupersede = trigger.status();
    expect(statusAfterSupersede.stalledTypes).toHaveLength(0);
  }, 3000);

  test('stalledTypes clears and notifies on recovery', async () => {
    // Behavior: First check() leaves types failed (e.g., per-type 500),
    // second check() against a now-working API (types resolve, e.g., 404/absent or not-modified).
    // stalledTypes goes from non-empty to empty, and listener is called again.
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    const listener = jest.fn();

    // First pass: all getVaultBlob calls fail with 500
    api.getVaultBlob.mockRejectedValue({
      response: { status: 500 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    trigger.subscribe(listener);

    // First check: all types fail with 500 → stalledTypes populated
    const result1 = await trigger.check(handle);
    expect(result1.failed.length).toBeGreaterThan(0);
    expect(listener).toHaveBeenCalledTimes(1); // Called once for stall

    const status1 = trigger.status();
    expect(status1.stalledTypes.length).toBeGreaterThan(0);

    // Clear mock and set up second pass: all types answer 404 (not a failure)
    api.getVaultBlob.mockClear();
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    // Second check: all types answer 404 → stalledTypes cleared, recovery notifies
    const result2 = await trigger.check(handle);
    // 404 is not a failure, so result2.failed should be empty
    expect(result2.failed).toHaveLength(0);
    // Listener should have been called again (stalledTypes changed from populated to empty)
    expect(listener).toHaveBeenCalledTimes(2);

    const status2 = trigger.status();
    expect(status2.stalledTypes).toHaveLength(0);
  });

  test('no redundant notify in the steady state (two clean passes)', async () => {
    // Behavior: Two consecutive check() calls both leave stalledTypes empty
    // (e.g., two clean passes, no session end, no stall).
    // Listener is NOT called at all (no state change).
    const handle = await setupHandle('user-1');
    const api = createApiDouble(handle);

    // All types answer 404 (not a failure, just "not found")
    api.getVaultBlob.mockRejectedValue({
      response: { status: 404 },
    });

    const trigger = createVaultPullTrigger({
      api,
      prompt: jest.fn(),
      schedule: jest.fn(),
    });

    const listener = jest.fn();
    trigger.subscribe(listener);

    // First check: clean pass (404 for all, stalledTypes stays empty)
    const result1 = await trigger.check(handle);
    expect(result1.failed).toHaveLength(0);
    expect(trigger.status().stalledTypes).toHaveLength(0);
    // Listener should NOT have been called (no state change)
    expect(listener).toHaveBeenCalledTimes(0);

    // Second check: another clean pass (same state)
    const result2 = await trigger.check(handle);
    expect(result2.failed).toHaveLength(0);
    expect(trigger.status().stalledTypes).toHaveLength(0);
    // Listener should still NOT have been called (no new state change)
    expect(listener).toHaveBeenCalledTimes(0);
  });
});
