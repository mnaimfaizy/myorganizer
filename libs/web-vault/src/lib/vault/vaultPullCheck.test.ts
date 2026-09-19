/**
 * Tests for Vault Pull's check-for-updates pass.
 *
 * A pass first reads the Vault Blob Inventory, which names every Vault Blob
 * Type the server holds and the identity of each one's Ciphertext. It then
 * asks about a type only when the inventory says its Ciphertext differs from
 * this device's Sync Bookmark ([ADR 0087](../../../../../docs/adr/0087-a-vault-pull-pass-asks-the-vault-blob-inventory-and-absence-deletes-nothing.md)).
 *
 * Session loss (401/403) stops the pass immediately; any other error is
 * recorded and the pass moves on. A failed inventory read fails the pass
 * entirely: every type is unanswered.
 *
 * Tests use REAL WebCrypto to establish decryptability through the real path.
 */

import type { AxiosResponse } from 'axios';
import { VaultBlobType } from '@myorganizer/app-api-client';
import type { VaultBlobEnvelope } from '@myorganizer/core';
import { readVaultBlobRecords } from '@myorganizer/core';

import { checkVaultBlobsForUpdates } from './vaultPullCheck';
import { createVaultHandle, type VaultHandle } from './vaultHandle';
import type { ServerVaultBlob } from './serverVaultSync';
import { localToServerMeta, toEncryptedBlobV1 } from './vaultShapes';
import { VAULT_BLOB_TYPES } from './vaultBlobFields';

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
   * Helper to create an inventory response with specific named types and their etags.
   * Entries REQUIRED — never bare call. This prevents silent "inventory is empty" bugs.
   * Entries should differ from any Sync Bookmarks to ensure per-type reads happen.
   */
  function inventoryResponse(
    entries: Array<{ type: VaultBlobType; etag: string; updatedAt: string }>,
  ) {
    return axiosResponse({
      etag: 'inventory-etag-v1',
      blobs: entries,
    });
  }

  /**
   * Helper to create an inventory naming EVERY Vault Blob Type with an etag
   * that differs from any Sync Bookmark. Use in tests that need per-type reads to happen.
   */
  function everyTypeInventoryResponse(etag = 'inventory-etag-v1') {
    return axiosResponse({
      etag,
      blobs: VAULT_BLOB_TYPES.map((type) => ({
        type,
        etag: `server-etag-${type}`,
        updatedAt: '2026-01-01T00:00:00.000Z',
      })),
    });
  }

  /**
   * Helper to set up a vault fixture with initial data.
   * Uses REAL WebCrypto so decryptability is established the way production does it.
   */
  async function setupHandle(
    owner: string,
    payload?: unknown,
    type: 'tasks' | 'groceries' = 'tasks',
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
    type: 'tasks' | 'groceries' = 'tasks',
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

  // ===== Test 1: 304 not-modified on per-type read =====
  test('should not converge when server returns 304 not-modified on per-type read', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const vaultBefore = handle.loadVault();

    const api = createApiDouble(handle);
    // Inventory names Tasks with etag differing from Sync Bookmark
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    api.getVaultBlob.mockRejectedValue(create304Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    // Verify 304 was recorded as not-modified for Tasks
    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual({ kind: 'not-modified' });
    // Other types are absent (not in inventory)
    for (const type of VAULT_BLOB_TYPES) {
      if (type === VaultBlobType.Tasks) continue;
      const outcome = result.checked.find((c) => c.type === type);
      expect(outcome?.outcome).toEqual({ kind: 'absent' });
    }

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
    // Inventory names Tasks with etag differing from Sync Bookmark
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
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
    // Inventory names Tasks with etag differing (device has no bookmark)
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-from-server',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
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

    // First pass: network error on inventory read
    const api1 = createApiDouble(handle);
    api1.getVaultBlobInventory.mockRejectedValue(createNetworkError());
    const prompt1 = jest.fn();

    const result1 = await checkVaultBlobsForUpdates({
      api: api1,
      handle,
      prompt: prompt1,
    });

    // Verify error was recorded in failed for every type, not in checked
    expect(result1.failed).toHaveLength(VAULT_BLOB_TYPES.length);
    expect(result1.checked).toHaveLength(0);
    expect(result1.stoppedUnauthenticated).toBe(false);
    // Verify getVaultBlob was never called
    expect(api1.getVaultBlob).not.toHaveBeenCalled();

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
    // Inventory names Tasks with etag differing from no Sync Bookmark
    api2.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-from-server',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
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

  // ===== Test 5: 401 unauthorized on inventory stops pass immediately =====
  test('should stop pass and set stoppedUnauthenticated on 401 from inventory', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockRejectedValue(create401Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    expect(result.stoppedUnauthenticated).toBe(true);
    // No types were checked
    expect(result.checked).toHaveLength(0);
    // No types left unanswered (they were not reached)
    expect(result.failed).toHaveLength(0);
    // No per-type getVaultBlob calls
    expect(api.getVaultBlob).not.toHaveBeenCalled();
  });

  // ===== Test 6: 403 forbidden on inventory stops pass immediately =====
  test('should stop pass and set stoppedUnauthenticated on 403 from inventory', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockRejectedValue(create403Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    expect(result.stoppedUnauthenticated).toBe(true);
    // No types were checked
    expect(result.checked).toHaveLength(0);
    // No types left unanswered
    expect(result.failed).toHaveLength(0);
    // No per-type calls
    expect(api.getVaultBlob).not.toHaveBeenCalled();
  });

  // ===== Test 7: Absent on server (from per-type read 404) =====
  test('should record absent when per-type read returns 404', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    const vaultBefore = handle.loadVault();

    const api = createApiDouble(handle);
    // Inventory names Tasks with etag differing from Sync Bookmark
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    api.getVaultBlob.mockRejectedValue(create404Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
    });

    // Tasks recorded as absent (404 from per-type read)
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
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
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
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
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
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          type: VaultBlobType.Groceries,
          etag: 'groceries-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
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

  test('inventory 304 never fetches meta or per-type reads', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    // Inventory answers 304 directly (not-modified)
    const passedEtag = 'inv-etag-from-last-pass';
    api.getVaultBlobInventory.mockRejectedValue(
      Object.assign(new Error('not modified'), { response: { status: 304 } }),
    );
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
      inventoryEtag: passedEtag,
    });

    // No meta read
    expect(api.getVaultMeta).not.toHaveBeenCalled();
    // No per-type reads
    expect(api.getVaultBlob).not.toHaveBeenCalled();
    // Every type is recorded as not-modified
    for (const type of VAULT_BLOB_TYPES) {
      const outcome = result.checked.find((c) => c.type === type);
      expect(outcome?.outcome).toEqual({ kind: 'not-modified' });
    }
    // Inventory ETag echoed back (it was passed in as ifNoneMatch)
    expect(result.inventoryEtag).toBe(passedEtag);
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
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
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
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    api.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remoteBlob));
    // Override getVaultMeta to reject with 401
    api.getVaultMeta.mockRejectedValue(create401Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Pass stops immediately with stoppedUnauthenticated
    expect(result.stoppedUnauthenticated).toBe(true);
    // No failure entries (getVaultMeta error doesn't record failures)
    expect(result.failed).toHaveLength(0);
    // Types before Tasks are recorded as absent (not in inventory)
    // Then Tasks would be attempted but getVaultMeta throws 401, stopping the pass
    expect(result.checked.length).toBeGreaterThan(0);
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
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
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

  // ===== NEW TEST CASES FOR ADR 0087 =====

  // Test 1: Inventory entries matching local Sync Bookmarks → no per-type reads for those types
  test('inventory etags matching Sync Bookmarks → no per-type reads for matched types', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    // Set Sync Bookmarks matching what inventory will say
    await handle.recordPushSuccess({ type: 'tasks', etag: 'tasks-etag-v1' });

    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-v1',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Only inventory read, no per-type reads
    expect(api.getVaultBlobInventory).toHaveBeenCalledTimes(1);
    expect(api.getVaultBlob).not.toHaveBeenCalled();
    expect(api.getVaultMeta).not.toHaveBeenCalled();

    // Tasks is answered as not-modified
    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual({ kind: 'not-modified' });

    // inventoryEtag recorded
    expect(result.inventoryEtag).toBe('inventory-etag-v1');
  });

  // Test 2: Inventory answers 304 — all types not-modified, nothing else read
  test('inventory answers 304 → all types recorded not-modified, no other reads', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockRejectedValue(
      Object.assign(new Error('not modified'), { response: { status: 304 } }),
    );
    // Pass in an etag for the inventory to echo back
    const passedEtag = 'inventory-etag-from-last-pass';
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt,
      inventoryEtag: passedEtag,
    });

    // Only inventory read, with ifNoneMatch sent
    expect(api.getVaultBlobInventory).toHaveBeenCalledWith(
      { ifNoneMatch: passedEtag },
      expect.any(Object), // Second argument is request options with signal (may be undefined)
    );
    expect(api.getVaultBlob).not.toHaveBeenCalled();
    expect(api.getVaultMeta).not.toHaveBeenCalled();

    // Every type is answered as not-modified
    expect(result.checked).toHaveLength(VAULT_BLOB_TYPES.length);
    for (const type of VAULT_BLOB_TYPES) {
      const outcome = result.checked.find((c) => c.type === type);
      expect(outcome?.outcome).toEqual({ kind: 'not-modified' });
    }

    // inventoryEtag echoed back
    expect(result.inventoryEtag).toBe(passedEtag);
  });

  // Test 3: Type in inventory but no Sync Bookmark on this device → read and converge
  test('type in inventory but no Sync Bookmark → per-type read happens and converges', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    // Deliberately NO Sync Bookmark for Groceries — cross-device discovery

    const remote = await captureRemoteBlob(
      handle,
      [{ id: 'groc-from-other-device' }],
      'groceries',
    );

    const api = createApiDouble(handle);
    // Use inventory naming every type so Groceries is readable
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
    api.getVaultBlob.mockImplementation(async (_opts: unknown) => {
      const optsAny = _opts as any;
      if (optsAny?.type === VaultBlobType.Groceries) {
        return formatGetVaultBlobResponse(remote);
      }
      throw create404Error();
    });
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Groceries was read (cross-device discovery)
    expect(api.getVaultBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: VaultBlobType.Groceries,
        ifNoneMatch: undefined,
      }),
      expect.any(Object), // Second argument is request options with signal (may be undefined)
    );

    // Groceries converged
    const groc = result.checked.find((c) => c.type === VaultBlobType.Groceries);
    expect(groc?.outcome.kind).toBe('converged');

    // Remote records now in local vault
    const decrypted = await handle.loadDecryptedData({
      type: 'groceries',
      defaultValue: null,
    });
    if (!decrypted) throw new Error('Failed to decrypt groceries');

    const records = readVaultBlobRecords(decrypted);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'groc-from-other-device',
        }),
      ]),
    );

    // Sync Bookmark advanced
    expect(handle.lastPushedEtag('groceries')).toBe(remote.etag);
  });

  // Test 4: Type ABSENT from inventory while local blob EXISTS → never read, byte-identical
  test('type absent from inventory but local blob exists → recorded absent, local vault unchanged', async () => {
    const localGroceries = { id: 'local-groc', title: 'Milk' };
    const handle = await setupHandle('user-1', [], 'tasks');
    await handle.saveEncryptedData({
      type: 'groceries',
      value: { records: [localGroceries], deletions: {} },
    });
    const vaultBefore = handle.loadVault();
    const localGroceriesBlobBefore = vaultBefore?.data.groceries;

    const api = createApiDouble(handle);
    // Inventory names only Tasks, not Groceries (absence means nothing to pull)
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Groceries never read (absent from inventory)
    expect(api.getVaultBlob).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: VaultBlobType.Groceries }),
    );

    // Groceries recorded as absent
    const groc = result.checked.find((c) => c.type === VaultBlobType.Groceries);
    expect(groc?.outcome).toEqual({ kind: 'absent' });

    // Local vault byte-identical (ADR 0087 decision 5)
    const vaultAfter = handle.loadVault();
    expect(vaultAfter?.data.groceries).toEqual(localGroceriesBlobBefore);

    // Local data still decryptable to the same record
    const decrypted = await handle.loadDecryptedData({
      type: 'groceries',
      defaultValue: null,
    });
    if (!decrypted) throw new Error('Failed to decrypt groceries');

    const records = readVaultBlobRecords(decrypted);
    expect(records).toEqual([localGroceries]);
  });

  // Test 5: Inventory 500 → every type in failed, no per-type reads
  test('inventory 500 error → every type in failed, no per-type reads', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockRejectedValue(create500Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Every type in failed
    expect(result.failed).toHaveLength(VAULT_BLOB_TYPES.length);
    for (const type of VAULT_BLOB_TYPES) {
      const failed = result.failed.find((f) => f.type === type);
      expect(failed).toBeDefined();
      expect(failed?.error).toBeDefined();
    }

    // No types checked
    expect(result.checked).toHaveLength(0);
    // No per-type reads
    expect(api.getVaultBlob).not.toHaveBeenCalled();
    // No meta reads
    expect(api.getVaultMeta).not.toHaveBeenCalled();
  });

  // Test 6: Inventory network error → every type in failed, no per-type reads
  test('inventory network error → every type in failed, no per-type reads', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockRejectedValue(createNetworkError());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Every type in failed
    expect(result.failed).toHaveLength(VAULT_BLOB_TYPES.length);
    expect(result.checked).toHaveLength(0);
    // No per-type reads
    expect(api.getVaultBlob).not.toHaveBeenCalled();
  });

  // Test 7: Inventory per-type 401 → per-type read stops pass immediately
  test('per-type read 401 stops pass (types after it are not read)', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    // Name every type so the loop actually tries to read them
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
    // First type gets 401, second type should not be read
    api.getVaultBlob.mockRejectedValue(create401Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Pass stopped
    expect(result.stoppedUnauthenticated).toBe(true);
    // No types were answered
    expect(result.checked).toHaveLength(0);
    // Only the first type should have been attempted (stopsat first one with 401)
    expect(api.getVaultBlob).toHaveBeenCalledTimes(1);
  });

  // Test 8: Inventory per-type 403 → per-type read stops pass immediately
  test('per-type read 403 stops pass (types after it are not read)', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    // Name every type so the loop actually tries to read them
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
    // First type gets 403, second type should not be read
    api.getVaultBlob.mockRejectedValue(create403Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Pass stopped
    expect(result.stoppedUnauthenticated).toBe(true);
    // No types were answered
    expect(result.checked).toHaveLength(0);
    // Only the first type should have been attempted (stops at first one with 403)
    expect(api.getVaultBlob).toHaveBeenCalledTimes(1);
  });

  // Test 9: Two types named with differing etags → both read and converged, meta once
  test('two types named with differing etags → both read and converged, meta called exactly once', async () => {
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
    // Use every-type inventory so all types are readable
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
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

    // Meta called once for convergence
    expect(api.getVaultMeta).toHaveBeenCalledTimes(1);
  });

  // Test 10: Type named with differing etag, per-type GET answers 404 → recorded absent
  test('per-type GET 404 → recorded as absent (genuine race)', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    // Name every type so they are all readable (inventory exists for them)
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
    // Per-type GETs all answer 404 (genuine race: was in inventory, but disappeared)
    api.getVaultBlob.mockRejectedValue(create404Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // All types were attempted (getVaultBlob called for each)
    expect(api.getVaultBlob).toHaveBeenCalledTimes(VAULT_BLOB_TYPES.length);
    // All types recorded as absent (per-type read got 404)
    for (const type of VAULT_BLOB_TYPES) {
      const outcome = result.checked.find((c) => c.type === type);
      expect(outcome?.outcome).toEqual({ kind: 'absent' });
    }
  });

  // Test 11: Per-type GET 304 → recorded as not-modified (even though inventory said it differs)
  test('per-type GET 304 → recorded as not-modified', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    // Per-type read gets 304
    api.getVaultBlob.mockRejectedValue(create304Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // Tasks recorded as not-modified
    const tasksOutcome = result.checked.find(
      (c) => c.type === VaultBlobType.Tasks,
    );
    expect(tasksOutcome?.outcome).toEqual({ kind: 'not-modified' });
  });

  // Test 12: Per-type non-auth failure recorded in failed, pass continues
  test('per-type non-auth failure recorded in failed, pass continues to later types', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    let callCount = 0;
    const api = createApiDouble(handle);
    // Name every type so all are readable
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
    api.getVaultBlob.mockImplementation(async () => {
      callCount++;
      // First type fails with 500, later types should still be read
      if (callCount === 1) {
        throw create500Error();
      }
      throw create404Error();
    });
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // First type (earliest in VAULT_BLOB_TYPES) in failed
    expect(result.failed).toHaveLength(1);
    const firstType = VAULT_BLOB_TYPES[0];
    expect(result.failed[0].type).toBe(firstType);
    // Remaining types were read and recorded as absent (404)
    expect(result.checked.length).toBe(VAULT_BLOB_TYPES.length - 1);
    // getVaultBlob called for all types
    expect(api.getVaultBlob).toHaveBeenCalledTimes(VAULT_BLOB_TYPES.length);
  });

  // Test 13: result.inventoryEtag on 200 read is inventory's own etag
  test('result.inventoryEtag on 200 read is inventory etag', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');

    const api = createApiDouble(handle);
    // Inventory with every type so the pass completes normally
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
    api.getVaultBlob.mockRejectedValue(create404Error());
    const prompt = jest.fn();

    const result = await checkVaultBlobsForUpdates({ api, handle, prompt });

    // inventoryEtag returned from inventory response
    expect(result.inventoryEtag).toBe('inventory-etag-v1');
  });

  // ===== C1: Signal reaches inventory read =====
  test('C1: The signal reaches the inventory read', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
    api.getVaultBlob.mockRejectedValue(create404Error());

    const controller = new AbortController();
    const signal = controller.signal;

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt: jest.fn(),
      signal,
    });

    // getVaultBlobInventory called with the exact signal
    expect(api.getVaultBlobInventory).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ signal }),
    );

    // Pass completed normally
    expect(result.checked.length).toBeGreaterThan(0);
  });

  // ===== C2: Signal reaches every per-type read =====
  test('C2: The signal reaches every per-type read', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
    api.getVaultBlob.mockRejectedValue(create404Error());

    const controller = new AbortController();
    const signal = controller.signal;

    await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt: jest.fn(),
      signal,
    });

    // Every getVaultBlob call should have the same signal
    const calls = api.getVaultBlob.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const callArgs of calls) {
      expect(callArgs[1]).toEqual(expect.objectContaining({ signal }));
    }
  });

  // ===== C3: Signal reaches Vault Meta observation =====
  test('C3: The signal reaches the Vault Meta observation', async () => {
    const handle = await setupHandle('user-1', [{ id: 'task1' }], 'tasks');
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-local' });

    const remote = await captureRemoteBlob(
      handle,
      [{ id: 'remote1' }],
      'tasks',
    );

    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockResolvedValue(
      inventoryResponse([
        {
          type: VaultBlobType.Tasks,
          etag: 'tasks-etag-differs',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    api.getVaultBlob.mockResolvedValue(formatGetVaultBlobResponse(remote));

    const controller = new AbortController();
    const signal = controller.signal;

    await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt: jest.fn(),
      signal,
    });

    // getVaultMeta should be called with the signal
    expect(api.getVaultMeta).toHaveBeenCalledWith(
      expect.objectContaining({ signal }),
    );
  });

  // ===== C4: Signal already aborted before type loop =====
  test('C4: A signal already aborted before the pass reaches the type loop', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    const api = createApiDouble(handle);

    // Inventory answers normally
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());

    const controller = new AbortController();
    const abortReason = new Error('Pre-aborted by test');
    controller.abort(abortReason);

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt: jest.fn(),
      signal: controller.signal,
    });

    // No per-type reads since signal was already aborted
    expect(api.getVaultBlob).not.toHaveBeenCalled();
    // Every type is in failed with the abort reason
    expect(result.failed).toHaveLength(VAULT_BLOB_TYPES.length);
    for (const failed of result.failed) {
      expect(failed.error).toBe(abortReason);
    }
    // No types were checked
    expect(result.checked).toHaveLength(0);
  });

  // ===== C5: Abort part-way through the loop =====
  test('C5: Abort part-way through the type loop', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    const api = createApiDouble(handle);

    // Inventory names every type
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());

    const controller = new AbortController();
    const abortReason = new Error('Aborted during type loop');

    let callCount = 0;
    api.getVaultBlob.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        // Abort on second type read, so first type is answered first
        Promise.resolve().then(() => {
          controller.abort(abortReason);
        });
      }
      throw create404Error();
    });

    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt: jest.fn(),
      signal: controller.signal,
    });

    // getVaultBlob called exactly twice (first and second types)
    expect(api.getVaultBlob).toHaveBeenCalledTimes(2);

    // First type in checked with outcome kind 'absent'
    const firstType = VAULT_BLOB_TYPES[0];
    expect(result.checked).toHaveLength(1);
    expect(result.checked[0]).toEqual({
      type: firstType,
      outcome: { kind: 'absent' },
    });

    // Remaining types in failed (exactly)
    const expectedFailedTypes = VAULT_BLOB_TYPES.slice(1);
    expect(result.failed).toHaveLength(expectedFailedTypes.length);
    const failedTypes = result.failed.map((f) => f.type);
    expect(failedTypes).toEqual(expectedFailedTypes);

    // Every failed entry has the abort reason
    for (const failed of result.failed) {
      expect(failed.error).toBe(abortReason);
    }
  });

  // ===== C6: No signal still works =====
  test('C6: No signal at all still works', async () => {
    const handle = await setupHandle('user-1', [], 'tasks');
    const api = createApiDouble(handle);
    api.getVaultBlobInventory.mockResolvedValue(everyTypeInventoryResponse());
    api.getVaultBlob.mockRejectedValue(create404Error());

    // Call without signal parameter
    const result = await checkVaultBlobsForUpdates({
      api,
      handle,
      prompt: jest.fn(),
    });

    // Pass should complete normally
    expect(result.checked.length).toBeGreaterThan(0);
    expect(result.failed).toHaveLength(0);
  });
});
