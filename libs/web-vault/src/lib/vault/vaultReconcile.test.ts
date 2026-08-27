import { VaultBlobType, type VaultMetaV1 } from '@myorganizer/app-api-client';

import type { VaultStorageV1 } from './localVaultStorage';
import { VAULT_BLOB_TYPES } from './vaultBlobFields';
import { reconcileVaultWithServer } from './vaultReconcile';

type ApiParam = Parameters<typeof reconcileVaultWithServer>[0]['api'];

jest.mock('./serverVaultSync', () => ({
  getServerVaultMeta: jest.fn(),
  getServerVaultBlob: jest.fn(),
  putServerVaultMetaEtagAware: jest.fn(),
  putServerVaultBlobEtagAware: jest.fn(),
}));

const serverVaultSync = jest.requireMock('./serverVaultSync') as {
  getServerVaultMeta: jest.Mock;
  getServerVaultBlob: jest.Mock;
  putServerVaultMetaEtagAware: jest.Mock;
  putServerVaultBlobEtagAware: jest.Mock;
};

function makeLocalVault(
  overrides: Partial<VaultStorageV1> = {},
): VaultStorageV1 {
  return {
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 310_000,
      salt: 'salt',
    },
    masterKeyWrappedWithPassphrase: { iv: 'iv1', ciphertext: 'ct1' },
    masterKeyWrappedWithRecoveryKey: { iv: 'iv2', ciphertext: 'ct2' },
    data: {
      addresses: { iv: 'aiv', ciphertext: 'act' },
    },
    ...overrides,
  };
}

function makeServerMeta(): VaultMetaV1 {
  return {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt: 'salt',
    kdf_params: { hash: 'SHA-256', iterations: 310_000 },
    wrapped_mk_passphrase: { version: 1, iv: 'iv1', ciphertext: 'ct1' },
    wrapped_mk_recovery: { version: 1, iv: 'iv2', ciphertext: 'ct2' },
  };
}

function makeServerBlobResponse(
  type: VaultBlobType,
  etag: string,
  iv: string,
  ciphertext: string,
) {
  return {
    etag,
    updatedAt: 'bt1',
    type,
    blob: { version: 1, iv, ciphertext },
  };
}

