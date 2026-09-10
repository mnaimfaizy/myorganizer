/**
 * Tests for Vault Meta and Blob convergence immediately after claiming an Unclaimed
 * Local Vault (via evidence or recovery key) when the Master Key is not yet bound.
 *
 * GitHub Issue #615: Vault Meta convergence and Vault Blob convergence must be guarded
 * against overwriting or overriding a freshly-claimed, locked Vault. This suite pins
 * that the server-known state is taken when unconflicted, deferred when conflicted,
 * and the Vault status and ciphertext remain intact through both paths.
 *
 * The claim functions do not bind the Master Key on the handle under test (or do so
 * only on the route that unwraps the recovery key, which is then reloaded); this
 * suite uses REAL WebCrypto, real localStorage, and real claim functions to establish
 * that the locked state is genuinely reached and that convergence respects it.
 */

import type { AxiosResponse } from 'axios';
import {
  VaultBlobType,
  type GetVaultMetaResponse,
  type VaultMetaV1,
} from '@myorganizer/app-api-client';
import {
  type VaultBlobEnvelope,
  readVaultBlobRecords,
} from '@myorganizer/core';

import {
  claimUnclaimedLocalVaultOnEvidence,
  claimUnclaimedLocalVaultWithRecoveryKey,
} from './vaultClaimEvidence';
import { createVaultHandle } from './vaultHandle';
import {
  convergeVaultBlob,
  type VaultBlobConvergePrompt,
} from './vaultConverge';
import { settleVaultMeta, pushLocalVaultMeta } from './vaultMetaPush';
import { type VaultMetaConvergePrompt } from './vaultMetaConverge';
import type { ServerVaultBlob, ServerVaultMeta } from './serverVaultSync';
import { localToServerMeta, toEncryptedBlobV1 } from './vaultShapes';
import {
  VAULT_STORAGE_KEY,
  localVaultStorageKey,
  type VaultStorageV1,
} from './localVaultStorage';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

