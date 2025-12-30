import { VaultBlobType } from '@myorganizer/app-api-client';

import type { VaultStorageV1 } from './vault';
import { migrateVaultPhase1ToPhase2 } from './vaultMigration';

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

function makeServerMeta(): any {
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
      api: {} as any,
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
      async (_api: any, type: any) => {
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
      api: {} as any,
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

  test('skips when unauthenticated (401/403)', async () => {
    const error: any = new Error('unauth');
    error.response = { status: 401 };
    serverVaultSync.getServerVaultMeta.mockRejectedValue(error);

    const result = await migrateVaultPhase1ToPhase2({
      api: {} as any,
      localVault: makeLocalVault(),
      prompt: () => 'keep-local',
    });

    expect(result).toEqual({ kind: 'skipped-not-authenticated' });
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
      api: {} as any,
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

    // first two blob reads for building remoteBlobs
    serverVaultSync.getServerVaultBlob
      .mockResolvedValueOnce({
        etag: 'remote-addr-etag',
        updatedAt: 'bt1',
        type: VaultBlobType.Addresses,
        blob: { version: 1, iv: 'remote', ciphertext: 'remote' },
      })
      .mockResolvedValueOnce(null)
      // extra reads when overwriting
      .mockResolvedValueOnce({
        etag: 'remote-addr-etag',
        updatedAt: 'bt1',
        type: VaultBlobType.Addresses,
        blob: { version: 1, iv: 'remote', ciphertext: 'remote' },
      })
      .mockResolvedValueOnce(null);

    const result = await migrateVaultPhase1ToPhase2({
      api: {} as any,
      localVault: makeLocalVault(),
      prompt: () => 'keep-local',
    });

    expect(serverVaultSync.putServerVaultMetaEtagAware).toHaveBeenCalledTimes(
      1
    );
    expect(serverVaultSync.putServerVaultBlobEtagAware).toHaveBeenCalledTimes(
      1
    );
    expect(result).toEqual({ kind: 'kept-local-overwrote-server' });
  });
});
