/**
 * Tests for Vault Meta Push — conditional writes guarded by device-proven server state.
 *
 * Tests use REAL vault initialization, hashing, and convergence with REAL crypto.subtle,
 * and REAL serverVaultSync logic (getServerVaultMeta and putServerVaultMetaEtagAware).
 * The VaultApi layer (getVaultMeta and putVaultMeta) is faked to control server responses
 * and verify the correct conflict-handling semantics.
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
import type { VaultApi, VaultMetaV1 } from '@myorganizer/app-api-client';
import type { VaultStorageV1 } from './localVaultStorage';
import { createVaultHandle, VaultSecretMismatchError } from './vaultHandle';
import {
  pushLocalVaultMeta,
  resetPassphraseAfterRecovery,
  changePassphraseWithCurrent,
  settleVaultMeta,
} from './vaultMetaPush';
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
 * Helper to create a local vault with the given overrides.
 */
function makeLocalVault(
  overrides: Partial<VaultStorageV1> = {},
): VaultStorageV1 {
  return {
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 310_000,
      salt: 'salt-local',
    },
    masterKeyWrappedWithPassphrase: {
      iv: 'iv1-local',
      ciphertext: 'ct1-local',
    },
    masterKeyWrappedWithRecoveryKey: {
      iv: 'iv2-local',
      ciphertext: 'ct2-local',
    },
    data: {
      addresses: { iv: 'aiv', ciphertext: 'act' },
    },
    ...overrides,
  };
}

/**
 * Helper to create server Vault Meta with the given overrides.
 */
function makeServerMeta(overrides: Partial<VaultMetaV1> = {}): VaultMetaV1 {
  return {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt: 'salt-local',
    kdf_params: { hash: 'SHA-256', iterations: 310_000 },
    wrapped_mk_passphrase: {
      version: 1,
      iv: 'iv1-local',
      ciphertext: 'ct1-local',
    },
    wrapped_mk_recovery: {
      version: 1,
      iv: 'iv2-local',
      ciphertext: 'ct2-local',
    },
    ...overrides,
  };
}

/**
 * Helper to set up a vault handle with initialization and unlock.
 */
async function setupHandle(owner: string, passphrase: string) {
  const handle = createVaultHandle({ owner });
  await handle.initialize({ passphrase });
  await handle.unlockWithPassphrase({ passphrase });
  return handle;
}