const remoteTaskPayload = [
  {
    id: 'task-2',
    title: 'Remote task',
    status: 'done',
    priority: 'low',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('vaultClaimedVaultConverge', () => {
  const passphrase = 'claimtest123';
  const testOwner = 'test-owner-id';

  /**
   * Helper to create a properly typed API double for vault meta operations.
   */
  function createMetaApiDouble() {
    return {
      getVaultMeta: jest.fn<Promise<AxiosResponse>, []>(),
      putVaultMeta: jest.fn<Promise<AxiosResponse>, []>(),
    };
  }

  /**
   * Helper to create a properly typed API double for vault blob operations.
   */
  function createBlobApiDouble() {
    return {
      getVaultBlob: jest.fn<Promise<AxiosResponse>, []>(),
      putVaultBlob: jest.fn<Promise<AxiosResponse>, []>(),
    };
  }

  /**
   * Helper to format axios response.
   */
  function axiosResponse<T>(data: T): AxiosResponse<T> {
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { headers: {} as any },
    } as unknown as AxiosResponse<T>;
  }

  /**
   * Seed an unclaimed local vault (optionally with task ciphertext).
   * Returns vault object, raw JSON string, and recovery key.
   * Callers can use any combination of the returned values.
   */
  async function seedUnclaimedLocalVault(
    seedPassphrase: string,
    withTasks = false,
  ): Promise<{
    vault: VaultStorageV1;
    raw: string;
    recoveryKey: string;
  }> {
    const throwawayOwner = `throwaway-${Math.random().toString(36).slice(2)}`;
    const handle = createVaultHandle({ owner: throwawayOwner });
    const { recoveryKey } = await handle.initialize({
      passphrase: seedPassphrase,
    });

    if (withTasks) {
      // Unlock and save task data
      await handle.unlockWithPassphrase({ passphrase: seedPassphrase });
      const taskPayload = [
        {
          id: 'task-1',
          title: 'Local task',
          status: 'todo',
          priority: 'high',
          archived: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      const envelope: VaultBlobEnvelope<unknown> = {
        records: taskPayload,
        deletions: {},
      };
      await handle.saveEncryptedData({ type: 'tasks', value: envelope });
    }

    // Move to unclaimed slot
    const vault = handle.loadVault();
    if (!vault) {
      throw new Error('Failed to load vault');
    }

    const ownedKey = localVaultStorageKey(throwawayOwner);
    localStorage.removeItem(ownedKey);
    const raw = JSON.stringify(vault);
    localStorage.setItem(VAULT_STORAGE_KEY, raw);

    return { vault, raw, recoveryKey };
  }

  /**
   * Create a ServerVaultMeta that matches a handle's local vault meta.
   */
  function serverMetaFor(
    handle: ReturnType<typeof createVaultHandle>,
    etag = 'meta-etag',
  ): ServerVaultMeta {
    const vault = handle.loadVault();
    if (!vault) throw new Error('Handle has no vault');
    return {
      etag,
      updatedAt: '2026-01-01T00:00:00.000Z',
      meta: localToServerMeta(vault),
    };
  }

  /**
   * Capture a remote blob that genuinely decrypts under the same Master Key.
   */
  async function captureRemoteBlob(
    handle: ReturnType<typeof createVaultHandle>,
    payload: unknown,
  ): Promise<ServerVaultBlob> {
    // Save current local data
    const vault = handle.loadVault();
    if (!vault) throw new Error('Handle has no vault');
    const originalData = { ...vault.data };

    // Save remote payload
    const envelope: VaultBlobEnvelope<unknown> = {
      records: payload,
      deletions: {},
    };
    await handle.saveEncryptedData({ type: 'tasks', value: envelope });

    // Capture ciphertext
    const remoteVault = handle.loadVault();
    const encryptedBlob = remoteVault?.data.tasks;
    if (!encryptedBlob) {
      throw new Error('Failed to save test blob for type tasks');
    }

    // Restore original local data
    vault.data = originalData;
    handle.saveVault(vault);

    return {
      etag: 'etag-remote',
      updatedAt: '2026-01-01T00:00:00.000Z',
      type: VaultBlobType.Tasks,
      blob: toEncryptedBlobV1(encryptedBlob),
    };
  }

  /**
   * Claim an unclaimed local vault via evidence route.
   * Returns a locked, owned handle ready for testing convergence behaviors.
   * Throws if the claim did not succeed.
   */
  async function claimViaEvidence(
    fixture: Awaited<ReturnType<typeof seedUnclaimedLocalVault>>,
  ): Promise<ReturnType<typeof createVaultHandle>> {
    const claimHandle = createVaultHandle({ owner: testOwner });
    const api = createMetaApiDouble();
    api.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'meta-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: localToServerMeta(fixture.vault),
      } as GetVaultMetaResponse),
    );

    const claimResult = await claimUnclaimedLocalVaultOnEvidence({
      api,
      handle: claimHandle,
    });

    if (claimResult.kind !== 'claimed') {
      throw new Error(`Expected claimed, got ${claimResult.kind}`);
    }

    return claimHandle;
  }

  /**
   * Claim an unclaimed local vault via recovery key route.
   * Returns a locked, owned handle ready for testing convergence behaviors.
   * Throws if the claim did not succeed.
   */
  async function claimViaRecoveryKey(
    fixture: Awaited<ReturnType<typeof seedUnclaimedLocalVault>>,
  ): Promise<ReturnType<typeof createVaultHandle>> {
    const claimHandle = createVaultHandle({ owner: testOwner });
    const claimResult = await claimUnclaimedLocalVaultWithRecoveryKey({
      handle: claimHandle,
      recoveryKey: fixture.recoveryKey,
    });

    if (claimResult.kind !== 'claimed') {
      throw new Error(`Expected claimed, got ${claimResult.kind}`);
    }

    return claimHandle;
  }

  // ===== Group A: Meta push guards =====

  test('A1: After evidence-claim with no baseHash, settleVaultMeta skips push and converges when server meta is identical', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, false);

    // Claim via evidence (locked)
    const claimHandle = await claimViaEvidence(fixture);

    // After claim: locked, owned, but no Vault Meta Bookmark yet (no baseHash)
    // Because the Vault Meta Bookmark — not lock state — is what guards pushes
    expect(claimHandle.isUnlocked).toBe(false);
    expect(claimHandle.vaultStatus()).toBe('owned');
    expect(claimHandle.lastAgreedVaultMetaHash()).toBeUndefined();

    // Settle with identical server meta: no push is attempted (no baseHash to prove
    // the base), so convergence proceeds directly to meta adoption
    const settleApi = createMetaApiDouble();
    settleApi.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'meta-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: localToServerMeta(fixture.vault),
      } as GetVaultMetaResponse),
    );
    settleApi.putVaultMeta.mockResolvedValue(
      axiosResponse({}) as AxiosResponse,
    );

    const settlePrompt = jest.fn() as VaultMetaConvergePrompt;

    const settleResult = await settleVaultMeta({
      api: settleApi,
      handle: claimHandle,
      prompt: settlePrompt,
    });

    expect(settleResult.kind).toBe('converged');
    expect(settleApi.putVaultMeta).not.toHaveBeenCalled();
    expect(settlePrompt).not.toHaveBeenCalled();
  });

  test('A2: After evidence-claim with no baseHash, pushLocalVaultMeta with identical server meta returns noop and does not push', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, false);

    // Claim via evidence (locked)
    const claimHandle = await claimViaEvidence(fixture);
    expect(claimHandle.isUnlocked).toBe(false);
    expect(claimHandle.vaultStatus()).toBe('owned');

    // Freshly claimed Vault has no Vault Meta Bookmark (no baseHash) yet
    // Push with identical server meta and no baseHash: identities match,
    // so no push attempt is made (both sides already in sync)
    const pushApi = createMetaApiDouble();
    pushApi.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'meta-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: localToServerMeta(fixture.vault),
      } as GetVaultMetaResponse),
    );
    pushApi.putVaultMeta.mockResolvedValue(axiosResponse({}) as AxiosResponse);

    const pushResult = await pushLocalVaultMeta({
      api: pushApi,
      meta: localToServerMeta(fixture.vault),
      baseHash: undefined,
    });

    expect(pushResult.kind).toBe('noop-already-in-sync');
    expect(pushApi.putVaultMeta).not.toHaveBeenCalled();
  });

  test('A3: After recovery-key claim with fresh reloaded (locked) handle and no baseHash, settleVaultMeta skips push and converges when server meta is identical', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via recovery key
    await claimViaRecoveryKey(fixture);

    // Reload: fresh handle (no masterKeyBytes) for same owner
    const freshHandle = createVaultHandle({ owner: testOwner });
    expect(freshHandle.isUnlocked).toBe(false);
    expect(freshHandle.vaultStatus()).toBe('owned');
    // No Vault Meta Bookmark yet (no baseHash)
    expect(freshHandle.lastAgreedVaultMetaHash()).toBeUndefined();

    // Settle with identical server meta on the fresh (locked) handle:
    // no push is attempted (no baseHash), convergence proceeds to adoption
    const settleApi = createMetaApiDouble();
    settleApi.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'meta-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: localToServerMeta(fixture.vault),
      } as GetVaultMetaResponse),
    );
    settleApi.putVaultMeta.mockResolvedValue(
      axiosResponse({}) as AxiosResponse,
    );

    const settlePrompt = jest.fn() as VaultMetaConvergePrompt;

    const settleResult = await settleVaultMeta({
      api: settleApi,
      handle: freshHandle,
      prompt: settlePrompt,
    });

    expect(settleResult.kind).toBe('converged');
    expect(settleApi.putVaultMeta).not.toHaveBeenCalled();
  });

  test('A4: After evidence-claim with no baseHash, pushLocalVaultMeta returns refused-no-base when server meta differs in a pushable way', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, false);

    // Claim via evidence (locked, no baseHash)
    const claimHandle = await claimViaEvidence(fixture);
    expect(claimHandle.isUnlocked).toBe(false);
    expect(claimHandle.vaultStatus()).toBe('owned');
    expect(claimHandle.lastAgreedVaultMetaHash()).toBeUndefined();

    // Server meta differs in passphrase wrapping (same salt, different wrapped_mk_passphrase)
    const localMeta = localToServerMeta(fixture.vault);
    const serverMeta: VaultMetaV1 = {
      ...localMeta,
      wrapped_mk_passphrase: {
        version: 1,
        iv: 'different-iv',
        ciphertext: 'different-ciphertext',
      },
    };

    // Without a baseHash to prove what the base was, even a pushable difference
    // refuses the push (cannot prove the server has not moved)
    const pushApi = createMetaApiDouble();
    pushApi.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'meta-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: serverMeta,
      } as GetVaultMetaResponse),
    );
    pushApi.putVaultMeta.mockResolvedValue(axiosResponse({}) as AxiosResponse);

    const pushResult = await pushLocalVaultMeta({
      api: pushApi,
      meta: localMeta,
      baseHash: undefined,
    });

    expect(pushResult.kind).toBe('refused-no-base');
    expect(pushApi.putVaultMeta).not.toHaveBeenCalled();
  });

  test('A5: After recovery-key claim with fresh reloaded (locked) handle and no baseHash, pushLocalVaultMeta returns refused-no-base when server meta differs in a pushable way', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via recovery key
    await claimViaRecoveryKey(fixture);

    // Reload with fresh handle (no masterKeyBytes, no baseHash)
    const freshHandle = createVaultHandle({ owner: testOwner });
    expect(freshHandle.isUnlocked).toBe(false);
    expect(freshHandle.vaultStatus()).toBe('owned');
    expect(freshHandle.lastAgreedVaultMetaHash()).toBeUndefined();

    // Server meta differs in passphrase wrapping (same salt, different wrapped_mk_passphrase)
    const localMeta = localToServerMeta(fixture.vault);
    const serverMeta: VaultMetaV1 = {
      ...localMeta,
      wrapped_mk_passphrase: {
        version: 1,
        iv: 'different-iv',
        ciphertext: 'different-ciphertext',
      },
    };

    // Without a baseHash, push is refused (cannot prove the base)
    const pushApi = createMetaApiDouble();
    pushApi.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'meta-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: serverMeta,
      } as GetVaultMetaResponse),
    );
    pushApi.putVaultMeta.mockResolvedValue(axiosResponse({}) as AxiosResponse);

    const pushResult = await pushLocalVaultMeta({
      api: pushApi,
      meta: localMeta,
      baseHash: undefined,
    });

    expect(pushResult.kind).toBe('refused-no-base');
    expect(pushApi.putVaultMeta).not.toHaveBeenCalled();
  });

  test('A6: Recovery-key claim returns an unlocked, owned handle; reloaded fresh handle is locked', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via recovery key: the recovery key proves ownership, so the Master Key
    // is unwrapped and bound to the claiming handle
    const claimHandle = createVaultHandle({ owner: testOwner });
    const claimResult = await claimUnclaimedLocalVaultWithRecoveryKey({
      handle: claimHandle,
      recoveryKey: fixture.recoveryKey,
    });

    // The claimed handle should be unlocked with the Master Key bound
    if (claimResult.kind !== 'claimed') {
      throw new Error(`Expected claimed, got ${claimResult.kind}`);
    }
    expect(claimResult.masterKeyBytes).toBeInstanceOf(Uint8Array);
    expect(claimHandle.isUnlocked).toBe(true);
    expect(claimHandle.vaultStatus()).toBe('owned');

    // A fresh handle for the same owner reads back locked (Master Key not bound)
    const freshHandle = createVaultHandle({ owner: testOwner });
    expect(freshHandle.isUnlocked).toBe(false);
    expect(freshHandle.vaultStatus()).toBe('owned');
  });

  test('A7: After evidence-claim with Vault Meta Bookmark, pushLocalVaultMeta attempts push when base matches', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, false);

    // Claim via evidence (locked, no baseHash initially)
    const claimHandle = await claimViaEvidence(fixture);
    expect(claimHandle.isUnlocked).toBe(false);
    expect(claimHandle.vaultStatus()).toBe('owned');
    expect(claimHandle.lastAgreedVaultMetaHash()).toBeUndefined();

    // Record current meta as agreed, establishing a Vault Meta Bookmark (baseHash)
    // This proves what the base was and allows a push to proceed if the server
    // still holds it
    const vault = claimHandle.loadVault();
    if (!vault) throw new Error('Failed to load vault after claim');

    const baselineMeta = localToServerMeta(vault);
    await claimHandle.recordVaultMetaAgreement({ meta: baselineMeta });

    const baseHash = claimHandle.lastAgreedVaultMetaHash();
    expect(baseHash).toBeDefined();

    // Create a local meta that differs in a pushable way (passphrase wrapping)
    // This difference means the identities will not match, so the push will be attempted
    const modifiedLocalMeta: VaultMetaV1 = {
      ...baselineMeta,
      wrapped_mk_passphrase: {
        version: 1,
        iv: 'modified-iv',
        ciphertext: 'modified-ciphertext',
      },
    };

    // Mock server to return the baseline meta (matching baseHash)
    // This allows the push to proceed because the baseHash matches what we hold
    const pushApi = createMetaApiDouble();
    pushApi.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'baseline-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: baselineMeta,
      } as GetVaultMetaResponse),
    );
    pushApi.putVaultMeta.mockResolvedValue(axiosResponse({}) as AxiosResponse);

    // Push with modified meta and the baseHash: this should attempt the push
    // because the base matches what we expect, proving the server has not moved,
    // even though the handle is locked
    const pushResult = await pushLocalVaultMeta({
      api: pushApi,
      meta: modifiedLocalMeta,
      baseHash: baseHash as string,
    });

    // putVaultMeta should have been called
    expect(pushApi.putVaultMeta).toHaveBeenCalled();
    // Push succeeds because server holds the expected base
    expect(pushResult.kind).toBe('pushed');
  });

  test('A8: After recovery-key claim with fresh reloaded handle and no baseHash, pushLocalVaultMeta with identical server meta returns noop', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via recovery key
    await claimViaRecoveryKey(fixture);

    // Reload with fresh handle (no masterKeyBytes, no baseHash)
    const freshHandle = createVaultHandle({ owner: testOwner });
    expect(freshHandle.isUnlocked).toBe(false);
    expect(freshHandle.vaultStatus()).toBe('owned');
    expect(freshHandle.lastAgreedVaultMetaHash()).toBeUndefined();

    // Push with identical server meta and no baseHash: both sides already hold it,
    // so no push is attempted (same as A2 but for recovery-key claim)
    const pushApi = createMetaApiDouble();
    pushApi.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'meta-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: localToServerMeta(fixture.vault),
      } as GetVaultMetaResponse),
    );
    pushApi.putVaultMeta.mockResolvedValue(axiosResponse({}) as AxiosResponse);

    const pushResult = await pushLocalVaultMeta({
      api: pushApi,
      meta: localToServerMeta(fixture.vault),
      baseHash: undefined,
    });

    expect(pushResult.kind).toBe('noop-already-in-sync');
    expect(pushApi.putVaultMeta).not.toHaveBeenCalled();
  });

  // ===== Group B: Blob pull does not overwrite/unclaim while locked =====

  test('B1: After evidence-claim on vault with task ciphertext, convergeVaultBlob with conflicted remote defers and does not send', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via evidence (locked)
    const claimHandle = await claimViaEvidence(fixture);

    // Capture local tasks ciphertext before convergence
    const beforeVault = claimHandle.loadVault();
    if (!beforeVault?.data.tasks) {
      throw new Error('Claimed vault has no tasks ciphertext');
    }
    const localTasksCiphertext = beforeVault.data.tasks;

    // Create a different remote blob using an unlocked temp handle
    const tempHandle = createVaultHandle({ owner: testOwner });
    await tempHandle.unlockWithPassphrase({ passphrase });
    const remoteBlob = await captureRemoteBlob(tempHandle, remoteTaskPayload);

    // Converge with locked handle and conflicted remote
    const convergeApi = createBlobApiDouble();
    const convergePrompt = jest.fn() as VaultBlobConvergePrompt;

    const convergeResult = await convergeVaultBlob({
      api: convergeApi,
      handle: claimHandle,
      type: VaultBlobType.Tasks,
      prompt: convergePrompt,
      serverMeta: serverMetaFor(claimHandle),
      remote: remoteBlob,
    });

    expect(convergeResult).toEqual({
      kind: 'nothing',
      reason: 'vault-locked',
    });
    expect(convergeApi.putVaultBlob).not.toHaveBeenCalled();
    expect(convergePrompt).not.toHaveBeenCalled();

    // Verify ciphertext unchanged
    const afterVault = claimHandle.loadVault();
    expect(afterVault?.data.tasks).toEqual(localTasksCiphertext);

    // Verify vault still owned and locked
    expect(claimHandle.vaultStatus()).toBe('owned');
    expect(claimHandle.isUnlocked).toBe(false);
  });

  test('B2: After recovery-key claim with fresh reloaded (locked) handle, convergeVaultBlob with conflicted remote defers and does not send; after deferred, unlock and decrypt yields original payload', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via recovery key
    await claimViaRecoveryKey(fixture);

    // Reload with fresh handle (no masterKeyBytes)
    const freshHandle = createVaultHandle({ owner: testOwner });
    expect(freshHandle.isUnlocked).toBe(false);
    expect(freshHandle.vaultStatus()).toBe('owned');

    // Capture local tasks ciphertext
    const beforeVault = freshHandle.loadVault();
    if (!beforeVault?.data.tasks) {
      throw new Error('Vault has no tasks ciphertext');
    }
    const localTasksCiphertext = beforeVault.data.tasks;

    // Create a different remote blob (need unlocked handle to capture it)
    const tempHandle = createVaultHandle({ owner: testOwner });
    await tempHandle.unlockWithPassphrase({ passphrase });
    const remoteBlob = await captureRemoteBlob(tempHandle, remoteTaskPayload);

    // Converge with fresh (locked) handle and conflicted remote
    const convergeApi = createBlobApiDouble();
    const convergePrompt = jest.fn() as VaultBlobConvergePrompt;

    const convergeResult = await convergeVaultBlob({
      api: convergeApi,
      handle: freshHandle,
      type: VaultBlobType.Tasks,
      prompt: convergePrompt,
      serverMeta: serverMetaFor(freshHandle),
      remote: remoteBlob,
    });

    expect(convergeResult).toEqual({
      kind: 'nothing',
      reason: 'vault-locked',
    });
    expect(convergeApi.putVaultBlob).not.toHaveBeenCalled();
    expect(convergePrompt).not.toHaveBeenCalled();

    // Verify ciphertext unchanged
    const afterVault = freshHandle.loadVault();
    expect(afterVault?.data.tasks).toEqual(localTasksCiphertext);

    // Verify vault still owned and locked
    expect(freshHandle.vaultStatus()).toBe('owned');
    expect(freshHandle.isUnlocked).toBe(false);

    // Now unlock and verify the original local payload is still intact
    await freshHandle.unlockWithPassphrase({ passphrase });
    expect(freshHandle.isUnlocked).toBe(true);

    const decrypted = await freshHandle.loadDecryptedData({
      type: 'tasks',
      defaultValue: null,
    });

    const records = readVaultBlobRecords(decrypted);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-1',
          title: 'Local task',
        }),
      ]),
    );
  });

  test('B3: After evidence-claim on vault with clean task ciphertext, convergeVaultBlob takes different remote and advances bookmark', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via evidence (locked)
    const claimHandle = await claimViaEvidence(fixture);

    // Record a Sync Bookmark so the blob is clean (not unsent).
    // A freshly claimed vault has no bookmarks, so even the unchanged claimed blob reads as dirty.
    // Recording the bookmark makes it clean for convergence to take a different remote.
    await claimHandle.recordPushSuccess({
      type: 'tasks',
      etag: 'etag-claimed',
    });

    // Local has no unsent changes now
    expect(await claimHandle.hasUnsentChanges('tasks')).toBe(false);

    // Create a different remote blob
    // Need to capture remote from an unlocked handle
    const tempHandle = createVaultHandle({ owner: testOwner });
    await tempHandle.unlockWithPassphrase({ passphrase });
    const remoteBlob = await captureRemoteBlob(tempHandle, remoteTaskPayload);

    // Converge with locked handle, clean local, and different remote
    const convergeApi = createBlobApiDouble();
    const convergePrompt = jest.fn() as VaultBlobConvergePrompt;

    const convergeResult = await convergeVaultBlob({
      api: convergeApi,
      handle: claimHandle,
      type: VaultBlobType.Tasks,
      prompt: convergePrompt,
      serverMeta: serverMetaFor(claimHandle),
      remote: remoteBlob,
    });

    expect(convergeResult).toEqual({
      kind: 'took',
      etag: 'etag-remote',
    });
    expect(convergeApi.putVaultBlob).not.toHaveBeenCalled();
    expect(convergePrompt).not.toHaveBeenCalled();

    // Verify vault still owned (claim survives take)
    expect(claimHandle.vaultStatus()).toBe('owned');

    // Verify bookmark advanced
    expect(claimHandle.lastPushedEtag('tasks')).toBe('etag-remote');
    expect(await claimHandle.hasUnsentChanges('tasks')).toBe(false);
  });

  test('B4: After recovery-key claim with fresh reloaded (locked) handle and clean blob, convergeVaultBlob takes different remote and advances bookmark', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via recovery key
    await claimViaRecoveryKey(fixture);

    // Reload with fresh handle (no masterKeyBytes)
    const freshHandle = createVaultHandle({ owner: testOwner });
    expect(freshHandle.isUnlocked).toBe(false);
    expect(freshHandle.vaultStatus()).toBe('owned');

    // Record a Sync Bookmark so the blob is clean
    await freshHandle.recordPushSuccess({
      type: 'tasks',
      etag: 'etag-claimed',
    });

    // Local has no unsent changes now
    expect(await freshHandle.hasUnsentChanges('tasks')).toBe(false);

    // Create a different remote blob using an unlocked temp handle
    const tempHandle = createVaultHandle({ owner: testOwner });
    await tempHandle.unlockWithPassphrase({ passphrase });
    const remoteBlob = await captureRemoteBlob(tempHandle, remoteTaskPayload);

    // Create a fresh locked handle for convergence
    const convergeHandle = createVaultHandle({ owner: testOwner });
    expect(convergeHandle.isUnlocked).toBe(false);
    expect(await convergeHandle.hasUnsentChanges('tasks')).toBe(false);

    // Converge with fresh locked handle, clean local, and different remote
    const convergeApi = createBlobApiDouble();
    const convergePrompt = jest.fn() as VaultBlobConvergePrompt;

    const convergeResult = await convergeVaultBlob({
      api: convergeApi,
      handle: convergeHandle,
      type: VaultBlobType.Tasks,
      prompt: convergePrompt,
      serverMeta: serverMetaFor(convergeHandle),
      remote: remoteBlob,
    });

    expect(convergeResult).toEqual({
      kind: 'took',
      etag: 'etag-remote',
    });
    expect(convergeApi.putVaultBlob).not.toHaveBeenCalled();
    expect(convergePrompt).not.toHaveBeenCalled();

    // Verify vault still owned (claim survives take)
    expect(convergeHandle.vaultStatus()).toBe('owned');

    // Verify bookmark advanced
    expect(convergeHandle.lastPushedEtag('tasks')).toBe('etag-remote');
    expect(await convergeHandle.hasUnsentChanges('tasks')).toBe(false);
  });

  // ===== Group C: Reload survival + intact ciphertext after unlock =====

  test('C1: After evidence-claim with deferred conflict, unlock and decrypt yields original local payload', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via evidence (locked)
    const claimHandle = await claimViaEvidence(fixture);

    // Capture local ciphertext while locked (to verify it stays unchanged)
    const beforeVault = claimHandle.loadVault();
    if (!beforeVault?.data.tasks) {
      throw new Error('Claimed vault has no tasks ciphertext');
    }
    const localTasksCiphertext = beforeVault.data.tasks;

    // Create a different remote blob using an unlocked temp handle
    const tempHandle = createVaultHandle({ owner: testOwner });
    await tempHandle.unlockWithPassphrase({ passphrase });
    const remoteBlob = await captureRemoteBlob(tempHandle, remoteTaskPayload);

    // Converge while locked (defers)
    const convergeApi = createBlobApiDouble();
    const convergeResult = await convergeVaultBlob({
      api: convergeApi,
      handle: claimHandle,
      type: VaultBlobType.Tasks,
      prompt: jest.fn() as VaultBlobConvergePrompt,
      serverMeta: serverMetaFor(claimHandle),
      remote: remoteBlob,
    });

    if (convergeResult.kind !== 'nothing') {
      throw new Error('Expected deferred conflict');
    }

    // Verify ciphertext unchanged while locked
    const midVault = claimHandle.loadVault();
    expect(midVault?.data.tasks).toEqual(localTasksCiphertext);

    // Now unlock
    await claimHandle.unlockWithPassphrase({ passphrase });
    expect(claimHandle.isUnlocked).toBe(true);

    // Decrypt and verify original payload is still there
    const decrypted = await claimHandle.loadDecryptedData({
      type: 'tasks',
      defaultValue: null,
    });

    const records = readVaultBlobRecords(decrypted);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-1',
          title: 'Local task',
        }),
      ]),
    );
  });

  test('C2: After evidence-claim with unconflicted take, unlock and decrypt yields remote payload', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via evidence (locked)
    const claimHandle = await claimViaEvidence(fixture);

    // Record bookmark so local is clean
    await claimHandle.recordPushSuccess({
      type: 'tasks',
      etag: 'etag-claimed',
    });

    // Create a different remote blob
    const tempHandle = createVaultHandle({ owner: testOwner });
    await tempHandle.unlockWithPassphrase({ passphrase });
    const remoteBlob = await captureRemoteBlob(tempHandle, remoteTaskPayload);

    // Create a fresh locked handle for convergence (tempHandle modified localStorage,
    // so we need a fresh view of the vault)
    const convergeHandle = createVaultHandle({ owner: testOwner });
    expect(convergeHandle.isUnlocked).toBe(false);
    expect(await convergeHandle.hasUnsentChanges('tasks')).toBe(false);

    // Converge with fresh locked handle, clean local, and different remote
    const convergeApi = createBlobApiDouble();
    const convergeResult = await convergeVaultBlob({
      api: convergeApi,
      handle: convergeHandle,
      type: VaultBlobType.Tasks,
      prompt: jest.fn() as VaultBlobConvergePrompt,
      serverMeta: serverMetaFor(convergeHandle),
      remote: remoteBlob,
    });

    expect(convergeResult).toEqual({
      kind: 'took',
      etag: 'etag-remote',
    });
    expect(convergeApi.putVaultBlob).not.toHaveBeenCalled();

    // Now unlock the converge handle and decrypt to verify remote payload was taken
    await convergeHandle.unlockWithPassphrase({ passphrase });
    expect(convergeHandle.isUnlocked).toBe(true);

    const decrypted = await convergeHandle.loadDecryptedData({
      type: 'tasks',
      defaultValue: null,
    });

    const records = readVaultBlobRecords(decrypted);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-2',
          title: 'Remote task',
        }),
      ]),
    );
  });

  test('C3: After recovery-key claim with fresh reloaded (locked) handle, vault status is owned and locked, unsuffixed slot is byte-identical', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via recovery key
    await claimViaRecoveryKey(fixture);

    // Reload with fresh handle (no masterKeyBytes)
    const freshHandle = createVaultHandle({ owner: testOwner });

    // Verify state
    expect(freshHandle.vaultStatus()).toBe('owned');
    expect(freshHandle.isUnlocked).toBe(false);

    // Verify unsuffixed slot is byte-identical to seeded fixture
    const unclaimedRaw = localStorage.getItem(VAULT_STORAGE_KEY);
    expect(unclaimedRaw).toBe(fixture.raw);

    // Verify vault can be read (once unlocked) and ciphertext survived
    await freshHandle.unlockWithPassphrase({ passphrase });
    const vault = freshHandle.loadVault();
    expect(vault).not.toBeNull();

    // Decrypt and verify original task-1 payload is intact
    const decrypted = await freshHandle.loadDecryptedData({
      type: 'tasks',
      defaultValue: null,
    });
    const records = readVaultBlobRecords(decrypted);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-1',
          title: 'Local task',
        }),
      ]),
    );
  });

  // ===== New tests for coverage gaps =====

  test('C4: After evidence-claim with fresh reloaded (locked) handle, vault status is owned and locked, unsuffixed slot is byte-identical', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via evidence (locked)
    await claimViaEvidence(fixture);

    // Reload with fresh handle (no masterKeyBytes)
    const freshHandle = createVaultHandle({ owner: testOwner });

    // Verify state
    expect(freshHandle.vaultStatus()).toBe('owned');
    expect(freshHandle.isUnlocked).toBe(false);

    // Verify unsuffixed slot is byte-identical to seeded fixture
    const unclaimedRaw = localStorage.getItem(VAULT_STORAGE_KEY);
    expect(unclaimedRaw).toBe(fixture.raw);

    // Verify vault can be read (once unlocked) and ciphertext survived
    await freshHandle.unlockWithPassphrase({ passphrase });
    const vault = freshHandle.loadVault();
    expect(vault).not.toBeNull();

    // Decrypt and verify original task-1 payload is intact
    const decrypted = await freshHandle.loadDecryptedData({
      type: 'tasks',
      defaultValue: null,
    });
    const records = readVaultBlobRecords(decrypted);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-1',
          title: 'Local task',
        }),
      ]),
    );
  });

  test('C5: After recovery-key claim with unconflicted take, unlock and decrypt yields remote payload', async () => {
    const fixture = await seedUnclaimedLocalVault(passphrase, true);

    // Claim via recovery key
    await claimViaRecoveryKey(fixture);

    // Reload with fresh handle (no masterKeyBytes)
    const claimHandle = createVaultHandle({ owner: testOwner });
    expect(claimHandle.isUnlocked).toBe(false);
    expect(claimHandle.vaultStatus()).toBe('owned');

    // Record bookmark so local is clean
    await claimHandle.recordPushSuccess({
      type: 'tasks',
      etag: 'etag-claimed',
    });

    // Create a different remote blob using an unlocked temp handle
    const tempHandle = createVaultHandle({ owner: testOwner });
    await tempHandle.unlockWithPassphrase({ passphrase });
    const remoteBlob = await captureRemoteBlob(tempHandle, remoteTaskPayload);

    // Create a fresh locked handle for convergence
    const convergeHandle = createVaultHandle({ owner: testOwner });
    expect(convergeHandle.isUnlocked).toBe(false);
    expect(await convergeHandle.hasUnsentChanges('tasks')).toBe(false);

    // Converge with fresh locked handle, clean local, and different remote
    const convergeApi = createBlobApiDouble();
    const convergeResult = await convergeVaultBlob({
      api: convergeApi,
      handle: convergeHandle,
      type: VaultBlobType.Tasks,
      prompt: jest.fn() as VaultBlobConvergePrompt,
      serverMeta: serverMetaFor(convergeHandle),
      remote: remoteBlob,
    });

    expect(convergeResult).toEqual({
      kind: 'took',
      etag: 'etag-remote',
    });
    expect(convergeApi.putVaultBlob).not.toHaveBeenCalled();

    // Now unlock the converge handle and decrypt to verify remote payload was taken
    await convergeHandle.unlockWithPassphrase({ passphrase });
    expect(convergeHandle.isUnlocked).toBe(true);

    const decrypted = await convergeHandle.loadDecryptedData({
      type: 'tasks',
      defaultValue: null,
    });

    const records = readVaultBlobRecords(decrypted);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-2',
          title: 'Remote task',
        }),
      ]),
    );
  });
});
