import { VaultBlobType, type VaultApi } from '@myorganizer/app-api-client';
import { bytesToBase64, utf8ToBytes } from './bytes';
import { readVaultBlob } from './sync';

// The real module reaches react-native-quick-crypto. Decryption here is the
// identity, so a stored "ciphertext" is the envelope's own JSON.
jest.mock('./crypto', () => {
  const bytes = jest.requireActual('./bytes');
  return {
    ...bytes,
    mobileVaultCrypto: {
      aesGcmDecrypt: async ({ ciphertext }: { ciphertext: Uint8Array }) =>
        ciphertext,
    },
  };
});

const masterKey = new Uint8Array(32);

function apiReturning(payload: unknown): VaultApi {
  return {
    getVaultBlob: jest.fn().mockResolvedValue({
      data: {
        blob: {
          iv: bytesToBase64(new Uint8Array(12)),
          ciphertext: bytesToBase64(utf8ToBytes(JSON.stringify(payload))),
        },
        etag: '"v1"',
      },
    }),
  } as unknown as VaultApi;
}

function apiWithNoBlob(): VaultApi {
  return {
    getVaultBlob: jest.fn().mockRejectedValue({ response: { status: 404 } }),
  } as unknown as VaultApi;
}

describe('readVaultBlob', () => {
  it('starts a Groceries blob the server does not hold as the object its edits expect', async () => {
    const snapshot = await readVaultBlob({
      vaultApi: apiWithNoBlob(),
      masterKey,
      type: VaultBlobType.Groceries,
    });

    expect(snapshot).toEqual({
      envelope: { records: { catalog: [], lists: [] }, deletions: {} },
      etag: null,
    });
  });

  it('starts a list-shaped blob the server does not hold as an empty list', async () => {
    const snapshot = await readVaultBlob({
      vaultApi: apiWithNoBlob(),
      masterKey,
      type: VaultBlobType.Tasks,
    });

    expect(snapshot.envelope.records).toEqual([]);
    expect(snapshot.etag).toBeNull();
  });

  it('reads a Groceries blob saved as an empty list as an empty Groceries object', async () => {
    const snapshot = await readVaultBlob({
      vaultApi: apiReturning({ records: [], deletions: {} }),
      masterKey,
      type: VaultBlobType.Groceries,
    });

    expect(snapshot.envelope.records).toEqual({ catalog: [], lists: [] });
    expect(snapshot.etag).toBe('"v1"');
  });

  it('leaves a Groceries blob that holds lists as it was', async () => {
    const records = {
      catalog: [],
      lists: [{ id: 'l1', name: 'Weekly shop', lines: [] }],
    };
    const snapshot = await readVaultBlob({
      vaultApi: apiReturning({ records, deletions: {} }),
      masterKey,
      type: VaultBlobType.Groceries,
    });

    expect(snapshot.envelope.records).toEqual(records);
  });

  it('leaves a list-shaped blob that holds records as it was', async () => {
    const records = [{ id: 't1', title: 'Renew passport' }];
    const snapshot = await readVaultBlob({
      vaultApi: apiReturning({ records, deletions: {} }),
      masterKey,
      type: VaultBlobType.Tasks,
    });

    expect(snapshot.envelope.records).toEqual(records);
  });
});