describe('pushLocalVaultMeta', () => {
  // ===== Case 1: Server holds no Vault Meta (getVaultMeta 404) =====

  test('1: PUTs with no ifMatch when server holds no Vault Meta and returns {kind: "pushed"}', async () => {
    const api = createApiDouble();
    // getVaultMeta rejects with 404, so getServerVaultMeta returns null
    const notFoundError = new Error('Not Found') as Error & {
      response?: { status: number };
    };
    notFoundError.response = { status: 404 };
    api.getVaultMeta.mockRejectedValue(notFoundError);

    // putVaultMeta resolves with new etag
    api.putVaultMeta.mockResolvedValue({
      data: { etag: 'etag-new', updatedAt: 't1' },
    } as AxiosResponse);

    const meta = makeServerMeta();
    const result = await pushLocalVaultMeta({
      api,
      meta,
      baseHash: undefined,
    });

    expect(result).toEqual({ kind: 'pushed' });
    expect(api.putVaultMeta).toHaveBeenCalledTimes(1);
    expect(api.putVaultMeta).toHaveBeenCalledWith({
      putVaultMetaRequest: { meta },
      ifMatch: undefined,
    });
  });

  // ===== Case 2: Server meta equals local meta =====

  test('2: returns {kind: "noop-already-in-sync"} when server meta equals local meta and does NOT call putVaultMeta', async () => {
    const api = createApiDouble();
    const meta = makeServerMeta();
    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-server', updatedAt: 't1', meta },
    } as AxiosResponse);

    const result = await pushLocalVaultMeta({
      api,
      meta,
      baseHash: 'any-hash',
    });

    expect(result).toEqual({ kind: 'noop-already-in-sync' });
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Case 3: Server meta differs, difference is not pushable (different-vault) =====

  test('3: returns {kind: "refused-not-pushable", change: "different-vault"} when kdf_salt differs and does NOT call putVaultMeta even when baseHash matches', async () => {
    const api = createApiDouble();
    const localMeta = makeServerMeta();
    const serverMeta = makeServerMeta({ kdf_salt: 'different-salt' });
    const serverHash = await hashVaultMeta(serverMeta);

    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-server', updatedAt: 't1', meta: serverMeta },
    } as AxiosResponse);

    const result = await pushLocalVaultMeta({
      api,
      meta: localMeta,
      baseHash: serverHash,
    });

    expect(result).toEqual({
      kind: 'refused-not-pushable',
      change: 'different-vault',
    });
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Case 4: Server meta differs, baseHash undefined =====

  test('4: returns {kind: "refused-no-base"} when server meta differs and baseHash is undefined', async () => {
    const api = createApiDouble();
    const localMeta = makeServerMeta();
    const serverMeta = makeServerMeta({
      wrapped_mk_passphrase: {
        version: 1,
        iv: 'different-iv',
        ciphertext: 'different-ct',
      },
    });

    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-server', updatedAt: 't1', meta: serverMeta },
    } as AxiosResponse);

    const result = await pushLocalVaultMeta({
      api,
      meta: localMeta,
      baseHash: undefined,
    });

    expect(result).toEqual({ kind: 'refused-no-base' });
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Case 5: Server meta differs, baseHash does not match server's hash =====

  test('5: returns {kind: "refused-server-moved", change: "passphrase"} when baseHash does not match server hash', async () => {
    const api = createApiDouble();
    const localMeta = makeServerMeta();
    const serverMeta = makeServerMeta({
      wrapped_mk_passphrase: {
        version: 1,
        iv: 'different-iv',
        ciphertext: 'different-ct',
      },
    });

    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-server', updatedAt: 't1', meta: serverMeta },
    } as AxiosResponse);

    const result = await pushLocalVaultMeta({
      api,
      meta: localMeta,
      baseHash: 'wrong-hash',
    });

    expect(result).toEqual({
      kind: 'refused-server-moved',
      change: 'passphrase',
    });
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Case 6: Server meta differs, baseHash matches, PUT succeeds =====

  test('6: PUTs with ifMatch equal to server ETag when baseHash matches and returns {kind: "pushed"}', async () => {
    const api = createApiDouble();
    const localMeta = makeServerMeta();
    const serverMeta = makeServerMeta({
      wrapped_mk_passphrase: {
        version: 1,
        iv: 'different-iv',
        ciphertext: 'different-ct',
      },
    });
    const serverHash = await hashVaultMeta(serverMeta);

    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-server-proof', updatedAt: 't1', meta: serverMeta },
    } as AxiosResponse);

    api.putVaultMeta.mockResolvedValue({
      data: { etag: 'etag-new', updatedAt: 't2' },
    } as AxiosResponse);

    const result = await pushLocalVaultMeta({
      api,
      meta: localMeta,
      baseHash: serverHash,
    });

    expect(result).toEqual({ kind: 'pushed' });
    expect(api.putVaultMeta).toHaveBeenCalledTimes(1);
    expect(api.putVaultMeta).toHaveBeenCalledWith({
      putVaultMetaRequest: { meta: localMeta },
      ifMatch: 'etag-server-proof',
    });
  });

  // ===== Case 7: PUT rejects with 409, onConflict returns 'keep-remote' =====

  test('7: returns {kind: "refused-server-moved"} when PUT returns 409 and onConflict keeps remote, and putVaultMeta is NOT called a second time', async () => {
    const api = createApiDouble();
    const localMeta = makeServerMeta();
    const serverMeta = makeServerMeta({
      wrapped_mk_passphrase: {
        version: 1,
        iv: 'different-iv',
        ciphertext: 'different-ct',
      },
    });
    const serverHash = await hashVaultMeta(serverMeta);

    // Order-independent rather than a queue of `*Once()` calls: the real
    // conflict path reads the server twice (once before the PUT, once inside
    // the 409 branch) and both reads see the same server meta, so there is
    // nothing for an ordered queue to express.
    api.getVaultMeta.mockImplementation(() =>
      Promise.resolve({
        data: { etag: 'etag-server-proof', updatedAt: 't1', meta: serverMeta },
      } as AxiosResponse),
    );

    // Every PUT conflicts. If the conflict were force-retried, this would
    // reject a second time and the call count below would be 2.
    const conflictError = new Error('Conflict') as Error & {
      response?: { status: number };
    };
    conflictError.response = { status: 409 };
    api.putVaultMeta.mockRejectedValue(conflictError);

    const result = await pushLocalVaultMeta({
      api,
      meta: localMeta,
      baseHash: serverHash,
    });

    expect(result).toEqual({
      kind: 'refused-server-moved',
      change: 'passphrase',
    });
    // putVaultMeta should be called exactly once (the conflict is not retried)
    expect(api.putVaultMeta).toHaveBeenCalledTimes(1);
  });

  // ===== Case 8: getVaultMeta rejects with 401 =====

  test('8: returns {kind: "skipped-not-authenticated"} on 401 error without throwing', async () => {
    const api = createApiDouble();
    const error = new Error('Unauthorized') as Error & {
      response?: { status: number };
    };
    error.response = { status: 401 };
    api.getVaultMeta.mockRejectedValue(error);

    const result = await pushLocalVaultMeta({
      api,
      meta: makeServerMeta(),
      baseHash: 'any-hash',
    });

    expect(result).toEqual({ kind: 'skipped-not-authenticated' });
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Case 9: getVaultMeta rejects with 403 =====

  test('8b: returns {kind: "skipped-not-authenticated"} on 403 error without throwing', async () => {
    const api = createApiDouble();
    const error = new Error('Forbidden') as Error & {
      response?: { status: number };
    };
    error.response = { status: 403 };
    api.getVaultMeta.mockRejectedValue(error);

    const result = await pushLocalVaultMeta({
      api,
      meta: makeServerMeta(),
      baseHash: 'any-hash',
    });

    expect(result).toEqual({ kind: 'skipped-not-authenticated' });
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Case 9: getVaultMeta rejects with 500 =====

  test('9: rethrows on 500 error', async () => {
    const api = createApiDouble();
    const error = new Error('Server error') as Error & {
      response?: { status: number };
    };
    error.response = { status: 500 };
    api.getVaultMeta.mockRejectedValue(error);

    await expect(
      pushLocalVaultMeta({
        api,
        meta: makeServerMeta(),
        baseHash: 'any-hash',
      }),
    ).rejects.toThrow('Server error');
  });
});

describe('changePassphraseWithCurrent', () => {
  const owner = 'test-owner';
  const passphrase = 'old-pass';
  const currentPassphrase = 'old-pass';
  const newPassphrase = 'new-pass';

  // ===== Case A: Happy path =====

  test('A: happy path mirrors resetPassphraseAfterRecovery: changes local wrapping, records base before push, pushes new meta, and records new agreement on success', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();

    // Capture base meta before change
    const before = handle.loadVault();
    expect(before).not.toBeNull();
    const saltBefore = before!.kdf.salt;

    // getVaultMeta rejects with 404, so getServerVaultMeta returns null
    const notFoundError = new Error('Not Found') as Error & {
      response?: { status: number };
    };
    notFoundError.response = { status: 404 };
    api.getVaultMeta.mockRejectedValue(notFoundError);

    api.putVaultMeta.mockResolvedValue({
      data: { etag: 'etag-new', updatedAt: 't1' },
    } as AxiosResponse);

    const result = await changePassphraseWithCurrent({
      api,
      handle,
      currentPassphrase,
      newPassphrase,
    });

    expect(result).toEqual({
      changedLocally: true,
      push: { kind: 'pushed' },
    });

    // Verify new passphrase works
    const newHandle = createVaultHandle({ owner });
    await newHandle.unlockWithPassphrase({ passphrase: newPassphrase });
    expect(newHandle.loadVault()).not.toBeNull();

    // Verify bookmark is set to new meta
    const newMeta = handle.loadVault();
    const newMetaHash = await hashVaultMeta(localToServerMeta(newMeta!));
    expect(handle.lastAgreedVaultMetaHash()).toBe(newMetaHash);

    // Verify kdf.salt is byte-identical before and after
    expect(newMeta!.kdf.salt).toBe(saltBefore);
  });

  // ===== Case B: Wrong current passphrase =====

  test('B: wrong current passphrase throws VaultSecretMismatchError, does NOT call putVaultMeta, and Vault Meta Bookmark is unchanged', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();

    // Record bookmark before the failed call
    const baseLocalMeta = localToServerMeta(handle.loadVault()!);
    await handle.recordVaultMetaAgreement({ meta: baseLocalMeta });
    const baseBookmarkHash = handle.lastAgreedVaultMetaHash();

    // Capture Local Vault state before the failed call to verify byte-identical
    const vaultBefore = handle.loadVault()!;
    const stateBefore = {
      masterKeyWrappedWithPassphrase:
        vaultBefore.masterKeyWrappedWithPassphrase,
      masterKeyWrappedWithRecoveryKey:
        vaultBefore.masterKeyWrappedWithRecoveryKey,
      kdf: vaultBefore.kdf,
      data: vaultBefore.data,
    };
    // Deep-copied so the comparison below cannot be a live object compared
    // against itself. JSON round-trip rather than structuredClone: jsdom does
    // not expose the latter, and every field here is already a string or a
    // number — an EncryptedBlob is base64 text, not bytes — so nothing is lost.
    const stateBeforeSnapshot = JSON.parse(
      JSON.stringify(stateBefore),
    ) as typeof stateBefore;

    // Attempt with wrong passphrase
    await expect(
      changePassphraseWithCurrent({
        api,
        handle,
        currentPassphrase: 'wrong-pass',
        newPassphrase,
      }),
    ).rejects.toThrow(VaultSecretMismatchError);

    // Verify putVaultMeta was never called
    expect(api.putVaultMeta).not.toHaveBeenCalled();

    // Verify bookmark is still the base hash
    expect(handle.lastAgreedVaultMetaHash()).toBe(baseBookmarkHash);

    // Verify Local Vault is byte-identical (no rewrap happened)
    const vaultAfter = handle.loadVault()!;
    const stateAfter = {
      masterKeyWrappedWithPassphrase: vaultAfter.masterKeyWrappedWithPassphrase,
      masterKeyWrappedWithRecoveryKey:
        vaultAfter.masterKeyWrappedWithRecoveryKey,
      kdf: vaultAfter.kdf,
      data: vaultAfter.data,
    };
    expect(stateAfter).toEqual(stateBeforeSnapshot);
  });

  // ===== Case C: Push fails but local change persists =====

  test('C: push transport error returns {changedLocally: true, push: {kind: "unreachable"}}, local vault has new wrapping, and new passphrase works', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();

    const transportError = new Error('Network error') as Error & {
      response?: { status: number };
    };
    transportError.response = { status: 500 };
    api.getVaultMeta.mockRejectedValue(transportError);

    const result = await changePassphraseWithCurrent({
      api,
      handle,
      currentPassphrase,
      newPassphrase,
    });

    expect(result).toEqual({
      changedLocally: true,
      push: { kind: 'unreachable' },
    });

    // Verify new passphrase works locally
    const newHandle = createVaultHandle({ owner });
    await newHandle.unlockWithPassphrase({ passphrase: newPassphrase });
    expect(newHandle.loadVault()).not.toBeNull();
  });
});

