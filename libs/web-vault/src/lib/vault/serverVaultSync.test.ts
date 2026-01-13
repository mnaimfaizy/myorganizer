import {
  EncryptedBlobV1,
  VaultBlobType,
  VaultMetaV1,
} from '@myorganizer/app-api-client';
import {
  getServerVaultBlob,
  getServerVaultMeta,
  putServerVaultBlobEtagAware,
  putServerVaultMetaEtagAware,
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
  return { iv: 'iv', ciphertext: 'ciphertext', ...overrides };
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
      onConflict: async () => 'keep-remote',
    });

    expect(result.kind).toBe('kept-remote');
    if (result.kind === 'kept-remote') {
      expect(result.remote.etag).toBe('remote-etag');
    }
  });

  test('putServerVaultMetaEtagAware on 409 can keep local (retry with remote etag)', async () => {
    const api = {
      putVaultMeta: jest
        .fn()
        .mockRejectedValueOnce(httpError(409))
        .mockResolvedValueOnce({
          data: { ok: true, etag: 'new-etag', updatedAt: 't3', message: 'ok' },
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
      onConflict: async () => 'keep-local',
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
      getServerVaultBlob(api, VaultBlobType.Addresses)
    ).resolves.toBeNull();
  });

  test('putServerVaultBlobEtagAware on 409 can keep local (retry with remote etag)', async () => {
    const api = {
      putVaultBlob: jest
        .fn()
        .mockRejectedValueOnce(httpError(409))
        .mockResolvedValueOnce({
          data: { ok: true, etag: 'new-etag', updatedAt: 't3', message: 'ok' },
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
      onConflict: async () => 'keep-local',
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
});
