import { VaultBlobType, type VaultMetaV1 } from '@myorganizer/app-api-client';

import type { VaultStorageV1 } from './vault';
import { migrateVaultPhase1ToPhase2 } from './vaultMigration';

type ApiParam = Parameters<typeof migrateVaultPhase1ToPhase2>[0]['api'];

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
  overrides: Partial<VaultStorageV1> = {}
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

describe('migrateVaultPhase1ToPhase2', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('uploads local vault to server when server is empty (404) and local exists', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);

    const localVault = makeLocalVault();

    const result = await migrateVaultPhase1ToPhase2({
      api: {} as unknown as ApiParam,
      localVault,
      prompt: () => 'keep-local',
    });

    expect(serverVaultSync.putServerVaultMetaEtagAware).toHaveBeenCalledTimes(
      1
    );
    expect(serverVaultSync.putServerVaultBlobEtagAware).toHaveBeenCalledTimes(
      1
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
      }
    );

    const result = await migrateVaultPhase1ToPhase2({
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

  test('skips when both local and server vault are missing', async () => {
    serverVaultSync.getServerVaultMeta.mockResolvedValue(null);

    const result = await migrateVaultPhase1ToPhase2({
      api: {} as unknown as ApiParam,
      localVault: null,
      prompt: () => 'keep-server',
    });

    expect(result).toEqual({ kind: 'skipped-no-local-vault' });
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

    const result = await migrateVaultPhase1ToPhase2({
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
      }
    );

    const prompt = jest.fn(() => 'keep-server' as const);

    const result = await migrateVaultPhase1ToPhase2({
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

    const result = await migrateVaultPhase1ToPhase2({
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
      }
    );

    const result = await migrateVaultPhase1ToPhase2({
      api: {} as unknown as ApiParam,
      localVault: makeLocalVault(),
      prompt: () => 'keep-local',
    });

    expect(serverVaultSync.putServerVaultMetaEtagAware).toHaveBeenCalledTimes(
      1
    );
    expect(serverVaultSync.putServerVaultBlobEtagAware).toHaveBeenCalledTimes(
      1
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
});
