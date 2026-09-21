import {
  EncryptedBlobV1,
  VaultBlobType,
  VaultMetaV1,
} from '@myorganizer/app-api-client';
import {
  checkServerVaultBlobInventory,
  getServerVaultBlob,
  getServerVaultMeta,
  putServerVaultBlobEtagAware,
  putServerVaultMetaEtagAware,
  readVaultBlobInventoryEtags,
  vaultBlobInventoryFetchDecision,
} from './serverVaultSync';

type ApiForGetMeta = Parameters<typeof getServerVaultMeta>[0];
type ApiForPutMeta = Parameters<typeof putServerVaultMetaEtagAware>[0]['api'];
type ApiForGetBlob = Parameters<typeof getServerVaultBlob>[0];
type ApiForPutBlob = Parameters<typeof putServerVaultBlobEtagAware>[0]['api'];

function makeMeta(overrides: Partial<VaultMetaV1> = {}): VaultMetaV1 {
  return {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt: 'salt',
    kdf_params: { iterations: 1, hash: 'SHA-256' },
    wrapped_mk_passphrase: { iv: 'iv', ciphertext: 'ct' },
    wrapped_mk_recovery: { iv: 'iv', ciphertext: 'ct' },
    ...overrides,
  };
}

function makeBlob(overrides: Partial<EncryptedBlobV1> = {}): EncryptedBlobV1 {
  return { version: 1, iv: 'iv', ciphertext: 'ciphertext', ...overrides };
}

function httpError(status: number): Error & { response: { status: number } } {
  const error = new Error(`HTTP ${status}`) as Error & {
    response?: { status: number };
  };
  error.response = { status };
  return error as Error & { response: { status: number } };
}

