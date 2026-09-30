jest.mock('../sync', () => ({
  readVaultBlob: jest.fn(),
}));

import { readVaultBlob } from '../sync';
import { VaultBlobType } from '@myorganizer/app-api-client';
import type { VaultApi } from '@myorganizer/app-api-client';
import type { VaultBlobEnvelope } from '@myorganizer/vault-core/portable';
import { storedKeyOpensVault, NoCiphertextToCheckError } from './keyCheck';

const mockReadVaultBlob = readVaultBlob as jest.MockedFunction<
  typeof readVaultBlob
>;

const createMockSnapshot = (etag: string | null) => ({
  envelope: {} as VaultBlobEnvelope<unknown>,
  etag,
});

/**
 * The server holds exactly these types; everything else 404s, which
 * `readVaultBlob` answers with an empty envelope and a null ETag.
 */
function serverHolds(types: readonly string[]): void {
  mockReadVaultBlob.mockImplementation(async ({ type }) =>
    types.includes(type)
      ? { envelope: {} as VaultBlobEnvelope<unknown>, etag: `etag-${type}` }
      : { envelope: {} as VaultBlobEnvelope<unknown>, etag: null },
  );
}

describe('keyCheck.ts', () => {
  let mockVaultApi: VaultApi;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVaultApi = {} as VaultApi;
  });

  it('returns true when first blob type hits', async () => {
    const masterKey = new Uint8Array(32);
    mockReadVaultBlob.mockResolvedValueOnce(createMockSnapshot('some-etag'));

    const result = await storedKeyOpensVault({
      vaultApi: mockVaultApi,
      masterKey,
    });

    expect(result).toBe(true);
    expect(mockReadVaultBlob).toHaveBeenCalledTimes(1);
  });

  it('returns true when server holds only the first blob type', async () => {
    const masterKey = new Uint8Array(32);
    const firstType = Object.values(VaultBlobType)[0];
    serverHolds([firstType]);

    const result = await storedKeyOpensVault({
      vaultApi: mockVaultApi,
      masterKey,
    });

    expect(result).toBe(true);
    expect(mockReadVaultBlob).toHaveBeenCalledTimes(1);
  });

  it('returns true when server holds only the last blob type', async () => {
    const masterKey = new Uint8Array(32);
    const types = Object.values(VaultBlobType);
    const lastType = types[types.length - 1];
    serverHolds([lastType]);

    const result = await storedKeyOpensVault({
      vaultApi: mockVaultApi,
      masterKey,
    });

    expect(result).toBe(true);
    // Called once per type up to and including the last one
    expect(mockReadVaultBlob).toHaveBeenCalledTimes(types.length);
  });

  it('returns false when a blob the server holds refuses the key', async () => {
    const masterKey = new Uint8Array(32);
    const decryptionError = new Error('AES-GCM tag verification failed');

    mockReadVaultBlob.mockRejectedValueOnce(decryptionError);

    const result = await storedKeyOpensVault({
      vaultApi: mockVaultApi,
      masterKey,
    });

    expect(result).toBe(false);
  });

  it('rethrows a transport error with response.status', async () => {
    const masterKey = new Uint8Array(32);
    const transportError = new Error('Server error') as Error & {
      response?: { status: number };
    };
    transportError.response = { status: 500 };

    mockReadVaultBlob.mockRejectedValueOnce(transportError);

    await expect(
      storedKeyOpensVault({
        vaultApi: mockVaultApi,
        masterKey,
      }),
    ).rejects.toBe(transportError);
  });

  it('rethrows a network error with isAxiosError true unchanged', async () => {
    const masterKey = new Uint8Array(32);
    const networkError = new Error('Network offline') as Error & {
      response?: undefined;
      isAxiosError?: boolean;
    };
    networkError.isAxiosError = true;

    mockReadVaultBlob.mockRejectedValueOnce(networkError);

    await expect(
      storedKeyOpensVault({
        vaultApi: mockVaultApi,
        masterKey,
      }),
    ).rejects.toBe(networkError);
  });

  it('rethrows a network error with ERR_NETWORK code unchanged', async () => {
    const masterKey = new Uint8Array(32);
    const networkError = new Error('Network unreachable') as Error & {
      response?: undefined;
      code?: string;
    };
    networkError.code = 'ERR_NETWORK';

    mockReadVaultBlob.mockRejectedValueOnce(networkError);

    await expect(
      storedKeyOpensVault({
        vaultApi: mockVaultApi,
        masterKey,
      }),
    ).rejects.toBe(networkError);
  });

  it('throws NoCiphertextToCheckError when all blobs are absent (etag === null)', async () => {
    const masterKey = new Uint8Array(32);

    // Mock all blob types to return 404
    mockReadVaultBlob.mockResolvedValue(createMockSnapshot(null));

    await expect(
      storedKeyOpensVault({
        vaultApi: mockVaultApi,
        masterKey,
      }),
    ).rejects.toThrow(NoCiphertextToCheckError);

    // Assert readVaultBlob was called once per VaultBlobType
    const blobTypeCount = Object.keys(VaultBlobType).length;
    expect(mockReadVaultBlob).toHaveBeenCalledTimes(blobTypeCount);
  });

  it('calls readVaultBlob with the vaultApi and masterKey provided', async () => {
    const masterKey = new Uint8Array([1, 2, 3, 4, 5]);
    mockReadVaultBlob.mockResolvedValueOnce(createMockSnapshot('etag'));

    await storedKeyOpensVault({
      vaultApi: mockVaultApi,
      masterKey,
    });

    expect(mockReadVaultBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        vaultApi: mockVaultApi,
        masterKey,
      }),
    );
  });
});
