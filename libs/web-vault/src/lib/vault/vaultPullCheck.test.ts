/**
 * Tests for Vault Pull's check-for-updates pass.
 *
 * checkVaultBlobsForUpdates iterates every Vault Blob Type, asks the server
 * whether its Ciphertext moved (via conditional GET), and converges the types
 * that did. Session loss (401/403) stops the pass immediately; any other error
 * is recorded and the pass moves on.
 *
 * Tests use REAL WebCrypto to establish decryptability through the real path.
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
import { readVaultBlobRecords } from '@myorganizer/core';

import { checkVaultBlobsForUpdates } from './vaultPullCheck';
import { createVaultHandle, type VaultHandle } from './vaultHandle';
import type { ServerVaultBlob } from './serverVaultSync';
import { localToServerMeta, toEncryptedBlobV1 } from './vaultShapes';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('checkVaultBlobsForUpdates', () => {
  const passphrase = 'vault key 2026';

  /**
   * Helper to create a properly typed API double for vault operations.
   */
  function createApiDouble(handle?: VaultHandle) {
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
        [
          {
            type: VaultBlobType;
            putVaultBlobRequest: unknown;
            ifMatch?: string;
          },
        ]
      >(),
    };

    // Default getVaultMeta returns server meta matching local vault identity
    if (handle) {
      const localVault = handle.loadVault();
      if (localVault) {
        api.getVaultMeta.mockResolvedValue(
          axiosResponse({
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
   * Helper to set up a vault fixture with initial data.
   * Uses REAL WebCrypto so decryptability is established the way production does it.
   */
  async function setupHandle(
    owner: string,
    payload?: unknown,
    type: 'tasks' | 'groceries' | 'todos' = 'tasks',
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
   * Helper to capture a remote blob that genuinely decrypts under the same Master Key.
   */
  async function captureRemoteBlob(
    handle: VaultHandle,
    payload: unknown,
    type: 'tasks' | 'groceries' | 'todos' = 'tasks',
  ): Promise<ServerVaultBlob> {
    const vault = handle.loadVault();
    if (!vault) throw new Error('Handle has no vault');
    const originalData = { ...vault.data };

    const envelope: VaultBlobEnvelope<unknown> = {
      records: payload,
      deletions: {},
    };
    await handle.saveEncryptedData({ type, value: envelope });

    const remoteVault = handle.loadVault();
    const encryptedBlob = remoteVault?.data[type];
    if (!encryptedBlob) {
      throw new Error(`Failed to save test blob for type ${type}`);
    }

    vault.data = originalData;
    handle.saveVault(vault);

    return {
      etag: 'etag-remote',
      updatedAt: '2026-01-01T00:00:00.000Z',
      type:
        type === 'groceries' ? VaultBlobType.Groceries : VaultBlobType.Tasks,
      blob: toEncryptedBlobV1(encryptedBlob),
    };
  }

  /**
   * Helper to format axios response for API mocks.
   */
  function axiosResponse<T>(data: T): AxiosResponse<T> {
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { headers: {} as any },
    } as unknown as AxiosResponse<T>;
  }

  /**
   * Helper to format getVaultBlob response with proper structure.
   */
  function formatGetVaultBlobResponse(blob: ServerVaultBlob) {
    return axiosResponse({
      etag: blob.etag,
      updatedAt: blob.updatedAt,
      type: blob.type,
      blob: blob.blob,
    });
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
    return axiosResponse({
      ok: true,
      etag,
      updatedAt: '2026-01-01T00:00:00.000Z',
      message: 'OK',
    });
  }

  /**
   * Helper to create a 304 error.
   */
  function create304Error() {
    const error = Object.assign(new Error('not modified'), {
      response: { status: 304 },
    });
    return error;
  }

  /**
   * Helper to create a 404 error.
   */
  function create404Error() {
    const error = Object.assign(new Error('not found'), {
      response: { status: 404 },
    });
    return error;
  }

  /**
   * Helper to create a 401 error.
   */
  function create401Error() {
    const error = Object.assign(new Error('unauthorized'), {
      response: { status: 401 },
    });
    return error;
  }

  /**
   * Helper to create a 403 error.
   */
  function create403Error() {
    const error = Object.assign(new Error('forbidden'), {
      response: { status: 403 },
    });
    return error;
  }

  /**
   * Helper to create a network error (no response field).
   */
  function createNetworkError() {
    const error = Object.assign(new Error('Network Error'), {
      code: 'ECONNABORTED',
    });
    return error;
  }

  /**
   * Helper to create a 500 server error.
   */
  function create500Error() {
    const error = Object.assign(new Error('server error'), {
      response: { status: 500 },
    });
    return error;
  }

  /**
   * A server Vault Meta belonging to a genuinely different Vault.
   *
   * Minted by initialising a second Vault, never hand-written: `initialize`
   * mints a fresh salt beside a fresh Master Key, which is what a differing
   * Vault Identity actually is. A hand-built object that merely omits
   * `kdf_salt` would make the guard fire on an absent field instead — and
   * would keep passing if the pinned facet moved to another field, which is
   * the opposite of what this asserts.
   */
  async function createDifferentIdentityMeta() {
    const otherHandle = createVaultHandle({ owner: 'user-2' });
    await otherHandle.initialize({ passphrase: 'othervault' });

    return axiosResponse({
      etag: 'meta-etag-different',
      updatedAt: '2026-01-01T00:00:00.000Z',
      meta: localToServerMeta(otherHandle.loadVault()!),
    });
  }

  // ===== Test 1: 304 not-modified =====
  test('should not converge when server returns 304 not-modified', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const vaultBefore = handle.loadVault();

    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue(create304Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    // Verify 304 was recorded as not-modified
    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual({ kind: 'not-modified' });

    // Verify no put was attempted
    expect(api.putVaultBlob).not.toHaveBeenCalled();

    // Verify local vault is byte-identical before and after
    const vaultAfter = handle.loadVault();
    expect(vaultAfter?.data.tasks).toEqual(vaultBefore?.data.tasks);
  });

  // ===== Test 2: Merge on change - clean local =====
  test('should take remote blob when local is clean', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-local' });

    const remote = await captureRemoteBlob(handle, [
      {
        id: 'remote-task',
        title: 'Remote task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const api = createApiDouble(handle);
    api.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remote));
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual(
      expect.objectContaining({ kind: 'converged' }),
    );

    // Verify local vault now holds remote records
    const decrypted = await handle.loadDecryptedData({
      type: 'tasks',
      defaultValue: null,
    });
    if (!decrypted) throw new Error('Failed to decrypt tasks');

    const records = readVaultBlobRecords(decrypted);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'remote-task',
          title: 'Remote task',
        }),
      ]),
    );

    // Verify Sync Bookmark advanced to remote's etag
    expect(handle.lastPushedEtag('tasks')).toBe('etag-remote');
  });

  // ===== Test 3: Local unsent + remote changed =====
  test('should merge local unsent and remote changed records by id', async () => {
    const localRecord = {
      id: 'local-task',
      title: 'Local unsent task',
      status: 'todo',
      priority: 'high',
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    };

    const handle = await setupHandle('user-1', [localRecord], 'tasks');
    // No recordPushSuccess — local has unsent changes

    const remoteRecord = {
      id: 'remote-task',
      title: 'Remote task',
      status: 'done',
      priority: 'medium',
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
    };

    const remote = await captureRemoteBlob(handle, [remoteRecord], 'tasks');

    const api = createApiDouble(handle);
    api.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remote));
    api.putVaultBlob.mockResolvedValue(formatPutVaultBlobResponse('etag-sent'));
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual(
      expect.objectContaining({ kind: 'converged' }),
    );

    // The merge result is sent. Asserted because the collaborator call is the
    // half of this that the Local Vault cannot show: a merge kept only here
    // would satisfy every record assertion below and still never reach the
    // server.
    expect(api.putVaultBlob).toHaveBeenCalled();

    // Verify both local and remote records are present (union-by-id merge)
    const decrypted = await handle.loadDecryptedData({
      type: 'tasks',
      defaultValue: null,
    });
    if (!decrypted) throw new Error('Failed to decrypt tasks');

    const records = readVaultBlobRecords(decrypted);
    expect(records).toHaveLength(2);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'local-task' }),
        expect.objectContaining({ id: 'remote-task' }),
      ]),
    );
  });

  // ===== Test 4: Offline-then-reconnect =====
  test('should record network error and continue; later successful pass merges both sides', async () => {
    const localRecord = {
      id: 'local-task',
      title: 'Local unsent task',
      status: 'todo',
      priority: 'high',
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    };

    const handle = await setupHandle('user-1', [localRecord], 'tasks');
    const vaultBefore = handle.loadVault();

    // First pass: network error
    const api1 = createApiDouble(handle);
    api1.getVaultBlob.mockRejectedValue(createNetworkError());
    const prompt1 = jest.fn();

    const result1 = await checkVaultBlobsForUpdates({
      api: api1,
      handle,
      prompt: prompt1,
    });

    // Verify error was recorded in failed, not in checked
    const tasksFailed = result1.failed.find(
      (f) => f.type === VaultBlobType.Tasks,
    );
    expect(tasksFailed).toBeDefined();
    expect(result1.stoppedUnauthenticated).toBe(false);

    // Verify local vault unchanged after first pass
    const vaultAfter1 = handle.loadVault();
    expect(vaultAfter1?.data.tasks).toEqual(vaultBefore?.data.tasks);

    // Second pass: reconnect with remote change
    const remoteRecord = {
      id: 'remote-task',
      title: 'Remote task',
      status: 'done',
      priority: 'medium',
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
    };

    const remote = await captureRemoteBlob(handle, [remoteRecord], 'tasks');

    const api2 = createApiDouble(handle);
    api2.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remote));
    api2.putVaultBlob.mockResolvedValue(
      formatPutVaultBlobResponse('etag-sent'),
    );
    const prompt2 = jest.fn();

    const result2 = await checkVaultBlobsForUpdates({
      api: api2,
      handle,
      prompt: prompt2,
    });

    const tasksOutcome = result2.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual(
      expect.objectContaining({ kind: 'converged' }),
    );

    // Verify both local and remote records survive
    const decrypted = await handle.loadDecryptedData({
      type: 'tasks',
      defaultValue: null,
    });
    if (!decrypted) throw new Error('Failed to decrypt tasks');

    const records = readVaultBlobRecords(decrypted);
    expect(records).toHaveLength(2);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'local-task' }),
        expect.objectContaining({ id: 'remote-task' }),
      ]),
    );
  });

  // ===== Test 5: 401 unauthorized stops loop =====
  test('should stop pass and set stoppedUnauthenticated on 401', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue(create401Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    expect(result.stoppedUnauthenticated).toBe(true);
    // Only the first type should be checked before stopping
    expect(api.getVaultBlob).toHaveBeenCalledTimes(1);
    // No checked outcomes (the 401 stopped before recording)
    expect(result.checked).toHaveLength(0);
  });

  // ===== Test 6: 403 forbidden stops loop =====
  test('should stop pass and set stoppedUnauthenticated on 403', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue(create403Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    expect(result.stoppedUnauthenticated).toBe(true);
    // Only the first type should be checked before stopping
    expect(api.getVaultBlob).toHaveBeenCalledTimes(1);
    // No checked outcomes
    expect(result.checked).toHaveLength(0);
  });

  // ===== Test 7: Absent on server =====
  test('should record absent when server holds no blob', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    const vaultBefore = handle.loadVault();

    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue(create404Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual({ kind: 'absent' });

    // Verify no put was attempted
    expect(api.putVaultBlob).not.toHaveBeenCalled();

    // Verify local vault unchanged
    const vaultAfter = handle.loadVault();
    expect(vaultAfter?.data.tasks).toEqual(vaultBefore?.data.tasks);
  });

  // ===== Different-Vault Identity Refusal Tests (ADR 0067 P1-P4) =====

  test('changed type with different identity refuses', async () => {
    const handle = await setupHandle('user-1', [{ id: 'task1' }], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-local' });

    const vaultBefore = handle.loadVault();
    const localTasksBefore = vaultBefore?.data.tasks;

    const differentHandle = createVaultHandle({ owner: 'user-2' });
    await differentHandle.initialize({ passphrase: 'othervault' });
    const differentMeta = localToServerMeta(differentHandle.loadVault()!);

    const remote = await captureRemoteBlob(
      handle,
      [{ id: 'remote1' }],
      'tasks',
    );

    const api = createApiDouble(handle);
    api.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'meta-etag',
        updatedAt: '2026-01-01T00:00:00.000Z',
        meta: differentMeta,
      }),
    );
    api.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remote));
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual({
      kind: 'converged',
      outcome: { kind: 'refused', reason: 'different-vault' },
    });
    expect(api.putVaultBlob).not.toHaveBeenCalled();
    expect(handle.loadVault()?.data.tasks).toEqual(localTasksBefore);
    expect(handle.lastPushedEtag('tasks')).toEqual('etag-local');
  });

  test('changed types with identical identity converge as before', async () => {
    const handle = await setupHandle('user-1', [{ id: 'local1' }], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-local' });
    const remote = await captureRemoteBlob(
      handle,
      [{ id: 'remote1' }],
      'tasks',
    );

    const api = createApiDouble(handle);
    api.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remote));
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    // `checked[].outcome` is the pass's own wrapper, so its `kind` is always
    // `'converged'` — asserting `not.toBe('refused')` on it can never fail.
    // The converge outcome is one level down, and naming it is the only thing
    // that catches a guard which refused unconditionally: that guard would
    // still report `kind: 'converged'` here while destroying all convergence.
    const converged =
      tasksOutcome?.outcome.kind === 'converged'
        ? tasksOutcome.outcome.outcome
        : undefined;
    expect(converged).toEqual({ kind: 'took', etag: remote.etag });
    expect(handle.lastPushedEtag('tasks')).toBe(remote.etag);
  });

  test('multiple changed types fetch meta exactly once', async () => {
    const handle = await setupHandle('user-1', [{ id: 'task1' }], 'tasks');
    const groceriesEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'groc1' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'groceries',
      value: groceriesEnvelope,
    });

    const remoteBlob1 = await captureRemoteBlob(
      handle,
      [{ id: 'remote1' }],
      'tasks',
    );
    const remoteBlob2 = await captureRemoteBlob(
      handle,
      [{ id: 'remote-groc' }],
      'groceries',
    );

    const api = createApiDouble(handle);
    api.getVaultBlob.mockImplementation(async (_opts: unknown) => {
      const optsAny = _opts as any;
      if (optsAny?.type === VaultBlobType.Tasks)
        return formatGetVaultBlobResponse(remoteBlob1);
      if (optsAny?.type === VaultBlobType.Groceries)
        return formatGetVaultBlobResponse(remoteBlob2);
      throw create404Error();
    });
    const prompt = jest.fn();

    await checkVaultBlobsForUpdates({ api, handle, prompt });

    expect(api.getVaultMeta).toHaveBeenCalledTimes(1);
  });

  test('all types 304 never fetches meta', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const api = createApiDouble(handle);
    api.getVaultBlob.mockRejectedValue(create304Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    expect(api.getVaultMeta).not.toHaveBeenCalled();
    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual({ kind: 'not-modified' });
  });

  test('getVaultMeta 500 error puts changed types in failed', async () => {
    const handle = await setupHandle('user-1', [{ id: 'task1' }], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const remoteBlob = await captureRemoteBlob(
      handle,
      [{ id: 'remote1' }],
      'tasks',
    );

    const api = createApiDouble(handle);
    api.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remoteBlob));
    // Override getVaultMeta to reject with 500
    api.getVaultMeta.mockRejectedValue(create500Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Every changed type lands in failed, not checked
    const tasksFailed = result.failed.find(
      (f) => f.type === VaultBlobType.Tasks,
    );
    expect(tasksFailed).toBeDefined();
    expect(tasksFailed?.error).toBeDefined();

    // Verify nothing was checked (all went to failed)
    const tasksChecked = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksChecked).toBeUndefined();

    // Memoised promise: second type re-throws same rejection, only one call
    expect(api.getVaultMeta).toHaveBeenCalledTimes(1);
  });

  test('getVaultMeta 401 stops pass with stoppedUnauthenticated', async () => {
    const handle = await setupHandle('user-1', [{ id: 'task1' }], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const remoteBlob = await captureRemoteBlob(
      handle,
      [{ id: 'remote1' }],
      'tasks',
    );

    const api = createApiDouble(handle);
    api.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remoteBlob));
    // Override getVaultMeta to reject with 401
    api.getVaultMeta.mockRejectedValue(create401Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Pass stops immediately with stoppedUnauthenticated
    expect(result.stoppedUnauthenticated).toBe(true);

    // Nothing was checked or recorded
    expect(result.checked).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  test('locked vault with different identity refuses', async () => {
    // First, set up an unlocked vault with data to establish local vault state
    const unlockedHandle = await setupHandle(
      'user-1',
      [{ id: 'task1' }],
      'tasks',
    );
    await unlockedHandle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const remoteBlob = await captureRemoteBlob(
      unlockedHandle,
      [{ id: 'remote1' }],
      'tasks',
    );

    // Now create a NEW handle for the same owner (locked by default, no Master Key bound)
    const lockedHandle = createVaultHandle({ owner: 'user-1' });

    const api = createApiDouble();
    api.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remoteBlob));
    // Override getVaultMeta to return different identity
    api.getVaultMeta.mockResolvedValue(await createDifferentIdentityMeta());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle: lockedHandle,
      prompt,
    });

    // Even with locked vault, different identity refuses
    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual(
      expect.objectContaining({
        kind: 'converged',
        outcome: expect.objectContaining({
          kind: 'refused',
          reason: 'different-vault',
        }),
      }),
    );
  });
});
