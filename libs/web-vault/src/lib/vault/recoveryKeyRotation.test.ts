/**
 * Tests for Recovery Key Rotation — the two-phase operation minting a new key and rotating to it.
 *
 * Tests use REAL vault initialization, minting, and crypto.subtle operations, with REAL
 * localStorage. The VaultApi layer (getVaultMeta and putVaultMeta) is faked to control
 * server responses and verify correct conflict-handling semantics.
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
if (!(globalThis as any).crypto?.subtle) {
  const { webcrypto } = require('crypto');
  if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = {};
  }
  (globalThis as any).crypto.subtle = webcrypto.subtle;
}

import type { AxiosResponse } from 'axios';
import type { VaultApi } from '@myorganizer/app-api-client';
import { base64ToBytes } from './crypto';
import { mintRecoveryKey, type MintedRecoveryKey } from './recoveryKeyMint';
import { createVaultHandle, VaultSecretMismatchError } from './vaultHandle';
import { rotateRecoveryKeyWithPassphrase } from './vaultMetaPush';
import { hashVaultMeta } from './syncBookmarkAccess';
import { localToServerMeta } from './vaultShapes';

type VaultMetaApi = Pick<VaultApi, 'getVaultMeta' | 'putVaultMeta'>;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

/**
 * A `VaultApi` double carrying the two methods this module reaches for.
 *
 * Typed as `jest.Mocked` rather than as the plain interface so the mock
 * controls are visible to the typechecker: a double typed as the interface
 * compiles at the call site and then fails on every `mockResolvedValue`.
 */
function createApiDouble(): jest.Mocked<VaultMetaApi> {
  return {
    getVaultMeta: jest.fn(),
    putVaultMeta: jest.fn(),
  } as unknown as jest.Mocked<VaultMetaApi>;
}

/**
 * Mock helper: server holds no Vault Meta (getVaultMeta returns 404).
 */
function serverHoldsNoVaultMeta(api: jest.Mocked<VaultMetaApi>): void {
  const notFoundError = new Error('Not Found') as Error & {
    response?: { status: number };
  };
  notFoundError.response = { status: 404 };
  api.getVaultMeta.mockRejectedValue(notFoundError);
  api.putVaultMeta.mockResolvedValue({
    data: { etag: 'etag-new', updatedAt: 't1' },
  } as AxiosResponse);
}

/**
 * Mock helper: server is unreachable (getVaultMeta rejects with 500).
 */
function serverIsUnreachable(api: jest.Mocked<VaultMetaApi>): void {
  const transportError = new Error('Server error') as Error & {
    response?: { status: number };
  };
  transportError.response = { status: 500 };
  api.getVaultMeta.mockRejectedValue(transportError);
}

/**
 * Helper to set up a vault handle with initialization and unlock.
 * Returns the handle, its recovery key, and master key bytes for assertion purposes.
 */
async function setupHandle(owner: string, passphrase: string) {
  const handle = createVaultHandle({ owner });
  const { recoveryKey } = await handle.initialize({ passphrase });
  const { masterKeyBytes } = await handle.unlockWithPassphrase({ passphrase });
  return { handle, recoveryKey, masterKeyBytes };
}

describe('mintRecoveryKey', () => {
  test('1: Returns a valid base64 string that decodes to 32 bytes', () => {
    const key = mintRecoveryKey();

    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);

    const bytes = base64ToBytes(key);
    expect(bytes.length).toBe(32);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  test('2: Two calls return different keys', () => {
    const key1 = mintRecoveryKey();
    const key2 = mintRecoveryKey();

    expect(key1).not.toBe(key2);
    expect(base64ToBytes(key1).length).toBe(32);
    expect(base64ToBytes(key2).length).toBe(32);
  });

  test('3: mintRecoveryKey is pure — with initialized+unlocked handle, calling it does not change Local Vault', async () => {
    const owner = 'test-owner';
    const passphrase = 'test-pass';
    const { handle } = await setupHandle(owner, passphrase);

    const storageBefore: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) {
        storageBefore[key] = localStorage.getItem(key) || '';
      }
    }
    const storageBeforeSnapshot = JSON.parse(JSON.stringify(storageBefore));

    const bookmarkBefore = handle.lastAgreedVaultMetaHash();

    const key = mintRecoveryKey();

    const storageAfter: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey !== null) {
        storageAfter[storageKey] = localStorage.getItem(storageKey) || '';
      }
    }
    const storageAfterSnapshot = JSON.parse(JSON.stringify(storageAfter));

    expect(storageAfterSnapshot).toEqual(storageBeforeSnapshot);
    expect(handle.lastAgreedVaultMetaHash()).toBe(bookmarkBefore);
    expect(base64ToBytes(key).length).toBe(32);
  });
});