describe('serverVaultSync', () => {
  test('getServerVaultMeta returns meta on success', async () => {
    const api = {
      getVaultMeta: jest.fn().mockResolvedValue({
        data: { etag: 'e1', updatedAt: 't1', meta: makeMeta() },
      }),
    } as unknown as ApiForGetMeta;

    await expect(getServerVaultMeta(api)).resolves.toEqual({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeMeta(),
    });
  });

  test('getServerVaultMeta returns null on 404', async () => {
    const api = {
      getVaultMeta: jest.fn().mockRejectedValue(httpError(404)),
    } as unknown as ApiForGetMeta;

    await expect(getServerVaultMeta(api)).resolves.toBeNull();
  });

  test('putServerVaultMetaEtagAware uses If-Match and returns updated', async () => {
    const api = {
      putVaultMeta: jest.fn().mockResolvedValue({
        data: { ok: true, etag: 'e2', updatedAt: 't2', message: 'ok' },
      }),
    } as unknown as ApiForPutMeta;

    const result = await putServerVaultMetaEtagAware({
      api,
      meta: makeMeta(),
      ifMatch: 'e1',
      // Required since the default was removed; never reached on this path,
      // which resolves without a 409.
      onConflict: () => 'keep-remote',
    });

    expect(api.putVaultMeta).toHaveBeenCalledWith({
      putVaultMetaRequest: { meta: makeMeta() },
      ifMatch: 'e1',
    });

    expect(result).toEqual({ kind: 'updated', etag: 'e2', updatedAt: 't2' });
  });

  test('putServerVaultMetaEtagAware on 409 can keep remote', async () => {
    const api = {
      putVaultMeta: jest.fn().mockRejectedValue(httpError(409)),
      getVaultMeta: jest.fn().mockResolvedValue({
        data: { etag: 'remote-etag', updatedAt: 'rt', meta: makeMeta() },
      }),
    } as unknown as ApiForPutMeta;

    const result = await putServerVaultMetaEtagAware({
      api,
      meta: makeMeta({ kdf_salt: 'local' }),
      ifMatch: 'local-etag',
      onConflict: async () => 'keep-remote' as const,
    });

    expect(result.kind).toBe('kept-remote');
    if (result.kind === 'kept-remote') {
      expect(result.remote.etag).toBe('remote-etag');
    }
  });

  test('putServerVaultMetaEtagAware on 409 can keep local (retry with remote etag)', async () => {
    const api = {
      putVaultMeta: jest.fn().mockImplementation(async (args) => {
        if (args?.ifMatch === 'local-etag') {
          throw httpError(409);
        }
        if (args?.ifMatch === 'remote-etag') {
          return {
            data: {
              ok: true,
              etag: 'new-etag',
              updatedAt: 't3',
              message: 'ok',
            },
          };
        }
        throw new Error(`Unexpected ifMatch argument: ${args?.ifMatch}`);
      }),
      getVaultMeta: jest.fn().mockResolvedValue({
        data: { etag: 'remote-etag', updatedAt: 'rt', meta: makeMeta() },
      }),
    } as unknown as ApiForPutMeta;

    const meta = makeMeta({ kdf_salt: 'local' });

    const result = await putServerVaultMetaEtagAware({
      api,
      meta,
      ifMatch: 'local-etag',
      onConflict: async () => 'keep-local' as const,
    });

    expect(api.putVaultMeta).toHaveBeenNthCalledWith(1, {
      putVaultMetaRequest: { meta },
      ifMatch: 'local-etag',
    });

    expect(api.putVaultMeta).toHaveBeenNthCalledWith(2, {
      putVaultMetaRequest: { meta },
      ifMatch: 'remote-etag',
    });

    expect(result).toEqual({
      kind: 'updated',
      etag: 'new-etag',
      updatedAt: 't3',
    });
  });

  test('getServerVaultBlob returns null on 404', async () => {
    const api = {
      getVaultBlob: jest.fn().mockRejectedValue(httpError(404)),
    } as unknown as ApiForGetBlob;

    await expect(
      getServerVaultBlob(api, VaultBlobType.Addresses),
    ).resolves.toBeNull();
  });

  test('putServerVaultBlobEtagAware on 409 can keep local (retry with remote etag)', async () => {
    const api = {
      putVaultBlob: jest.fn().mockImplementation(async (args) => {
        if (args?.ifMatch === 'local-etag') {
          throw httpError(409);
        }
        if (args?.ifMatch === 'remote-etag') {
          return {
            data: {
              ok: true,
              etag: 'new-etag',
              updatedAt: 't3',
              message: 'ok',
            },
          };
        }
        throw new Error(`Unexpected ifMatch argument: ${args?.ifMatch}`);
      }),
      getVaultBlob: jest.fn().mockResolvedValue({
        data: {
          etag: 'remote-etag',
          updatedAt: 'rt',
          type: VaultBlobType.Addresses,
          blob: makeBlob({ ciphertext: 'remote' }),
        },
      }),
    } as unknown as ApiForPutBlob;

    const blob = makeBlob({ ciphertext: 'local' });

    const result = await putServerVaultBlobEtagAware({
      api,
      type: VaultBlobType.Addresses,
      blob,
      ifMatch: 'local-etag',
      onConflict: async () => 'keep-local' as const,
    });

    expect(api.putVaultBlob).toHaveBeenNthCalledWith(1, {
      type: VaultBlobType.Addresses,
      putVaultBlobRequest: { type: VaultBlobType.Addresses, blob },
      ifMatch: 'local-etag',
    });

    expect(api.putVaultBlob).toHaveBeenNthCalledWith(2, {
      type: VaultBlobType.Addresses,
      putVaultBlobRequest: { type: VaultBlobType.Addresses, blob },
      ifMatch: 'remote-etag',
    });

    expect(result).toEqual({
      kind: 'updated',
      etag: 'new-etag',
      updatedAt: 't3',
    });
  });

  // ===== checkServerVaultBlobInventory tests =====

  describe('checkServerVaultBlobInventory', () => {
    type ApiForInventory = Parameters<typeof checkServerVaultBlobInventory>[0];

    test('200 response maps etag and blobs entries', async () => {
      const api = {
        getVaultBlobInventory: jest.fn().mockResolvedValue({
          data: {
            etag: 'inv-etag-v1',
            blobs: [
              {
                type: VaultBlobType.Tasks,
                etag: 'tasks-etag',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                type: VaultBlobType.Groceries,
                etag: 'groc-etag',
                updatedAt: '2026-01-02T00:00:00.000Z',
              },
            ],
          },
        }),
      } as unknown as ApiForInventory;

      const result = await checkServerVaultBlobInventory(api, undefined);

      expect(result.kind).toBe('inventory');
      if (result.kind === 'inventory') {
        expect(result.inventory.etag).toBe('inv-etag-v1');
        expect(result.inventory.blobs).toEqual([
          {
            type: VaultBlobType.Tasks,
            etag: 'tasks-etag',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            type: VaultBlobType.Groceries,
            etag: 'groc-etag',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ]);
      }
    });

    test('ifNoneMatch argument forwarded to getVaultBlobInventory', async () => {
      const api = {
        getVaultBlobInventory: jest.fn().mockResolvedValue({
          data: {
            etag: 'inv-etag-v2',
            blobs: [],
          },
        }),
      } as unknown as ApiForInventory;

      const passedEtag = 'prev-inventory-etag';
      await checkServerVaultBlobInventory(api, passedEtag);

      // The per-call request options carry the caller's AbortSignal, and every
      // read sends the same call shape whether or not there is one to send.
      expect(api.getVaultBlobInventory).toHaveBeenCalledWith(
        { ifNoneMatch: passedEtag },
        { signal: undefined },
      );
    });

    test('304 rejection returns not-modified', async () => {
      const api = {
        getVaultBlobInventory: jest.fn().mockRejectedValue(httpError(304)),
      } as unknown as ApiForInventory;

      const result = await checkServerVaultBlobInventory(api, 'some-etag');

      expect(result.kind).toBe('not-modified');
    });

    test('401 rejection re-thrown', async () => {
      const api = {
        getVaultBlobInventory: jest.fn().mockRejectedValue(httpError(401)),
      } as unknown as ApiForInventory;

      await expect(
        checkServerVaultBlobInventory(api, undefined),
      ).rejects.toThrow('HTTP 401');
    });

    test('500 rejection re-thrown', async () => {
      const api = {
        getVaultBlobInventory: jest.fn().mockRejectedValue(httpError(500)),
      } as unknown as ApiForInventory;

      await expect(
        checkServerVaultBlobInventory(api, undefined),
      ).rejects.toThrow('HTTP 500');
    });
  });

  describe('readVaultBlobInventoryEtags', () => {
    test('inventory check maps etag and blob etags into a Map', async () => {
      const result = await readVaultBlobInventoryEtags(
        Promise.resolve({
          kind: 'inventory',
          inventory: {
            etag: 'inv-1',
            blobs: [
              {
                type: VaultBlobType.Tasks,
                etag: 't1',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              {
                type: VaultBlobType.Groceries,
                etag: 'g1',
                updatedAt: '2026-01-02T00:00:00.000Z',
              },
            ],
          },
        }),
      );

      expect(result.kind).toBe('inventory');
      if (result.kind === 'inventory') {
        expect(result.etag).toBe('inv-1');
        expect(result.etags.size).toBe(2);
        expect(result.etags.get(VaultBlobType.Tasks)).toBe('t1');
        expect(result.etags.get(VaultBlobType.Groceries)).toBe('g1');
      }
    });

    test('inventory check with empty blobs yields an empty Map', async () => {
      const result = await readVaultBlobInventoryEtags(
        Promise.resolve({
          kind: 'inventory',
          inventory: {
            etag: 'inv-empty',
            blobs: [],
          },
        }),
      );

      expect(result.kind).toBe('inventory');
      if (result.kind === 'inventory') {
        expect(result.etag).toBe('inv-empty');
        expect(result.etags.size).toBe(0);
      }
    });

    test('not-modified check passes through', async () => {
      await expect(
        readVaultBlobInventoryEtags(Promise.resolve({ kind: 'not-modified' })),
      ).resolves.toEqual({ kind: 'not-modified' });
    });

    test('401 rejection is classified as unauthenticated', async () => {
      await expect(
        readVaultBlobInventoryEtags(Promise.reject(httpError(401))),
      ).resolves.toEqual({ kind: 'unauthenticated' });
    });

    test('403 rejection is classified as unauthenticated', async () => {
      await expect(
        readVaultBlobInventoryEtags(Promise.reject(httpError(403))),
      ).resolves.toEqual({ kind: 'unauthenticated' });
    });

    test('other HTTP rejection is classified as failed with the same error', async () => {
      const error = httpError(500);

      const result = await readVaultBlobInventoryEtags(Promise.reject(error));

      expect(result).toEqual({ kind: 'failed', error });
      if (result.kind === 'failed') {
        expect(result.error).toBe(error);
      }
    });

    test('non-HTTP rejection is classified as failed with the same error', async () => {
      const error = new Error('aborted');

      const result = await readVaultBlobInventoryEtags(Promise.reject(error));

      expect(result).toEqual({ kind: 'failed', error });
      if (result.kind === 'failed') {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('vaultBlobInventoryFetchDecision', () => {
    test('returns absent when type is missing from inventory', () => {
      const serverEtags = new Map<VaultBlobType, string>([
        [VaultBlobType.Groceries, 'g-etag'],
      ]);

      expect(
        vaultBlobInventoryFetchDecision({
          serverEtags,
          type: VaultBlobType.Tasks,
          bookmark: 'any-bookmark',
        }),
      ).toEqual({ kind: 'absent' });
    });

    test('returns absent when inventory map is empty', () => {
      expect(
        vaultBlobInventoryFetchDecision({
          serverEtags: new Map(),
          type: VaultBlobType.Tasks,
          bookmark: 'etag-1',
        }),
      ).toEqual({ kind: 'absent' });
    });

    test('returns unchanged when bookmark matches server etag', () => {
      const serverEtags = new Map<VaultBlobType, string>([
        [VaultBlobType.Tasks, 'etag-1'],
      ]);

      expect(
        vaultBlobInventoryFetchDecision({
          serverEtags,
          type: VaultBlobType.Tasks,
          bookmark: 'etag-1',
        }),
      ).toEqual({ kind: 'unchanged' });
    });

    test('returns fetch when bookmark is undefined', () => {
      const serverEtags = new Map<VaultBlobType, string>([
        [VaultBlobType.Tasks, 'etag-1'],
      ]);

      expect(
        vaultBlobInventoryFetchDecision({
          serverEtags,
          type: VaultBlobType.Tasks,
          bookmark: undefined,
        }),
      ).toEqual({ kind: 'fetch', serverEtag: 'etag-1' });
    });

    test('returns fetch when bookmark differs from server etag', () => {
      const serverEtags = new Map<VaultBlobType, string>([
        [VaultBlobType.Tasks, 'etag-2'],
      ]);

      expect(
        vaultBlobInventoryFetchDecision({
          serverEtags,
          type: VaultBlobType.Tasks,
          bookmark: 'etag-1',
        }),
      ).toEqual({ kind: 'fetch', serverEtag: 'etag-2' });
    });

    test('returns unchanged for matching type without consulting other types', () => {
      const serverEtags = new Map<VaultBlobType, string>([
        [VaultBlobType.Tasks, 'tasks-etag'],
        [VaultBlobType.Groceries, 'groceries-etag'],
      ]);

      expect(
        vaultBlobInventoryFetchDecision({
          serverEtags,
          type: VaultBlobType.Groceries,
          bookmark: 'groceries-etag',
        }),
      ).toEqual({ kind: 'unchanged' });
    });
  });
});
