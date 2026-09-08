/**
 * Tests for Vault Reconcile — the sign-in pass over one User's Vault.
 *
 * Reconcile decides nothing about a Vault Blob itself; every Vault Blob Type
 * goes through convergeVaultBlob, the one place a convergence decision is made.
 * This module is a loop and a pair of degenerate cases rather than a second
 * implementation of convergence.
 *
 * Tests use REAL convergeVaultBlob with REAL WebCrypto to establish that
 * reconciliation truly converges every type. Dirtiness, mergability, and
 * decryptability are established through the real path, not faked with stubs.
 * The serverVaultSync module is mocked at the transport seam to control server
 * responses consistently.
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
import { VaultBlobType, type VaultMetaV1 } from '@myorganizer/app-api-client';
import type { VaultBlobEnvelope } from '@myorganizer/core';

import { createVaultHandle } from './vaultHandle';
import {
  reconcileVaultWithServer,
  type VaultReconcileAsk,
  type VaultReconcileDecision,
} from './vaultReconcile';
import type { ServerVaultBlob } from './serverVaultSync';
import { VAULT_BLOB_FIELDS, VAULT_BLOB_TYPES } from './vaultBlobFields';
import {
  localToServerMeta,
  serverEncryptedBlobToLocal,
  toEncryptedBlobV1,
} from './vaultShapes';

jest.mock('./serverVaultSync', () => ({
  getServerVaultMeta: jest.fn(),
  getServerVaultBlob: jest.fn(),
  putServerVaultMetaEtagAware: jest.fn(),
}));

const serverVaultSync = jest.requireMock('./serverVaultSync') as {
  getServerVaultMeta: jest.Mock;
  getServerVaultBlob: jest.Mock;
  putServerVaultMetaEtagAware: jest.Mock;
};

type ApiParam = Parameters<typeof reconcileVaultWithServer>[0]['api'];

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('reconcileVaultWithServer', () => {
  const passphrase = 'vault key 2026';

  /**
   * Helper to create a properly typed API double that matches axios response shape.
   */
  function createApiDouble() {
    const api = {
      getVaultMeta: jest.fn<Promise<AxiosResponse<any>>, []>(),
      putVaultMeta: jest.fn<Promise<AxiosResponse<any>>, []>(),
      getVaultBlob: jest.fn<Promise<AxiosResponse<any>>, []>(),
      putVaultBlob: jest.fn<
        Promise<
          AxiosResponse<{
            ok: boolean;
            etag: string;
            updatedAt: string;
            message: string;
          }>
        >,
        [{ type: VaultBlobType; putVaultBlobRequest: any; ifMatch?: string }]
      >(),
    };

    // A server that accepts every push, so a test that is not about the push
    // does not have to stub one. Tests asserting a conflict override it.
    api.putVaultBlob.mockImplementation(async () =>
      axiosResponse({
        ok: true,
        etag: 'etag-accepted',
        updatedAt: '2026-01-03T00:00:00.000Z',
        message: 'OK',
      }),
    );

    return api;
  }

  /**
   * Helper to create axios response with proper structure.
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
   * Helper to set up a vault handle with optional initial data.
   */
  async function setupHandle(
    owner: string,
    payload?: unknown,
    type: VaultBlobType = VaultBlobType.Tasks,
  ) {
    const handle = createVaultHandle({ owner });
    await handle.initialize({ passphrase });
    await handle.unlockWithPassphrase({ passphrase });

    if (payload) {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: payload,
        deletions: {},
      };
      await handle.saveEncryptedData({
        type: VAULT_BLOB_FIELDS[type],
        value: envelope,
      });
    }

    return handle;
  }

  /**
   * A device that holds no Local Vault at all — never initialized, so
   * `loadVault()` is null and reconcile takes its degenerate download path.
   */
  function emptyHandle(owner: string) {
    return createVaultHandle({ owner });
  }

  /**
   * The server holding byte-for-byte what this device holds for `type`.
   *
   * Encryption is randomized per save, so two saves of the same payload are
   * never the same Ciphertext — a genuinely in-sync server has to be built
   * from the Ciphertext itself, not from an equal payload.
   */
  function remoteFromLocal(
    handle: Awaited<ReturnType<typeof setupHandle>>,
    type: VaultBlobType = VaultBlobType.Tasks,
    etag = 'etag-in-sync',
  ): ServerVaultBlob {
    const blob = handle.loadVault()?.data[VAULT_BLOB_FIELDS[type]];
    if (!blob) throw new Error(`Handle holds no Ciphertext for ${type}`);

    return {
      etag,
      updatedAt: '2026-01-01T00:00:00.000Z',
      type,
      blob: toEncryptedBlobV1(blob),
    };
  }

  /**
   * Helper to create a server vault meta response.
   */
  function makeServerMeta(overrides: Partial<VaultMetaV1> = {}): VaultMetaV1 {
    return {
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: 'salt',
      kdf_params: { hash: 'SHA-256', iterations: 310_000 },
      wrapped_mk_passphrase: { version: 1, iv: 'iv1', ciphertext: 'ct1' },
      wrapped_mk_recovery: { version: 1, iv: 'iv2', ciphertext: 'ct2' },
      ...overrides,
    };
  }

  /**
   * Helper to capture a remote blob that genuinely decrypts under the same Master Key.
   */
  async function captureRemoteBlob(
    handle: Awaited<ReturnType<typeof setupHandle>>,
    payload: unknown,
    type: VaultBlobType = VaultBlobType.Tasks,
  ): Promise<ServerVaultBlob> {
    const vault = handle.loadVault();
    if (!vault) throw new Error('Handle has no vault');
    const originalData = { ...vault.data };

    const envelope: VaultBlobEnvelope<unknown> = {
      records: payload,
      deletions: {},
    };
    const field = VAULT_BLOB_FIELDS[type];
    await handle.saveEncryptedData({ type: field, value: envelope });

    const encryptedBlob = handle.loadVault()?.data[field];
    if (!encryptedBlob) {
      throw new Error(`Failed to save test blob for type ${type}`);
    }

    vault.data = originalData;
    handle.saveVault(vault);

    return {
      etag: 'etag-remote',
      updatedAt: '2026-01-01T00:00:00.000Z',
      type,
      blob: toEncryptedBlobV1(encryptedBlob),
    };
  }

  /**
   * Helper to make an undecryptable remote blob (encrypted under different Master Key).
   */
  async function makeUndecryptableRemote(
    type: VaultBlobType = VaultBlobType.Tasks,
  ): Promise<ServerVaultBlob> {
    const otherHandle = createVaultHandle({ owner: 'user-other' });
    await otherHandle.initialize({ passphrase: 'other key 2026' });
    await otherHandle.unlockWithPassphrase({
      passphrase: 'other key 2026',
    });

    const envelope: VaultBlobEnvelope<unknown> = {
      records: [],
      deletions: {},
    };
    const field = VAULT_BLOB_FIELDS[type];
    await otherHandle.saveEncryptedData({ type: field, value: envelope });
    const encryptedBlob = otherHandle.loadVault()?.data[field];
    if (!encryptedBlob) {
      throw new Error('Failed to create undecryptable blob');
    }

    return {
      etag: 'etag-undecryptable',
      updatedAt: '2026-01-01T00:00:00.000Z',
      type,
      blob: toEncryptedBlobV1(encryptedBlob),
    };
  }

  // ===== Core flows =====

  test('no-ops when neither local nor server vault exists', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);

    const handle = emptyHandle('user-1');

    const result = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result).toEqual({ kind: 'noop-nothing-to-reconcile' });
    expect(serverVaultSync.getServerVaultBlob).not.toHaveBeenCalled();
    expect(serverVaultSync.putServerVaultMetaEtagAware).not.toHaveBeenCalled();
  });

  test('skips when unauthenticated (401) on meta read', async () => {
    const error = Object.assign(new Error('unauth'), {
      response: { status: 401 },
    });
    serverVaultSync.getServerVaultMeta.mockRejectedValue(error);

    const handle = await setupHandle('user-1');

    const result = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result).toEqual({ kind: 'skipped-not-authenticated' });
  });

  test('skips when forbidden (403) on meta read', async () => {
    const error = Object.assign(new Error('forbidden'), {
      response: { status: 403 },
    });
    serverVaultSync.getServerVaultMeta.mockRejectedValue(error);

    const handle = await setupHandle('user-1');

    const result = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result).toEqual({ kind: 'skipped-not-authenticated' });
  });

  test('downloads server wrapping when local vault missing', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    const serverTasks: ServerVaultBlob = {
      etag: 'etag-server-tasks',
      updatedAt: '2026-01-01T00:00:00.000Z',
      type: VaultBlobType.Tasks,
      blob: { version: 1, iv: 'server-iv', ciphertext: 'server-ct' },
    };

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) =>
        type === VaultBlobType.Tasks ? serverTasks : null,
    );

    const handle = emptyHandle('user-1');

    const result = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      expect(result.start).toBe('downloaded-server-wrapping');
      expect(result.converged).toHaveLength(VAULT_BLOB_TYPES.length);
    }

    // The wrapping came from the server's Vault Meta, and the Ciphertext came
    // through the primitive — a download that lands the wrapping and drops the
    // data is what #512 looked like.
    const vault = handle.loadVault();
    expect(vault).not.toBeNull();
    expect(vault?.data.tasks).toEqual(
      serverEncryptedBlobToLocal(serverTasks.blob),
    );
  });

  test('uploads local wrapping when server vault missing', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);
    serverVaultSync.putServerVaultMetaEtagAware.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });
    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    const handle = await setupHandle('user-1', []);

    const result = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      expect(result.start).toBe('uploaded-local-wrapping');
    }

    expect(serverVaultSync.putServerVaultMetaEtagAware).toHaveBeenCalledTimes(
      1,
    );
  });

  test('identical vaults prompt nothing and remain in sync', async () => {
    const handle1 = await setupHandle('user-1', []);
    const remoteBlob = remoteFromLocal(handle1);
    await handle1.recordPushSuccess({ type: 'tasks', etag: remoteBlob.etag });

    const serverMeta = localToServerMeta(handle1.loadVault()!);
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (api: unknown, type: VaultBlobType) => {
        if (type === remoteBlob.type) return remoteBlob;
        return null;
      },
    );

    const api = createApiDouble();
    const prompt = jest.fn();

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle: handle1,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      expect(result.deferred).toBe(false);
    }
    expect(prompt).not.toHaveBeenCalled();
    // Nothing to do means nothing written — on either side, Ciphertext or
    // wrapping.
    expect(api.putVaultBlob).not.toHaveBeenCalled();
    expect(serverVaultSync.putServerVaultMetaEtagAware).not.toHaveBeenCalled();
  });

  test('non-conflicting divergence converges by merge without prompt', async () => {
    const api = createApiDouble();

    const handle = await setupHandle('user-1', [
      {
        id: 'local-1',
        title: 'Local task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const localVault = handle.loadVault();
    if (!localVault?.data.tasks) throw new Error('Setup failed');

    const remoteBlob = await captureRemoteBlob(handle, [
      {
        id: 'remote-1',
        title: 'Remote task',
        status: 'in-progress',
        priority: 'low',
        archived: false,
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const serverMeta = localToServerMeta(handle.loadVault()!);
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Tasks) return remoteBlob;
        return null;
      },
    );

    api.putVaultBlob.mockImplementation(async () => {
      return axiosResponse({
        ok: true,
        etag: 'etag-merged',
        updatedAt: '2026-01-03T00:00:00.000Z',
        message: 'OK',
      });
    });

    const prompt = jest.fn();

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      const tasksOutcome = result.converged.find(
        (c) => c.type === VaultBlobType.Tasks,
      );
      expect(tasksOutcome?.outcome.kind).toBe('merged');
    }
    expect(prompt).not.toHaveBeenCalled();
  });

  test('Groceries conflict prompts due to promptOnConflict strategy', async () => {
    const api = createApiDouble();

    const handle = await setupHandle(
      'user-1',
      [{ id: 'cat1' }],
      VaultBlobType.Groceries,
    );

    const remoteBlob = await captureRemoteBlob(
      handle,
      [{ id: 'remote-cat' }],
      VaultBlobType.Groceries,
    );

    const serverMeta = localToServerMeta(handle.loadVault()!);
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    const promptAsks: VaultReconcileAsk[] = [];
    const prompt = jest.fn<
      Promise<VaultReconcileDecision>,
      [VaultReconcileAsk]
    >();
    prompt.mockImplementation(async (ask: VaultReconcileAsk) => {
      promptAsks.push(ask);
      return 'keep-local';
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Groceries) return remoteBlob;
        return null;
      },
    );

    api.putVaultBlob.mockImplementation(async () => {
      return axiosResponse({
        ok: true,
        etag: 'etag-sent',
        updatedAt: '2026-01-03T00:00:00.000Z',
        message: 'OK',
      });
    });

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    // A conflict answered on this device moves Ciphertext and never the
    // wrapping (ADR 0057).
    expect(serverVaultSync.putServerVaultMetaEtagAware).not.toHaveBeenCalled();
    expect(promptAsks.length).toBeGreaterThan(0);
    const groceriesAsk = promptAsks.find(
      (ask) =>
        ask.kind === 'blob' &&
        ask.type === VaultBlobType.Groceries &&
        ask.reason === 'strategy',
    );
    expect(groceriesAsk).toBeDefined();
  });

  test('meta-divergence alone (same ciphertext, different wrapping) prompts nothing (ADR 0057)', async () => {
    const handle = await setupHandle('user-1', []);
    await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-tasks' });

    const remoteBlob = await captureRemoteBlob(
      await setupHandle('user-1', []),
      [],
    );

    // Server meta with same Vault Identity (same salt) but different wrapping
    const localMeta = localToServerMeta(handle.loadVault()!);
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: {
        ...localMeta,
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'different-iv',
          ciphertext: 'different-ct',
        },
      },
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === remoteBlob.type) return remoteBlob;
        return null;
      },
    );

    const prompt = jest.fn();

    const result = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    expect(prompt).not.toHaveBeenCalled();
  });

  test('whole-vault ask when remote Ciphertext undecryptable (genuine Master Key mismatch)', async () => {
    const api = createApiDouble();

    const handle = await setupHandle('user-1', [
      {
        id: 'task-1',
        title: 'Local task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const undecryptableBlob = await makeUndecryptableRemote();

    const serverMeta = localToServerMeta(handle.loadVault()!);
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    const promptAsks: VaultReconcileAsk[] = [];
    const prompt = jest.fn<
      Promise<VaultReconcileDecision>,
      [VaultReconcileAsk]
    >();
    prompt.mockImplementation(async (ask: VaultReconcileAsk) => {
      promptAsks.push(ask);
      return 'keep-local';
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Tasks) return undecryptableBlob;
        return null;
      },
    );

    api.putVaultBlob.mockImplementation(async () => {
      return axiosResponse({
        ok: true,
        etag: 'etag-sent',
        updatedAt: '2026-01-03T00:00:00.000Z',
        message: 'OK',
      });
    });

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');

    const wholeVaultAsk = promptAsks.find((ask) => ask.kind === 'vault');
    expect(wholeVaultAsk).toBeDefined();
    expect(wholeVaultAsk).toEqual({ kind: 'vault' });
  });

  test('deferred answer records deferred flag and writes nothing', async () => {
    const api = createApiDouble();

    // Groceries, because deferring is only reachable where something asks —
    // and what asks is what the pinned strategy table says asks.
    const handle = await setupHandle(
      'user-1',
      [{ id: 'cat1' }],
      VaultBlobType.Groceries,
    );
    const localBefore = handle.loadVault()?.data.groceries;

    const remoteBlob = await captureRemoteBlob(
      handle,
      [{ id: 'remote-cat' }],
      VaultBlobType.Groceries,
    );

    const serverMeta = localToServerMeta(handle.loadVault()!);
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    const prompt = jest.fn<
      Promise<VaultReconcileDecision>,
      [VaultReconcileAsk]
    >();
    prompt.mockImplementation(async () => 'defer');

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Groceries) return remoteBlob;
        return null;
      },
    );

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(prompt).toHaveBeenCalled();
    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      expect(result.deferred).toBe(true);
    }

    // Nothing written on either side, so the choice survives to be made
    // again (ADR 0033).
    expect(api.putVaultBlob).not.toHaveBeenCalled();
    expect(handle.loadVault()?.data.groceries).toEqual(localBefore);
  });

  test('skips when auth error mid-loop', async () => {
    const error = Object.assign(new Error('unauth'), {
      response: { status: 401 },
    });

    const handle = await setupHandle('user-1', []);

    // This Vault's own identity, so the loop converges its way to the third
    // type rather than refusing each one before the error can be reached.
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: localToServerMeta(handle.loadVault()!),
    });

    let callCount = 0;
    serverVaultSync.getServerVaultBlob.mockImplementation(async () => {
      callCount++;
      if (callCount === 3) {
        throw error;
      }
      return null;
    });

    const result = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result).toEqual({ kind: 'skipped-not-authenticated' });
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test('rethrows non-auth error during loop', async () => {
    const error = new Error('network error');

    const handle = await setupHandle('user-1', []);

    // This Vault's own identity — see the note in the auth-error test above.
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: localToServerMeta(handle.loadVault()!),
    });

    let callCount = 0;
    serverVaultSync.getServerVaultBlob.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw error;
      }
      return null;
    });

    await expect(
      reconcileVaultWithServer({
        api: createApiDouble() as unknown as ApiParam,
        handle,
        prompt: jest.fn(),
      }),
    ).rejects.toThrow('network error');
  });

  test('all VAULT_BLOB_TYPES are reached in order', async () => {
    const handle = await setupHandle('user-1', []);

    // The server's Vault Meta has to be *this* Vault's. A pinned salt is a
    // different Vault Identity, and every type would refuse before converging
    // — leaving this test asserting only that the loop iterates, which is not
    // what it was written to guard (ADR 0067).
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: localToServerMeta(handle.loadVault()!),
    });

    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    const result = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      expect(result.converged).toHaveLength(VAULT_BLOB_TYPES.length);
      result.converged.forEach((entry, index) => {
        expect(entry.type).toBe(VAULT_BLOB_TYPES[index]);
      });

      // Every type was actually converged, not refused before it got there.
      expect(
        result.converged.filter((entry) => entry.outcome.kind === 'refused'),
      ).toEqual([]);

      // #512 in one line: the types reconcile reaches are every member of the
      // API contract's enum, not the subset some table happens to carry.
      expect(new Set(result.converged.map((entry) => entry.type))).toEqual(
        new Set(Object.values(VaultBlobType)),
      );
    }
  });

  test('calls handle.saveVault when downloading server wrapping', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    const handle = emptyHandle('user-1');

    expect(handle.loadVault()).toBeNull();

    await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    const vault = handle.loadVault();
    expect(vault).not.toBeNull();
  });

  test('calls putServerVaultMetaEtagAware once when uploading local wrapping', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);
    serverVaultSync.putServerVaultMetaEtagAware.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    const handle = await setupHandle('user-1', []);

    await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(serverVaultSync.putServerVaultMetaEtagAware).toHaveBeenCalledTimes(
      1,
    );

    const [callArgs] =
      serverVaultSync.putServerVaultMetaEtagAware.mock.calls[0];
    expect(callArgs.api).toBeDefined();
    expect(callArgs.meta).toBeDefined();
  });

  test('whole-vault ask memoized across multiple undecryptable-remote types', async () => {
    const api = createApiDouble();

    const handle = await setupHandle('user-1', [
      {
        id: 'task-1',
        title: 'Local task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    // Create an undecryptable blob (different Master Key)
    const undecryptableBlob = await makeUndecryptableRemote();

    const serverMeta = localToServerMeta(handle.loadVault()!);
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    let promptCallCount = 0;
    const prompt = jest.fn<
      Promise<VaultReconcileDecision>,
      [VaultReconcileAsk]
    >();
    prompt.mockImplementation(async (ask: VaultReconcileAsk) => {
      if (ask.kind === 'vault') {
        promptCallCount++;
      }
      return 'keep-local';
    });

    // Return same undecryptable blob for multiple types to trigger multiple undecryptable-remote asks
    serverVaultSync.getServerVaultBlob.mockResolvedValue(undecryptableBlob);

    api.putVaultBlob.mockImplementation(async () => {
      return axiosResponse({
        ok: true,
        etag: 'etag-sent',
        updatedAt: '2026-01-03T00:00:00.000Z',
        message: 'OK',
      });
    });

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    // Whole-vault ask should be called exactly once despite multiple types being undecryptable
    expect(promptCallCount).toBe(1);
  });

  // Was written with a server meta whose salt and passphrase wrapping both
  // differed, to show a blob decision never touches the wrapping. That exact
  // scenario is now a refusal (ADR 0067), so the wrapping claim is asserted
  // here for a merge and in R1 for a refusal — the two paths a blob decision
  // can now take. Either way no wrapping moves, which is ADR 0057's point.
  test('a merge leaves the wrapping untouched (ADR 0057)', async () => {
    const api = createApiDouble();

    const handle = await setupHandle('user-1', [
      {
        id: 'task-1',
        title: 'Local task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    // Capture original wrapping
    const originalVault = handle.loadVault();
    if (!originalVault) throw new Error('Setup failed');
    const originalKdf = originalVault.kdf;
    const originalPassphraseWrapped =
      originalVault.masterKeyWrappedWithPassphrase;
    const originalRecoveryWrapped =
      originalVault.masterKeyWrappedWithRecoveryKey;

    // Capture a remote blob with different data
    const remoteBlob = await captureRemoteBlob(handle, [
      {
        id: 'remote-1',
        title: 'Remote task',
        status: 'done',
        priority: 'low',
        archived: false,
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    // Server meta with same Vault Identity
    const localMeta = localToServerMeta(handle.loadVault()!);
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: localMeta,
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Tasks) return remoteBlob;
        return null;
      },
    );

    const prompt = jest.fn<
      Promise<VaultReconcileDecision>,
      [VaultReconcileAsk]
    >();
    prompt.mockImplementation(async () => 'keep-remote');

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');

    // The remote decrypts under this Master Key and Tasks merges by record,
    // so nothing is asked — the queued answer is never consumed. Stated so
    // the test cannot drift back into claiming it exercises `keep-remote`.
    expect(prompt).not.toHaveBeenCalled();

    // Verify wrapping is unchanged
    const finalVault = handle.loadVault();
    if (!finalVault) throw new Error('Vault lost');
    expect(finalVault.kdf).toEqual(originalKdf);
    expect(finalVault.masterKeyWrappedWithPassphrase).toEqual(
      originalPassphraseWrapped,
    );
    expect(finalVault.masterKeyWrappedWithRecoveryKey).toEqual(
      originalRecoveryWrapped,
    );

    // The key assertion: the wrapping did not change, even though we answered "keep-remote"
    expect(serverVaultSync.putServerVaultMetaEtagAware).not.toHaveBeenCalled();
  });

  test('Todos (second promptOnConflict type) prompts on conflict', async () => {
    const api = createApiDouble();

    const handle = await setupHandle('user-1', [], 'groceries');
    // Save some groceries data to create a non-todos vault initially
    await handle.recordPushSuccess({
      type: 'groceries',
      etag: 'etag-groc',
    });

    // Manually save todos data to setup both having local todos
    const todosEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'todo-1', text: 'Local todo' }],
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'todos', value: todosEnvelope });

    const remoteTodosBlob = await captureRemoteBlob(
      handle,
      [{ id: 'todo-2', text: 'Remote todo' }],
      VaultBlobType.Todos,
    );

    const serverMeta = localToServerMeta(handle.loadVault()!);
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    const promptAsks: VaultReconcileAsk[] = [];
    const prompt = jest.fn<
      Promise<VaultReconcileDecision>,
      [VaultReconcileAsk]
    >();
    prompt.mockImplementation(async (ask: VaultReconcileAsk) => {
      promptAsks.push(ask);
      return 'keep-local';
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Todos) return remoteTodosBlob;
        return null;
      },
    );

    api.putVaultBlob.mockImplementation(async () => {
      return axiosResponse({
        ok: true,
        etag: 'etag-sent',
        updatedAt: '2026-01-03T00:00:00.000Z',
        message: 'OK',
      });
    });

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    const todosAsk = promptAsks.find(
      (ask) =>
        ask.kind === 'blob' &&
        ask.type === VaultBlobType.Todos &&
        ask.reason === 'strategy',
    );
    expect(todosAsk).toBeDefined();
  });

  test('downloaded-server-wrapping records sync bookmark for each type', async () => {
    const remoteHandle = await setupHandle('user-2', [
      {
        id: 'task-1',
        title: 'Remote task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const remoteBlob = remoteFromLocal(remoteHandle);
    const remoteVaultMeta = localToServerMeta(remoteHandle.loadVault()!);

    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: remoteVaultMeta,
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === remoteBlob.type) return remoteBlob;
        return null;
      },
    );

    const handle = emptyHandle('user-1');

    // First reconcile: download wrapping
    const result1 = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result1.kind).toBe('reconciled');
    if (result1.kind === 'reconciled') {
      expect(result1.start).toBe('downloaded-server-wrapping');
    }

    // Reset mocks and simulate second reconcile
    jest.clearAllMocks();
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: remoteVaultMeta,
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === remoteBlob.type) return remoteBlob;
        return null;
      },
    );

    const prompt = jest.fn();

    // Second reconcile: should find everything in-sync because bookmarks were recorded
    const result2 = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result2.kind).toBe('reconciled');
    if (result2.kind === 'reconciled') {
      // Should not prompt because blobs are in-sync via bookmarks
      result2.converged.forEach(({ outcome }) => {
        if (outcome.kind === 'nothing') {
          expect(outcome.reason).toBe('in-sync');
        }
      });
    }
    expect(prompt).not.toHaveBeenCalled();
  });

  test('first sync against empty server puts every blob type local vault carries (#512)', async () => {
    const api = createApiDouble();

    // Create a local vault with both Tasks and Groceries data
    const handle = await setupHandle('user-1', [
      {
        id: 'task-1',
        title: 'Local task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    // Also add groceries
    const groceriesEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'groc-1', name: 'Milk' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'groceries',
      value: groceriesEnvelope,
    });

    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);
    serverVaultSync.putServerVaultMetaEtagAware.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    const putCalls: VaultBlobType[] = [];
    api.putVaultBlob.mockImplementation(async (options) => {
      putCalls.push(options.type);
      return axiosResponse({
        ok: true,
        etag: `etag-${options.type}`,
        updatedAt: '2026-01-01T00:00:00.000Z',
        message: 'OK',
      });
    });

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      expect(result.start).toBe('uploaded-local-wrapping');
    }

    // Regression test for #512: verify both Tasks and Groceries were uploaded
    // (Groceries was missing from some directions in the hand-written reconcile)
    expect(putCalls).toContain(VaultBlobType.Tasks);
    expect(putCalls).toContain(VaultBlobType.Groceries);
  });

  // ===== Different-Vault Identity Refusal Tests (ADR 0067) =====

  test('different vault identity refuses all types without prompting', async () => {
    const api = createApiDouble();

    const handle = await setupHandle('user-1', [
      {
        id: 'task-1',
        title: 'Local task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const localVaultBefore = handle.loadVault();
    if (!localVaultBefore) throw new Error('Setup failed');
    const localTasksBefore = localVaultBefore.data.tasks;

    // Create a server meta with a different vault identity (different salt)
    const differentVaultHandle = createVaultHandle({ owner: 'user-2' });
    await differentVaultHandle.initialize({ passphrase: 'different key' });
    const differentVaultMeta = localToServerMeta(
      differentVaultHandle.loadVault()!,
    );

    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: differentVaultMeta,
    });

    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    const prompt = jest.fn();

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      // Every type should be refused with 'different-vault' reason
      result.converged.forEach((entry) => {
        expect(entry.outcome).toEqual({
          kind: 'refused',
          reason: 'different-vault',
        });
      });
    }

    // No prompt should be called (ADR 0067 decision 5)
    expect(prompt).not.toHaveBeenCalled();

    // No putVaultBlob should be called
    expect(api.putVaultBlob).not.toHaveBeenCalled();

    // Local Vault ciphertext should be byte-identical
    const localVaultAfter = handle.loadVault();
    expect(localVaultAfter?.data.tasks).toEqual(localTasksBefore);

    // And so is the wrapping. A refusal is a blob decision like any other, so
    // it may not move a wrapping either — the other half of the claim the
    // merge test above carries (ADR 0057).
    expect(localVaultAfter?.kdf).toEqual(localVaultBefore?.kdf);
    expect(localVaultAfter?.masterKeyWrappedWithPassphrase).toEqual(
      localVaultBefore?.masterKeyWrappedWithPassphrase,
    );
    expect(localVaultAfter?.masterKeyWrappedWithRecoveryKey).toEqual(
      localVaultBefore?.masterKeyWrappedWithRecoveryKey,
    );

    // No sync bookmark should be advanced
    expect(handle.lastPushedEtag('tasks')).toBeUndefined();
  });

  test('identical vault identity converges as before', async () => {
    const handle = await setupHandle('user-1', []);
    const remoteBlob = remoteFromLocal(handle);
    await handle.recordPushSuccess({ type: 'tasks', etag: remoteBlob.etag });

    const serverMeta = localToServerMeta(handle.loadVault()!);

    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (api: unknown, type: VaultBlobType) => {
        if (type === remoteBlob.type) return remoteBlob;
        return null;
      },
    );

    const api = createApiDouble();
    const prompt = jest.fn();

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      expect(result.deferred).toBe(false);

      // The assertions that actually carry this test. "Nothing was written"
      // is equally true of a pass that refused every type, so a guard that
      // refused unconditionally would satisfy the three below and still close
      // #571 while breaking all convergence. Naming the outcomes is the only
      // thing that catches it: Tasks converged and agreed, and no type was
      // refused.
      const tasks = result.converged.find(
        (entry) => entry.type === remoteBlob.type,
      );
      expect(tasks?.outcome).toEqual({ kind: 'nothing', reason: 'in-sync' });
      expect(
        result.converged.filter((entry) => entry.outcome.kind === 'refused'),
      ).toEqual([]);
    }
    expect(prompt).not.toHaveBeenCalled();
    expect(api.putVaultBlob).not.toHaveBeenCalled();
  });

  test('getServerVaultMeta called once per pass, not once per type', async () => {
    const api = createApiDouble();

    const handle = await setupHandle('user-1', [
      {
        id: 'task-1',
        title: 'Local task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    // Add groceries too
    const groceriesEnvelope: VaultBlobEnvelope<unknown> = {
      records: [{ id: 'groc-1', name: 'Milk' }],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: 'groceries',
      value: groceriesEnvelope,
    });

    const serverMeta = localToServerMeta(handle.loadVault()!);

    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result.kind).toBe('reconciled');

    // Should be called exactly once for the whole pass
    expect(serverVaultSync.getServerVaultMeta).toHaveBeenCalledTimes(1);
  });

  test('downloaded-server-wrapping with matching identity converges normally', async () => {
    const remoteHandle = await setupHandle('user-2', [
      {
        id: 'remote-task',
        title: 'Remote task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const remoteBlob = remoteFromLocal(remoteHandle);
    const serverMeta = localToServerMeta(remoteHandle.loadVault()!);

    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: serverMeta,
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === remoteBlob.type) return remoteBlob;
        return null;
      },
    );

    const handle = emptyHandle('user-1');

    const result = await reconcileVaultWithServer({
      api: createApiDouble() as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      expect(result.start).toBe('downloaded-server-wrapping');
      // The Local Vault was written from the server's meta, so identity matches
      // and every type takes as before (not refused)
      const tasksOutcome = result.converged.find(
        (c) => c.type === VaultBlobType.Tasks,
      );
      expect(tasksOutcome?.outcome.kind).not.toBe('refused');
    }

    // Ciphertext should be downloaded
    const vault = handle.loadVault();
    expect(vault?.data.tasks).toEqual(
      serverEncryptedBlobToLocal(remoteBlob.blob),
    );
  });

  test('uploaded-local-wrapping with null serverMeta converges normally', async () => {
    const api = createApiDouble();

    const handle = await setupHandle('user-1', [
      {
        id: 'task-1',
        title: 'Local task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);
    serverVaultSync.putServerVaultMetaEtagAware.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: localToServerMeta(handle.loadVault()!),
    });
    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    api.putVaultBlob.mockImplementation(async () =>
      axiosResponse({
        ok: true,
        etag: 'etag-sent',
        updatedAt: '2026-01-03T00:00:00.000Z',
        message: 'OK',
      }),
    );

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt: jest.fn(),
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      expect(result.start).toBe('uploaded-local-wrapping');
      // serverMeta was null, so nothing is refused — everything converges
      result.converged.forEach((entry) => {
        expect(entry.outcome.kind).not.toBe('refused');
      });
    }

    // Local data should be sent
    expect(api.putVaultBlob).toHaveBeenCalled();
  });

  test('uploaded-local-wrapping race with kept-remote refuses if different vault', async () => {
    const api = createApiDouble();

    const handle = await setupHandle('user-1', [
      {
        id: 'task-1',
        title: 'Local task',
        status: 'todo',
        priority: 'high',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const localVaultBefore = handle.loadVault();
    if (!localVaultBefore) throw new Error('Setup failed');
    const localTasksBefore = localVaultBefore.data.tasks;

    // Create a different vault's meta
    const differentVaultHandle = createVaultHandle({ owner: 'user-2' });
    await differentVaultHandle.initialize({ passphrase: 'different key' });
    const differentVaultMeta = localToServerMeta(
      differentVaultHandle.loadVault()!,
    );

    // First call returns null (no server meta), then putVaultMetaEtagAware
    // returns kept-remote with a different vault's meta (simulating the race)
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);
    // Exactly the `kept-remote` union member and nothing more — it carries
    // `kind` and `remote` only (serverVaultSync.ts). Extra top-level fields
    // would suggest reconcile could read `put.meta`, which the type forbids.
    serverVaultSync.putServerVaultMetaEtagAware.mockResolvedValue({
      kind: 'kept-remote',
      remote: {
        etag: 'e1',
        updatedAt: 't1',
        meta: differentVaultMeta,
      },
    });

    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    const prompt = jest.fn();

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      // The pass should have adopted the kept-remote meta as its observation,
      // and since it's different, every type should be refused
      result.converged.forEach((entry) => {
        expect(entry.outcome).toEqual({
          kind: 'refused',
          reason: 'different-vault',
        });
      });
    }

    // No prompt
    expect(prompt).not.toHaveBeenCalled();

    // No putVaultBlob
    expect(api.putVaultBlob).not.toHaveBeenCalled();

    // Local ciphertext unchanged
    const localVaultAfter = handle.loadVault();
    expect(localVaultAfter?.data.tasks).toEqual(localTasksBefore);
  });

  test('locked vault with different identity refuses', async () => {
    const api = createApiDouble();

    // Create a handle, initialize it with some data, but do NOT unlock it
    // This keeps it in the locked state (isUnlocked = false)
    const handle = createVaultHandle({ owner: 'user-1' });
    await handle.initialize({ passphrase });

    // Save some encrypted data while we have the derived key from initialize
    await handle.unlockWithPassphrase({ passphrase });
    const envelope: VaultBlobEnvelope<unknown> = {
      records: [
        {
          id: 'task-1',
          title: 'Local task',
          status: 'todo',
          priority: 'high',
          archived: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      deletions: {},
    };
    await handle.saveEncryptedData({
      type: VAULT_BLOB_FIELDS[VaultBlobType.Tasks],
      value: envelope,
    });

    const localVaultBefore = handle.loadVault();
    if (!localVaultBefore) throw new Error('Setup failed');
    const localTasksBefore = localVaultBefore.data.tasks;

    // A fresh handle over the same Local Vault is locked: the record stays in
    // storage and no Master Key is bound to this instance.
    const lockedHandle = createVaultHandle({ owner: 'user-1' });
    expect(lockedHandle.isUnlocked).toBe(false);

    // Different vault identity
    const differentVaultHandle = createVaultHandle({ owner: 'user-2' });
    await differentVaultHandle.initialize({ passphrase: 'different key' });
    const differentVaultMeta = localToServerMeta(
      differentVaultHandle.loadVault()!,
    );

    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: differentVaultMeta,
    });

    serverVaultSync.getServerVaultBlob.mockResolvedValue(null);

    const prompt = jest.fn();

    const result = await reconcileVaultWithServer({
      api: api as unknown as ApiParam,
      handle: lockedHandle,
      prompt,
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind === 'reconciled') {
      // Should still refuse (identity check needs no Master Key)
      result.converged.forEach((entry) => {
        expect(entry.outcome).toEqual({
          kind: 'refused',
          reason: 'different-vault',
        });
      });
    }

    // No prompt (locked convergence never reaches the point of asking)
    expect(prompt).not.toHaveBeenCalled();

    // Local ciphertext unchanged
    const localVaultAfter = lockedHandle.loadVault();
    expect(localVaultAfter?.data.tasks).toEqual(localTasksBefore);
  });
});