describe('rotateRecoveryKeyWithPassphrase — happy path', () => {
  const owner = 'test-owner';
  const passphrase = 'test-pass';

  test('4: Server holds no Vault Meta (404) and putVaultMeta resolves: returns {changedLocally: true, push: {kind: "pushed"}}', async () => {
    const { handle } = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const newKey = mintRecoveryKey();

    serverHoldsNoVaultMeta(api);

    const result = await rotateRecoveryKeyWithPassphrase({
      api,
      handle,
      currentPassphrase: passphrase,
      recoveryKey: newKey,
    });

    expect(result).toEqual({
      changedLocally: true,
      push: { kind: 'pushed' },
    });
  });

  test('5: After rotation, a NEW handle unlocks with the new key via unlockWithRecoveryKey, and the retired key does NOT. Master Key bytes are identical.', async () => {
    const {
      handle,
      recoveryKey: originalRecoveryKey,
      masterKeyBytes: originalMasterKeyBytes,
    } = await setupHandle(owner, passphrase);
    const api = createApiDouble();

    const newKey = mintRecoveryKey();

    serverHoldsNoVaultMeta(api);

    await rotateRecoveryKeyWithPassphrase({
      api,
      handle,
      currentPassphrase: passphrase,
      recoveryKey: newKey,
    });

    const newHandle = createVaultHandle({ owner });
    const newUnlockResult = await newHandle.unlockWithRecoveryKey({
      recoveryKey: newKey,
    });
    expect(newUnlockResult).toHaveProperty('masterKeyBytes');
    expect(newHandle.isUnlocked).toBe(true);

    expect(Array.from(newUnlockResult.masterKeyBytes)).toEqual(
      Array.from(originalMasterKeyBytes),
    );

    const retiredHandle = createVaultHandle({ owner });
    await expect(
      retiredHandle.unlockWithRecoveryKey({
        recoveryKey: originalRecoveryKey,
      }),
    ).rejects.toThrow(VaultSecretMismatchError);
  });

  test('6: After rotation, every Vault Blob remains readable: pre-rotation blob == post-rotation blob', async () => {
    const { handle } = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const newKey = mintRecoveryKey();

    const addressesBefore = [
      { name: 'Home', street: '123 Main St' },
      { name: 'Work', street: '456 Oak Ave' },
    ];
    await handle.saveEncryptedData({
      type: 'addresses',
      value: addressesBefore,
    });

    serverHoldsNoVaultMeta(api);

    await rotateRecoveryKeyWithPassphrase({
      api,
      handle,
      currentPassphrase: passphrase,
      recoveryKey: newKey,
    });

    const rotatedHandle = createVaultHandle({ owner });
    await rotatedHandle.unlockWithRecoveryKey({
      recoveryKey: newKey,
    });

    const addressesAfter = await rotatedHandle.loadDecryptedData({
      type: 'addresses',
      defaultValue: [],
    });

    expect(addressesAfter).toEqual(addressesBefore);
  });

  test('7: After rotation, passphrase still unlocks, and kdf.salt + kdf.iterations + masterKeyWrappedWithPassphrase are byte-identical before and after', async () => {
    const { handle } = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const newKey = mintRecoveryKey();

    const vaultBefore = handle.loadVault()!;
    const saltBefore = vaultBefore.kdf.salt;
    const iterationsBefore = vaultBefore.kdf.iterations;
    const passphraseWrappingBefore = vaultBefore.masterKeyWrappedWithPassphrase;

    serverHoldsNoVaultMeta(api);

    await rotateRecoveryKeyWithPassphrase({
      api,
      handle,
      currentPassphrase: passphrase,
      recoveryKey: newKey,
    });

    const vaultAfter = handle.loadVault()!;
    const saltAfter = vaultAfter.kdf.salt;
    const iterationsAfter = vaultAfter.kdf.iterations;
    const passphraseWrappingAfter = vaultAfter.masterKeyWrappedWithPassphrase;

    expect(saltAfter).toBe(saltBefore);
    expect(iterationsAfter).toBe(iterationsBefore);
    expect(passphraseWrappingAfter).toEqual(passphraseWrappingBefore);

    const unlockedHandle = createVaultHandle({ owner });
    await unlockedHandle.unlockWithPassphrase({ passphrase });
    expect(unlockedHandle.isUnlocked).toBe(true);
  });
});