describe('resetPassphraseAfterRecovery', () => {
  const owner = 'test-owner';
  const passphrase = 'old-pass';
  const newPassphrase = 'new-pass';

  // ===== Case 10: Happy path =====

  test('10: happy path changes local wrapping, records base before push, pushes new meta, and records new agreement on success', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();

    // Capture base meta before change
    const before = handle.loadVault();
    expect(before).not.toBeNull();
    const saltBefore = before!.kdf.salt;

    // getVaultMeta rejects with 404, so getServerVaultMeta returns null
    const notFoundError = new Error('Not Found') as Error & {
      response?: { status: number };
    };
    notFoundError.response = { status: 404 };
    api.getVaultMeta.mockRejectedValue(notFoundError);

    api.putVaultMeta.mockResolvedValue({
      data: { etag: 'etag-new', updatedAt: 't1' },
    } as AxiosResponse);

    const result = await resetPassphraseAfterRecovery({
      api,
      handle,
      newPassphrase,
    });

    expect(result).toEqual({
      changedLocally: true,
      push: { kind: 'pushed' },
    });

    // Verify new passphrase works
    const newHandle = createVaultHandle({ owner });
    await newHandle.unlockWithPassphrase({ passphrase: newPassphrase });
    expect(newHandle.loadVault()).not.toBeNull();

    // Verify bookmark is set to new meta
    const newMeta = handle.loadVault();
    const newMetaHash = await hashVaultMeta(localToServerMeta(newMeta!));
    expect(handle.lastAgreedVaultMetaHash()).toBe(newMetaHash);

    // Verify kdf.salt is byte-identical before and after (passphrase change does not mint a fresh salt)
    expect(newMeta!.kdf.salt).toBe(saltBefore);
  });

  // ===== Case 11: Push throws transport error =====

  test('11: push transport error returns {changedLocally: true, push: {kind: "unreachable"}}, local vault has new wrapping, and bookmark holds base hash', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();

    const before = handle.loadVault();
    const baseHash = await hashVaultMeta(localToServerMeta(before!));

    const transportError = new Error('Network error') as Error & {
      response?: { status: number };
    };
    transportError.response = { status: 500 };
    api.getVaultMeta.mockRejectedValue(transportError);

    const result = await resetPassphraseAfterRecovery({
      api,
      handle,
      newPassphrase,
    });

    expect(result).toEqual({
      changedLocally: true,
      push: { kind: 'unreachable' },
    });

    // Verify new passphrase works (local change persisted)
    const newHandle = createVaultHandle({ owner });
    await newHandle.unlockWithPassphrase({ passphrase: newPassphrase });
    expect(newHandle.loadVault()).not.toBeNull();

    // Verify bookmark holds the BASE hash, not the new one
    expect(handle.lastAgreedVaultMetaHash()).toBe(baseHash);
  });

  // ===== Case 12: Push refused because server moved =====

  test('12: push refused-server-moved returns that result, and bookmark holds base hash', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();

    const before = handle.loadVault();
    const baseHash = await hashVaultMeta(localToServerMeta(before!));

    // Mock: Create a server meta that differs from the base only in the passphrase wrapping.
    // changePassphrase will rewrap the local passphrase (creating new wrapped_mk_passphrase).
    // The server has a DIFFERENT passphrase wrapping (same vault, different wrapping),
    // so pushLocalVaultMeta will find the hash doesn't match base and refuse.
    // We need to use the exact same base but with different wrapped_mk_passphrase.
    const baseMeta = localToServerMeta(before!);
    const serverMeta = {
      ...baseMeta,
      wrapped_mk_passphrase: {
        version: 1 as const,
        iv: 'server-iv-different',
        ciphertext: 'server-ct-different',
      },
    };

    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-server', updatedAt: 't1', meta: serverMeta },
    } as AxiosResponse);

    const result = await resetPassphraseAfterRecovery({
      api,
      handle,
      newPassphrase,
    });

    expect(result.changedLocally).toBe(true);
    expect(result.push).toEqual({
      kind: 'refused-server-moved',
      change: 'passphrase',
    });

    // Verify bookmark still holds base hash (not new hash)
    expect(handle.lastAgreedVaultMetaHash()).toBe(baseHash);
  });

  // ===== Case 13: Locked handle =====

  test('13: locked handle rejects VaultLockedError without calling putVaultMeta', async () => {
    const handle = createVaultHandle({ owner });
    // Never initialize or unlock, so handle is locked
    const api = createApiDouble();

    await expect(
      resetPassphraseAfterRecovery({
        api,
        handle,
        newPassphrase,
      }),
    ).rejects.toThrow();

    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });
});