describe('reconcileVaultWithServer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('uploads local vault to server when server is empty (404) and local exists', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);

    const localVault = makeLocalVault();

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault,
      prompt: () => 'keep-local',
    });

    expect(serverVaultSync.putServerVaultMetaEtagAware).toHaveBeenCalledTimes(
      1,
    );
    expect(serverVaultSync.putServerVaultBlobEtagAware).toHaveBeenCalledTimes(
      1,
    );

    expect(result).toEqual({ kind: 'uploaded-local-to-server' });
  });

  test('downloads server vault to local when local is missing', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Addresses) {
          return {
            etag: 'b1',
            updatedAt: 'bt1',
            type,
            blob: { version: 1, iv: 'aiv', ciphertext: 'act' },
          };
        }
        return null;
      },
    );

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault: null,
      prompt: () => 'keep-server',
    });

    expect(result.kind).toBe('downloaded-server-to-local');
    if (result.kind === 'downloaded-server-to-local') {
      expect(result.nextLocalVault.version).toBe(1);
      expect(result.nextLocalVault.data.addresses).toEqual({
        iv: 'aiv',
        ciphertext: 'act',
      });
    }
  });

  test('no-ops when this User has no Vault on this device or on the server', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault: null,
      prompt: () => 'keep-server',
    });

    expect(result).toEqual({ kind: 'noop-nothing-to-reconcile' });
    expect(serverVaultSync.getServerVaultBlob).not.toHaveBeenCalled();
    expect(serverVaultSync.putServerVaultMetaEtagAware).not.toHaveBeenCalled();
    expect(serverVaultSync.putServerVaultBlobEtagAware).not.toHaveBeenCalled();
  });

  test('skips when unauthenticated (401/403)', async () => {
    const error = new Error('unauth') as Error & {
      response?: { status: number };
    };
    error.response = { status: 401 };
    serverVaultSync.getServerVaultMeta.mockRejectedValue(error);

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault: makeLocalVault(),
      prompt: () => 'keep-local',
    });

    expect(result).toEqual({ kind: 'skipped-not-authenticated' });
  });

  test('noop: does not prompt when local and server vault are already in sync', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Addresses) {
          return {
            etag: 'b1',
            updatedAt: 'bt1',
            type,
            blob: { version: 1, iv: 'aiv', ciphertext: 'act' },
          };
        }
        if (type === VaultBlobType.MobileNumbers) {
          return null;
        }
        return null;
      },
    );

    const prompt = jest.fn(() => 'keep-server' as const);

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault: makeLocalVault(),
      prompt,
    });

    expect(result).toEqual({ kind: 'noop-already-in-sync' });
    expect(prompt).not.toHaveBeenCalled();
    expect(serverVaultSync.putServerVaultMetaEtagAware).not.toHaveBeenCalled();
    expect(serverVaultSync.putServerVaultBlobEtagAware).not.toHaveBeenCalled();
  });

  test('conflict: keep-server returns nextLocalVault without overwriting server', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    // Make blobs differ to force prompt
    serverVaultSync.getServerVaultBlob.mockResolvedValue({
      etag: 'b1',
      updatedAt: 'bt1',
      type: VaultBlobType.Addresses,
      blob: { version: 1, iv: 'remote', ciphertext: 'remote' },
    });

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault: makeLocalVault(),
      prompt: () => 'keep-server',
    });

    expect(result.kind).toBe('kept-server-overwrote-local');
    expect(serverVaultSync.putServerVaultMetaEtagAware).not.toHaveBeenCalled();
  });

  test('conflict: keep-local overwrites server meta/blobs (etag-aware)', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'server-etag',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Addresses) {
          return {
            etag: 'remote-addr-etag',
            updatedAt: 'bt1',
            type,
            blob: { version: 1, iv: 'remote', ciphertext: 'remote' },
          };
        }
        return null;
      },
    );

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault: makeLocalVault(),
      prompt: () => 'keep-local',
    });

    expect(serverVaultSync.putServerVaultMetaEtagAware).toHaveBeenCalledTimes(
      1,
    );
    expect(serverVaultSync.putServerVaultBlobEtagAware).toHaveBeenCalledTimes(
      1,
    );

    const putMetaArgs =
      serverVaultSync.putServerVaultMetaEtagAware.mock.calls[0][0];
    expect(putMetaArgs.ifMatch).toBe('server-etag');
    expect(putMetaArgs.meta.kdf_params.hash).toBe('SHA-256');
    expect(putMetaArgs.meta.kdf_params.iterations).toBe(310_000);
    expect(putMetaArgs.onConflict()).toBe('keep-local');

    const putBlobArgs =
      serverVaultSync.putServerVaultBlobEtagAware.mock.calls[0][0];
    expect(putBlobArgs.type).toBe(VaultBlobType.Addresses);
    expect(putBlobArgs.ifMatch).toBe('remote-addr-etag');
    expect(putBlobArgs.blob).toEqual({
      version: 1,
      iv: 'aiv',
      ciphertext: 'act',
    });
    expect(putBlobArgs.onConflict()).toBe('keep-local');

    expect(result).toEqual({ kind: 'kept-local-overwrote-server' });
  });

  test('uploads tasks blob when local vault has tasks data and server is empty', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);

    const localVault = makeLocalVault({
      data: {
        addresses: { iv: 'aiv', ciphertext: 'act' },
        tasks: { iv: 'tiv', ciphertext: 'tct' },
      },
    });

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault,
      prompt: () => 'keep-local',
    });

    expect(serverVaultSync.putServerVaultBlobEtagAware).toHaveBeenCalledTimes(
      2,
    );
    expect(
      serverVaultSync.putServerVaultBlobEtagAware.mock.calls.some(
        (call) => call[0].type === VaultBlobType.Tasks,
      ),
    ).toBe(true);
    expect(result).toEqual({ kind: 'uploaded-local-to-server' });
  });

  test('downloads includes tasks blob when server has it', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Tasks) {
          return {
            etag: 't1',
            updatedAt: 'tt1',
            type,
            blob: { version: 1, iv: 'tiv', ciphertext: 'tct' },
          };
        }
        if (type === VaultBlobType.Addresses) {
          return {
            etag: 'b1',
            updatedAt: 'bt1',
            type,
            blob: { version: 1, iv: 'aiv', ciphertext: 'act' },
          };
        }
        return null;
      },
    );

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault: null,
      prompt: () => 'keep-server',
    });

    expect(result.kind).toBe('downloaded-server-to-local');
    if (result.kind === 'downloaded-server-to-local') {
      expect(result.nextLocalVault.data.tasks).toEqual({
        iv: 'tiv',
        ciphertext: 'tct',
      });
    }
  });

  test('tasks blob included in keep-local comparison when both have tasks data', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'server-etag',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Tasks) {
          return {
            etag: 'remote-task-etag',
            updatedAt: 'bt1',
            type,
            blob: { version: 1, iv: 'remote-tiv', ciphertext: 'remote-tct' },
          };
        }
        if (type === VaultBlobType.Addresses) {
          return {
            etag: 'remote-addr-etag',
            updatedAt: 'bt1',
            type,
            blob: { version: 1, iv: 'remote', ciphertext: 'remote' },
          };
        }
        return null;
      },
    );

    const localVault = makeLocalVault({
      data: {
        addresses: { iv: 'local-aiv', ciphertext: 'local-act' },
        tasks: { iv: 'local-tiv', ciphertext: 'local-tct' },
      },
    });

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault,
      prompt: () => 'keep-local',
    });

    expect(serverVaultSync.putServerVaultBlobEtagAware).toHaveBeenCalledTimes(
      2,
    );
    expect(
      serverVaultSync.putServerVaultBlobEtagAware.mock.calls.some(
        (call) => call[0].type === VaultBlobType.Tasks,
      ),
    ).toBe(true);
    expect(result).toEqual({ kind: 'kept-local-overwrote-server' });
  });

  // Issue #512: Regression tests for Groceries blob type handling
  // Groceries was omitted from upload, fetch, and divergence comparison branches,
  // causing keep-server to silently destroy user's grocery data.

  test('#512: groceries uploads on first sync when server is empty', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);

    const localVault = makeLocalVault({
      data: {
        addresses: { iv: 'aiv', ciphertext: 'act' },
        groceries: { iv: 'giv', ciphertext: 'gct' },
      },
    });

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault,
      prompt: () => 'keep-local',
    });

    expect(serverVaultSync.putServerVaultBlobEtagAware).toHaveBeenCalledTimes(
      2,
    );

    const groceriesCalls =
      serverVaultSync.putServerVaultBlobEtagAware.mock.calls.filter(
        (call) => call[0].type === VaultBlobType.Groceries,
      );
    expect(groceriesCalls).toHaveLength(1);
    expect(groceriesCalls[0][0]).toEqual({
      api: expect.anything(),
      type: VaultBlobType.Groceries,
      blob: { version: 1, iv: 'giv', ciphertext: 'gct' },
    });

    expect(result).toEqual({ kind: 'uploaded-local-to-server' });
  });

  test('#512: groceries is fetched into remote map when local vault is missing', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Addresses) {
          return makeServerBlobResponse(type, 'b1', 'aiv', 'act');
        }
        if (type === VaultBlobType.Groceries) {
          return makeServerBlobResponse(type, 'g1', 'giv', 'gct');
        }
        return null;
      },
    );

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault: null,
      prompt: () => 'keep-server',
    });

    expect(result.kind).toBe('downloaded-server-to-local');
    if (result.kind === 'downloaded-server-to-local') {
      expect(result.nextLocalVault.data.groceries).toEqual({
        iv: 'giv',
        ciphertext: 'gct',
      });
    }
  });

  test('#512: groceries-only divergence prompts instead of returning noop-already-in-sync', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    const prompt = jest.fn(() => 'keep-local' as const);

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Addresses) {
          return makeServerBlobResponse(type, 'b1', 'aiv', 'act');
        }
        if (type === VaultBlobType.Groceries) {
          // Server has different groceries blob than local
          return makeServerBlobResponse(type, 'g1', 'server-giv', 'server-gct');
        }
        return null;
      },
    );

    const localVault = makeLocalVault({
      data: {
        addresses: { iv: 'aiv', ciphertext: 'act' },
        groceries: { iv: 'local-giv', ciphertext: 'local-gct' },
      },
    });

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault,
      prompt,
    });

    expect(prompt).toHaveBeenCalled();
    expect(result.kind).not.toBe('noop-already-in-sync');
  });

  test('#512: keep-server preserves groceries from server copy', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'e1',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Addresses) {
          return makeServerBlobResponse(type, 'b1', 'aiv', 'act');
        }
        if (type === VaultBlobType.Groceries) {
          return makeServerBlobResponse(type, 'g1', 'server-giv', 'server-gct');
        }
        return null;
      },
    );

    const localVault = makeLocalVault({
      data: {
        addresses: { iv: 'aiv', ciphertext: 'act' },
        groceries: { iv: 'local-giv', ciphertext: 'local-gct' },
      },
    });

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault,
      prompt: () => 'keep-server',
    });

    expect(result.kind).toBe('kept-server-overwrote-local');
    if (result.kind === 'kept-server-overwrote-local') {
      expect(result.nextLocalVault.data.groceries).toEqual({
        iv: 'server-giv',
        ciphertext: 'server-gct',
      });
    }
  });

  test('#512: keep-local writes groceries back to server with etag-aware call', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue({
      etag: 'server-etag',
      updatedAt: 't1',
      meta: makeServerMeta(),
    });

    serverVaultSync.getServerVaultBlob.mockImplementation(
      async (_api: unknown, type: VaultBlobType) => {
        if (type === VaultBlobType.Addresses) {
          return makeServerBlobResponse(type, 'b1', 'aiv', 'act');
        }
        if (type === VaultBlobType.Groceries) {
          return makeServerBlobResponse(
            type,
            'remote-gro-etag',
            'server-giv',
            'server-gct',
          );
        }
        return null;
      },
    );

    const localVault = makeLocalVault({
      data: {
        addresses: { iv: 'aiv', ciphertext: 'act' },
        groceries: { iv: 'local-giv', ciphertext: 'local-gct' },
      },
    });

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault,
      prompt: () => 'keep-local',
    });

    const groceriesCalls =
      serverVaultSync.putServerVaultBlobEtagAware.mock.calls.filter(
        (call) => call[0].type === VaultBlobType.Groceries,
      );
    expect(groceriesCalls).toHaveLength(1);
    expect(groceriesCalls[0][0]).toMatchObject({
      type: VaultBlobType.Groceries,
      blob: { version: 1, iv: 'local-giv', ciphertext: 'local-gct' },
      ifMatch: 'remote-gro-etag',
    });
    expect(groceriesCalls[0][0].onConflict()).toBe('keep-local');

    expect(result).toEqual({ kind: 'kept-local-overwrote-server' });
  });

  test('#512: exhaustiveness regression — all VaultBlobType members are reconciled', async () => {
    // Assert that VAULT_BLOB_TYPES contains exactly the members of VaultBlobType.
    const expectedTypes = Object.values(VaultBlobType).sort();
    const reconciledTypes = VAULT_BLOB_TYPES.slice().sort();

    expect(reconciledTypes).toEqual(expectedTypes);
  });

  test('#512: exhaustiveness regression — end-to-end uploads all VaultBlobType members', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);

    // Build local vault with all blob types dynamically from VaultBlobType enum
    const allBlobsData: Partial<
      Record<
        VaultBlobType,
        {
          iv: string;
          ciphertext: string;
        }
      >
    > = {};

    for (const type of Object.values(VaultBlobType)) {
      allBlobsData[type] = {
        iv: `iv-${type}`,
        ciphertext: `ct-${type}`,
      };
    }

    const localVault = makeLocalVault({
      data: allBlobsData as VaultStorageV1['data'],
    });

    const result = await reconcileVaultWithServer({
      api: {} as unknown as ApiParam,
      localVault,
      prompt: () => 'keep-local',
    });

    expect(result.kind).toBe('uploaded-local-to-server');

    // Extract all blob types that were uploaded
    const uploadedTypes = new Set(
      serverVaultSync.putServerVaultBlobEtagAware.mock.calls.map(
        (call) => call[0].type,
      ),
    );

    // Assert that all VaultBlobType members were uploaded
    const expectedUploadedTypes = new Set(Object.values(VaultBlobType));

    expect(uploadedTypes).toEqual(expectedUploadedTypes);
  });
});