describe('rotateRecoveryKeyWithPassphrase — base and bookmark ordering', () => {
  const owner = 'test-owner';
  const passphrase = 'test-pass';

  test('8: Push carries PRE-rotation Vault Meta as base, and putVaultMeta is called with POST-rotation meta and PRE-rotation etag as If-Match', async () => {
    const { handle } = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const newKey = mintRecoveryKey();

    const preRotationLocalVault = handle.loadVault()!;
    const preRotationMeta = localToServerMeta(preRotationLocalVault);
    await handle.recordVaultMetaAgreement({ meta: preRotationMeta });

    api.getVaultMeta.mockResolvedValue({
      data: {
        etag: 'etag-pre-rotation',
        updatedAt: 't1',
        meta: preRotationMeta,
      },
    } as AxiosResponse);

    api.putVaultMeta.mockResolvedValue({
      data: { etag: 'etag-post-rotation', updatedAt: 't2' },
    } as AxiosResponse);

    const result = await rotateRecoveryKeyWithPassphrase({
      api,
      handle,
      currentPassphrase: passphrase,
      recoveryKey: newKey,
    });

    expect(result.push.kind).toBe('pushed');
    expect(api.putVaultMeta).toHaveBeenCalledTimes(1);

    const putCall = api.putVaultMeta.mock.calls[0][0];
    expect(putCall).toHaveProperty('ifMatch', 'etag-pre-rotation');

    const postRotationLocalVault = handle.loadVault()!;
    const postRotationMeta = localToServerMeta(postRotationLocalVault);
    expect(putCall.putVaultMetaRequest.meta).toEqual(postRotationMeta);

    expect(postRotationMeta.wrapped_mk_recovery).not.toEqual(
      preRotationMeta.wrapped_mk_recovery,
    );
  });

  test('9: Vault Meta Bookmark is written to PRE-rotation base BEFORE push is attempted — transport error does not lose bookmark', async () => {
    const { handle } = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const newKey = mintRecoveryKey();

    // Do not pre-seed the bookmark; assert it starts undefined, then after rotation
    // with a 500 error, assert it holds the pre-rotation hash. This proves
    // rewrapAndPush wrote the bookmark before attempting the push.
    const preRotationLocalVault = handle.loadVault()!;
    const preRotationMeta = localToServerMeta(preRotationLocalVault);
    const preRotationHash = await hashVaultMeta(preRotationMeta);

    expect(handle.lastAgreedVaultMetaHash()).toBeUndefined();

    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-pre', updatedAt: 't1', meta: preRotationMeta },
    } as AxiosResponse);

    serverIsUnreachable(api);

    const result = await rotateRecoveryKeyWithPassphrase({
      api,
      handle,
      currentPassphrase: passphrase,
      recoveryKey: newKey,
    });

    expect(result.push.kind).toBe('unreachable');

    const bookmarkHash = handle.lastAgreedVaultMetaHash();
    expect(bookmarkHash).toBe(preRotationHash);

    const postRotationMeta = localToServerMeta(handle.loadVault()!);
    const postRotationHash = await hashVaultMeta(postRotationMeta);
    expect(bookmarkHash).not.toBe(postRotationHash);
  });

  test('10: On a landed push, the bookmark advances to POST-rotation meta hash', async () => {
    const { handle } = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const newKey = mintRecoveryKey();

    const preRotationLocalVault = handle.loadVault()!;
    const preRotationMeta = localToServerMeta(preRotationLocalVault);
    await handle.recordVaultMetaAgreement({ meta: preRotationMeta });

    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-pre', updatedAt: 't1', meta: preRotationMeta },
    } as AxiosResponse);

    api.putVaultMeta.mockResolvedValue({
      data: { etag: 'etag-post', updatedAt: 't2' },
    } as AxiosResponse);

    await rotateRecoveryKeyWithPassphrase({
      api,
      handle,
      currentPassphrase: passphrase,
      recoveryKey: newKey,
    });

    const postRotationMeta = localToServerMeta(handle.loadVault()!);
    const postRotationHash = await hashVaultMeta(postRotationMeta);
    expect(handle.lastAgreedVaultMetaHash()).toBe(postRotationHash);
  });
});