describe('settleVaultMeta', () => {
  const owner = 'test-owner';
  const passphrase = 'vault-pass';

  // ===== Case 14: No local vault =====

  test('14: returns {kind: "skipped-no-local-vault"} when handle has no vault, and does NOT call api', async () => {
    const handle = createVaultHandle({ owner });
    const api = createApiDouble();

    const result = await settleVaultMeta({
      api,
      handle,
      prompt: jest.fn(),
    });

    expect(result).toEqual({ kind: 'skipped-no-local-vault' });
    expect(api.getVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Case 15: Bookmark absent (device never agreed) =====

  test('15: bookmark absent falls through to converge, returns {kind: "converged", ...}, and does NOT call putVaultMeta', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const prompt = jest.fn().mockResolvedValue('defer');

    // getVaultMeta rejects with 404, so getServerVaultMeta returns null
    const notFoundError = new Error('Not Found') as Error & {
      response?: { status: number };
    };
    notFoundError.response = { status: 404 };
    api.getVaultMeta.mockRejectedValue(notFoundError);

    const result = await settleVaultMeta({
      api,
      handle,
      prompt,
    });

    expect(result.kind).toBe('converged');
    expect(result).toHaveProperty('result');
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Case 16: Bookmark present, server still on base, local differs (retry case) =====

  test('16: bookmark present, server on base, local differs pushes new wrapping, does NOT call prompt, and bookmark holds new meta hash', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const prompt = jest.fn();

    // Record base meta
    const baseLocalMeta = localToServerMeta(handle.loadVault()!);
    await handle.recordVaultMetaAgreement({ meta: baseLocalMeta });

    // Change passphrase locally
    await handle.resetPassphrase({ newPassphrase: 'new-pass' });

    // Server still holds the base
    const serverMeta = baseLocalMeta;
    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-server', updatedAt: 't1', meta: serverMeta },
    } as AxiosResponse);

    api.putVaultMeta.mockResolvedValue({
      data: { etag: 'etag-new', updatedAt: 't2' },
    } as AxiosResponse);

    const result = await settleVaultMeta({
      api,
      handle,
      prompt,
    });

    expect(result).toEqual({ kind: 'pushed-local-wrapping' });
    expect(prompt).not.toHaveBeenCalled();

    // Verify bookmark holds new meta hash
    const newMeta = localToServerMeta(handle.loadVault()!);
    const newMetaHash = await hashVaultMeta(newMeta);
    expect(handle.lastAgreedVaultMetaHash()).toBe(newMetaHash);
  });

  // ===== Case 17: Bookmark present, local identity equals server identity =====

  test('17: bookmark present, local already in sync with server returns {kind: "noop-already-in-sync"}, does NOT call prompt, and does NOT call putVaultMeta', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const prompt = jest.fn();

    const localMeta = localToServerMeta(handle.loadVault()!);
    await handle.recordVaultMetaAgreement({ meta: localMeta });

    // Server holds same meta
    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-server', updatedAt: 't1', meta: localMeta },
    } as AxiosResponse);

    const result = await settleVaultMeta({
      api,
      handle,
      prompt,
    });

    expect(result).toEqual({ kind: 'noop-already-in-sync' });
    expect(prompt).not.toHaveBeenCalled();
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Case 18: Bookmark present, server moved off base, differs from local =====

  test('18: bookmark present, server moved AND differs from local falls through to converge, calls prompt, and does NOT call putVaultMeta', async () => {
    const handle = await setupHandle(owner, passphrase);
    const api = createApiDouble();
    const prompt = jest.fn().mockResolvedValue('defer');

    const baseLocalMeta = localToServerMeta(handle.loadVault()!);
    await handle.recordVaultMetaAgreement({ meta: baseLocalMeta });

    // Change passphrase locally
    await handle.resetPassphrase({ newPassphrase: 'new-pass' });

    // Server holds a completely different meta (different salt = different vault)
    const differentServerMeta = makeServerMeta({ kdf_salt: 'different-salt' });
    api.getVaultMeta.mockResolvedValue({
      data: { etag: 'etag-server', updatedAt: 't1', meta: differentServerMeta },
    } as AxiosResponse);

    const result = await settleVaultMeta({
      api,
      handle,
      prompt,
    });

    expect(result.kind).toBe('converged');
    expect(prompt).toHaveBeenCalled();
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });
});
