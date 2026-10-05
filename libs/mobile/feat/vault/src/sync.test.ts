import { VaultBlobType, type VaultApi } from '@myorganizer/app-api-client';
import { bytesToBase64, utf8ToBytes } from './bytes';
import { pullVaultBlob, readVaultBlob } from './sync';

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

describe('pullVaultBlob', () => {
  const serverTask = {
    id: 't1',
    title: 'Renew passport',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('returns the server copy and nothing to send when no edit is unsent', async () => {
    const pull = await pullVaultBlob({
      vaultApi: apiReturning({ records: [serverTask], deletions: {} }),
      masterKey,
      type: VaultBlobType.Tasks,
      unsent: null,
    });

    expect(pull).toEqual({
      server: {
        envelope: { records: [serverTask], deletions: {} },
        etag: '"v1"',
      },
      converged: null,
    });
  });

  it('keeps an edit the server has not seen alongside what another device added', async () => {
    const unsentTask = {
      id: 't2',
      title: 'Book flights',
      createdAt: '2026-01-02T00:00:00.000Z',
    };
    const arrivedTask = {
      id: 't3',
      title: 'Pack',
      createdAt: '2026-01-03T00:00:00.000Z',
    };

    const pull = await pullVaultBlob({
      vaultApi: apiReturning({
        records: [serverTask, arrivedTask],
        deletions: {},
      }),
      masterKey,
      type: VaultBlobType.Tasks,
      unsent: { records: [serverTask, unsentTask], deletions: {} },
    });

    expect(pull.server.envelope.records).toEqual([serverTask, arrivedTask]);
    expect(pull.converged).toEqual({
      records: [serverTask, unsentTask, arrivedTask],
      deletions: {},
    });
  });

  it('keeps an unsent change to a record the server holds an older version of', async () => {
    const edited = {
      ...serverTask,
      title: 'Renew passport today',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };

    const pull = await pullVaultBlob({
      vaultApi: apiReturning({ records: [serverTask], deletions: {} }),
      masterKey,
      type: VaultBlobType.Tasks,
      unsent: { records: [edited], deletions: {} },
    });

    expect(pull.converged?.records).toEqual([edited]);
  });

  it('removes a record the server deleted after the unsent edit last changed it', async () => {
    const edited = {
      ...serverTask,
      title: 'Renew passport today',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    const deletions = { t1: '2026-03-01T00:00:00.000Z' };

    const pull = await pullVaultBlob({
      vaultApi: apiReturning({ records: [], deletions }),
      masterKey,
      type: VaultBlobType.Tasks,
      unsent: { records: [edited], deletions: {} },
    });

    expect(pull.converged).toEqual({ records: [], deletions });
  });

  it('keeps a record changed after the server deleted it', async () => {
    const edited = {
      ...serverTask,
      updatedAt: '2026-04-01T00:00:00.000Z',
    };
    const deletions = { t1: '2026-03-01T00:00:00.000Z' };

    const pull = await pullVaultBlob({
      vaultApi: apiReturning({ records: [], deletions }),
      masterKey,
      type: VaultBlobType.Tasks,
      unsent: { records: [edited], deletions: {} },
    });

    expect(pull.converged).toEqual({ records: [edited], deletions });
  });

  it('lets the unsent edit stand when the server holds no blob to merge against', async () => {
    const unsent = { records: [serverTask], deletions: {} };

    const pull = await pullVaultBlob({
      vaultApi: apiWithNoBlob(),
      masterKey,
      type: VaultBlobType.Tasks,
      unsent,
    });

    expect(pull.server.etag).toBeNull();
    expect(pull.converged).toBe(unsent);
  });
});