describe('rotateRecoveryKeyWithPassphrase — wrong passphrase', () => {
  const owner = 'test-owner';
  const passphrase = 'test-pass';

  test('11: Wrong currentPassphrase rejects with VaultSecretMismatchError, putVaultMeta is never called, Local Vault is byte-identical, and original recovery key still unlocks afterwards', async () => {
    const { handle, recoveryKey: originalRecoveryKey } = await setupHandle(
      owner,
      passphrase,
    );
    const api = createApiDouble();

    const newKey = mintRecoveryKey();

    const vaultBefore = handle.loadVault()!;
    const stateBefore = {
      kdf: vaultBefore.kdf,
      masterKeyWrappedWithPassphrase:
        vaultBefore.masterKeyWrappedWithPassphrase,
      masterKeyWrappedWithRecoveryKey:
        vaultBefore.masterKeyWrappedWithRecoveryKey,
      data: vaultBefore.data,
    };
    const stateBeforeSnapshot = JSON.parse(
      JSON.stringify(stateBefore),
    ) as typeof stateBefore;

    await expect(
      rotateRecoveryKeyWithPassphrase({
        api,
        handle,
        currentPassphrase: 'badpass',
        recoveryKey: newKey,
      }),
    ).rejects.toThrow(VaultSecretMismatchError);

    expect(api.putVaultMeta).not.toHaveBeenCalled();

    const vaultAfter = handle.loadVault()!;
    const stateAfter = {
      kdf: vaultAfter.kdf,
      masterKeyWrappedWithPassphrase: vaultAfter.masterKeyWrappedWithPassphrase,
      masterKeyWrappedWithRecoveryKey:
        vaultAfter.masterKeyWrappedWithRecoveryKey,
      data: vaultAfter.data,
    };
    expect(stateAfter).toEqual(stateBeforeSnapshot);

    const testHandle = createVaultHandle({ owner });
    const result = await testHandle.unlockWithRecoveryKey({
      recoveryKey: originalRecoveryKey,
    });
    expect(result).toHaveProperty('masterKeyBytes');
    expect(testHandle.isUnlocked).toBe(true);
  });
});

describe('rotateRecoveryKeyWithPassphrase — refused / unreachable push', () => {
  const owner = 'test-owner';
  const passphrase = 'test-pass';

  test('12: Transport failure on getVaultMeta returns {changedLocally: true, push: {kind: "unreachable"}}, and rotation is still in place locally — new key unlocks, retired key does not', async () => {
    const { handle, recoveryKey: originalRecoveryKey } = await setupHandle(
      owner,
      passphrase,
    );
    const api = createApiDouble();

    const newKey = mintRecoveryKey();

    serverIsUnreachable(api);

    const result = await rotateRecoveryKeyWithPassphrase({
      api,
      handle,
      currentPassphrase: passphrase,
      recoveryKey: newKey,
    });

    expect(result).toEqual({
      changedLocally: true,
      push: { kind: 'unreachable' },
    });

    const newHandle = createVaultHandle({ owner });
    const newUnlockResult = await newHandle.unlockWithRecoveryKey({
      recoveryKey: newKey,
    });
    expect(newUnlockResult).toHaveProperty('masterKeyBytes');
    expect(newHandle.isUnlocked).toBe(true);

    const retiredHandle = createVaultHandle({ owner });
    await expect(
      retiredHandle.unlockWithRecoveryKey({
        recoveryKey: originalRecoveryKey,
      }),
    ).rejects.toThrow(VaultSecretMismatchError);

    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  test('13: Server moved (getVaultMeta returns different wrapped_mk_recovery): returns {changedLocally: true, push: {kind: "refused-server-moved", change: "recovery-key"}}, putVaultMeta is never called, local rotation still stands', async () => {
    const { handle, recoveryKey: originalRecoveryKey } = await setupHandle(
      owner,
      passphrase,
    );
    const api = createApiDouble();

    const newKey = mintRecoveryKey();

    const preRotationMeta = localToServerMeta(handle.loadVault()!);
    await handle.recordVaultMetaAgreement({ meta: preRotationMeta });

    const serverMetaWithDifferentRecovery = {
      ...preRotationMeta,
      wrapped_mk_recovery: {
        version: 1 as const,
        iv: 'server-different-iv',
        ciphertext: 'server-different-ct',
      },
    };

    api.getVaultMeta.mockResolvedValue({
      data: {
        etag: 'etag-server',
        updatedAt: 't1',
        meta: serverMetaWithDifferentRecovery,
      },
    } as AxiosResponse);

    const result = await rotateRecoveryKeyWithPassphrase({
      api,
      handle,
      currentPassphrase: passphrase,
      recoveryKey: newKey,
    });

    expect(result.changedLocally).toBe(true);
    expect(result.push).toEqual({
      kind: 'refused-server-moved',
      change: 'recovery-key',
    });

    expect(api.putVaultMeta).not.toHaveBeenCalled();

    const newHandle = createVaultHandle({ owner });
    const newUnlockResult = await newHandle.unlockWithRecoveryKey({
      recoveryKey: newKey,
    });
    expect(newUnlockResult).toHaveProperty('masterKeyBytes');
    expect(newHandle.isUnlocked).toBe(true);

    const retiredHandle = createVaultHandle({ owner });
    await expect(
      retiredHandle.unlockWithRecoveryKey({
        recoveryKey: originalRecoveryKey,
      }),
    ).rejects.toThrow(VaultSecretMismatchError);
  });

  test('14: a bare string is not accepted as a Recovery Key', async () => {
    // @ts-expect-error a Recovery Key must come from mintRecoveryKey, not a
    // caller-chosen string — the brand is what makes that a compile error.
    const rejected: MintedRecoveryKey = 'attacker-chosen-key';
    expect(typeof rejected).toBe('string');
  });
});
