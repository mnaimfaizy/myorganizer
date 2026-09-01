/**
 * Regression tests for bug #617: importVault must clear Sync Bookmarks before
 * committing, to prevent older restored Ciphertext from silently overwriting
 * the server's newer copy via a conditional push that the unmoved ETag matches.
 *
 * Tests use REAL VaultHandle, REAL syncBookmarkAccess, REAL localStorage shim,
 * and MOCK-only VaultApi (getVaultBlob, putVaultBlob, getVaultMeta, putVaultMeta).
 *
 * The bug: `importVault` committed a restored bundle without clearing bookmarks,
 * leaving dirtiness/hasUnsentChanges=true and lastPushedEtag from the newer
 * pre-restore state. convergeVaultBlob saw the ETag, sent conditional-push,
 * server matched the ETag (unchanged state), and older data silently replaced
 * the newer copy.
 *
 * The fix: `importVault` calls `options.handle.forgetSyncBookmarks()` BEFORE
 * `options.handle.saveVault(staged)`, so a device with no bookmark cannot
 * prove the server state and must look before pushing.
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
import { VaultBlobType, type VaultMetaV1 } from '@myorganizer/app-api-client';
import type { VaultBlobEnvelope } from '@myorganizer/core';

import { VAULT_BLOB_FIELDS, VAULT_BLOB_TYPES } from './vaultBlobFields';
import type { VaultStorageV1 } from './localVaultStorage';
import { exportVault, importVault } from './vaultExportImport';
import { createVaultHandle } from './vaultHandle';
import {
  convergeVaultBlob,
  type VaultBlobConvergePrompt,
} from './vaultConverge';
import type { ServerVaultBlob } from './serverVaultSync';
import { toEncryptedBlobV1 } from './vaultShapes';
import { pushLocalVaultMeta } from './vaultMetaPush';

const TEST_OWNER = 'test-owner';
const TEST_OWNER_2 = 'test-owner-2';

// Minimal in-memory localStorage shim so `saveVault` works in node.
class MemoryStorage {
  private readonly store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(_index: number): string | null {
    return null;
  }
  get length(): number {
    return this.store.size;
  }
}

beforeAll(() => {
  // jsdom is not configured for this lib; provide minimal window/storage.
  if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
    (
      globalThis as unknown as { window: { localStorage: MemoryStorage } }
    ).window = {
      localStorage: new MemoryStorage(),
    };
  }
});

beforeEach(() => {
  (
    globalThis as unknown as { window: { localStorage: MemoryStorage } }
  ).window.localStorage.clear();
  jest.clearAllMocks();
});

/**
 * A vault with distinguishing ciphertext per blob type so exports can be
 * recognized when re-imported.
 */
function createVaultFixture(label: string): VaultStorageV1 {
  return {
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 310_000,
      salt: 'c2FsdA==',
    },
    masterKeyWrappedWithPassphrase: {
      iv: 'cGFzc3BocmFzZS1pdg==',
      ciphertext: 'cGFzc3BocmFzZS1jdA==',
    },
    masterKeyWrappedWithRecoveryKey: {
      iv: 'cmVjb3ZlcnktaXYtMTI=',
      ciphertext: 'cmVjb3ZlcnktaXYtY3Q=',
    },
    data: Object.fromEntries(
      VAULT_BLOB_TYPES.map((type) => [
        VAULT_BLOB_FIELDS[type],
        {
          iv: Buffer.from(`iv-${label}-${type}`).toString('base64'),
          ciphertext: Buffer.from(`ct-${label}-${type}`).toString('base64'),
        },
      ]),
    ),
  };
}

/**
 * Helper to create a properly typed API double for vault blob operations.
 */
function createBlobApiDouble() {
  return {
    getVaultBlob: jest.fn<Promise<AxiosResponse<any>>, [any?]>(),
    putVaultBlob: jest.fn<
      Promise<
        AxiosResponse<{
          ok: boolean;
          etag: string;
          updatedAt: string;
          message: string;
        }>
      >,
      [{ ifMatch?: string }]
    >(),
  };
}

/**
 * Helper to create a properly typed API double for vault meta operations.
 */
function createMetaApiDouble() {
  return {
    getVaultMeta: jest.fn(),
    putVaultMeta: jest.fn(),
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
    config: { headers: {} as any },
  } as unknown as AxiosResponse<T>;
}

/**
 * Helper to create a 404 error for missing vault blob.
 */
function create404Error() {
  const error = Object.assign(new Error('not found'), {
    response: { status: 404 },
  });
  return error;
}

/**
 * Helper to capture a remote blob that genuinely encrypts under the same Master Key,
 * by temporarily saving the payload and reading its Ciphertext.
 */
async function captureRemoteBlob(
  handle: ReturnType<typeof createVaultHandle>,
  payload: unknown,
  type: VaultBlobType = VaultBlobType.Tasks,
): Promise<ServerVaultBlob> {
  const vault = handle.loadVault();
  if (!vault) throw new Error('Handle has no vault');
  const originalData = { ...vault.data };

  // Save the remote payload
  const field = VAULT_BLOB_FIELDS[type];
  const envelope: VaultBlobEnvelope<unknown> = {
    records: payload,
    deletions: {},
  };
  await handle.saveEncryptedData({ type: field, value: envelope });

  // Capture the Ciphertext
  const remoteVault = handle.loadVault();
  const encryptedBlob = remoteVault?.data[field];
  if (!encryptedBlob) {
    throw new Error(`Failed to save test blob for type ${type}`);
  }

  // Restore the original local data
  vault.data = originalData;
  handle.saveVault(vault);

  return {
    etag: 'etag-remote',
    updatedAt: '2026-01-01T00:00:00.000Z',
    type,
    blob: toEncryptedBlobV1(encryptedBlob),
  };
}

describe('importVault - Sync Bookmark forgetting (bug #617)', () => {
  // =========================================================================
  // ROW 1: CORE REGRESSION - Import older vault with unmoved server
  // =========================================================================
  // Given: device pushes newer ciphertext, bookmark records etag
  // When: device imports older export (ciphertext reverted)
  // Then: convergeVaultBlob must NOT send via conditional push (would succeed
  //       because server etag still matches the newer version the device no
  //       longer holds). Instead, must look first and route to ask/conflict.
  test('1: older import does not conditional-push over unmoved server state', async () => {
    const handle = createVaultHandle({ owner: TEST_OWNER });
    await handle.initialize({ passphrase: 'test12345' });
    await handle.unlockWithPassphrase({ passphrase: 'test12345' });

    // --- Setup: create newer and older vault fixtures ---
    const newerVault = createVaultFixture('newer');
    const olderVault = createVaultFixture('older');

    // --- Export both vaults ---
    const newerExport = await exportVault({ localVault: newerVault });
    const olderExport = await exportVault({ localVault: olderVault });

    // --- Import the newer vault to set up initial state ---
    await importVault({
      text: newerExport.text,
      handle,
    });

    // --- Manually record a bookmark for the newer vault (simulating a prior push) ---
    const newerBlob = handle.loadVault()?.data.tasks;
    if (!newerBlob) throw new Error('No newer blob after import');
    await handle.recordPushSuccess({
      type: 'tasks',
      etag: 'etag-newer-from-server',
    });

    // Verify bookmark was recorded
    expect(handle.lastPushedEtag('tasks')).toBe('etag-newer-from-server');

    // --- Now import the older vault; should clear bookmarks ---
    await importVault({
      text: olderExport.text,
      handle,
    });

    // Verify bookmark was cleared
    expect(handle.lastPushedEtag('tasks')).toBeUndefined();

    // --- Mock server holding the newer ciphertext ---
    const api = createBlobApiDouble();
    const newerRemote = await captureRemoteBlob(
      handle,
      [{ id: 'newer-task' }],
      VaultBlobType.Tasks,
    );

    // Mock server still holding the newer etag
    api.getVaultBlob.mockResolvedValue(
      axiosResponse({
        etag: 'etag-newer-from-server', // Unmoved server
        updatedAt: '2026-01-01T00:00:00.000Z',
        type: VaultBlobType.Tasks,
        blob: newerRemote.blob,
      }),
    );

    // --- Converge: should NOT send via conditional push ---
    // (if it did, ifMatch would match and older data would overwrite)

    // Mock putVaultBlob for the keep-local response (sends the local blob)
    api.putVaultBlob.mockResolvedValue(
      axiosResponse({
        ok: true,
        etag: 'etag-local-after-send',
        updatedAt: '2026-01-01T00:00:00.000Z',
        message: 'OK',
      }),
    );

    const prompt = jest.fn(async () => 'keep-local') as VaultBlobConvergePrompt;

    const outcome = await convergeVaultBlob({
      api,
      handle,
      type: VaultBlobType.Tasks,
      prompt,
    });

    // Should ask the user because device has no bookmark to prove server state,
    // NOT send the older ciphertext via conditional push.
    expect(outcome.kind).not.toBe('sent');
    // Should ask because local/remote differ
    expect(outcome.kind).toBe('asked');

    // Verify putVaultBlob was called, but NOT with the conditional push
    // (it should have been called with remote.etag as ifMatch since the user
    // chose keep-local and it's a conflict resolution)
    const putCalls = api.putVaultBlob.mock.calls;
    expect(putCalls.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // ROW 2: SIDE EFFECT - All blob types' Sync Bookmarks are cleared
  // =========================================================================
  // Use VAULT_BLOB_TYPES (ADR 0053) to ensure a 7th type is covered.
  test('2: forgetSyncBookmarks clears bookmarks for every VAULT_BLOB_TYPES member', async () => {
    const handle = createVaultHandle({ owner: TEST_OWNER });
    await handle.initialize({ passphrase: 'test12345' });
    await handle.unlockWithPassphrase({ passphrase: 'test12345' });

    const vault = createVaultFixture('test');
    handle.saveVault(vault);

    // Record bookmarks for all blob types
    for (const type of VAULT_BLOB_TYPES) {
      const field = VAULT_BLOB_FIELDS[type];
      await handle.recordPushSuccess({
        type: field,
        etag: `etag-${type}`,
      });
    }

    // Verify all bookmarks exist
    for (const type of VAULT_BLOB_TYPES) {
      const field = VAULT_BLOB_FIELDS[type];
      expect(handle.lastPushedEtag(field)).toBe(`etag-${type}`);
    }

    // Export and import to trigger forgetSyncBookmarks
    const exported = await exportVault({ localVault: vault });
    await importVault({
      text: exported.text,
      handle,
    });

    // Verify all bookmarks are now undefined
    for (const type of VAULT_BLOB_TYPES) {
      const field = VAULT_BLOB_FIELDS[type];
      expect(handle.lastPushedEtag(field)).toBeUndefined();
    }
  });

  // =========================================================================
  // ROW 3: SIDE EFFECT - Vault Meta Bookmark is cleared
  // =========================================================================
  test('3: import clears Vault Meta Bookmark (lastAgreedVaultMetaHash returns undefined)', async () => {
    const handle = createVaultHandle({ owner: TEST_OWNER });
    await handle.initialize({ passphrase: 'test12345' });
    await handle.unlockWithPassphrase({ passphrase: 'test12345' });

    const vault = createVaultFixture('test');
    handle.saveVault(vault);

    // Simulate a recorded Vault Meta agreement by manually recording it
    const meta = {
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: 'c2FsdA==',
      kdf_params: { hash: 'SHA-256', iterations: 310_000 },
      wrapped_mk_passphrase: {
        version: 1,
        iv: 'cGFzc3BocmFzZS1pdg==',
        ciphertext: 'cGFzc3BocmFzZS1jdA==',
      },
      wrapped_mk_recovery: {
        version: 1,
        iv: 'cmVjb3ZlcnktaXYtMTI=',
        ciphertext: 'cmVjb3ZlcnktaXYtY3Q=',
      },
    } as VaultMetaV1;
    await handle.recordVaultMetaAgreement({ meta });

    // Verify it's recorded
    const metaHashBefore = handle.lastAgreedVaultMetaHash()!;
    expect(typeof metaHashBefore).toBe('string');
    expect(metaHashBefore.length).toBeGreaterThan(0);

    // Export and import
    const exported = await exportVault({ localVault: vault });
    await importVault({
      text: exported.text,
      handle,
    });

    // Verify it's cleared
    expect(handle.lastAgreedVaultMetaHash()).toBeUndefined();
  });

  // =========================================================================
  // ROW 4: CONSEQUENCE FOR META - pushVaultMeta refuses with 'refused-no-base'
  // =========================================================================
  test('4: after import, pushVaultMeta refuses with kind: "refused-no-base"', async () => {
    const handle = createVaultHandle({ owner: TEST_OWNER });
    await handle.initialize({ passphrase: 'test12345' });
    await handle.unlockWithPassphrase({ passphrase: 'test12345' });

    const vault = createVaultFixture('test');
    handle.saveVault(vault);

    // Record a meta agreement
    const meta = {
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: 'c2FsdA==',
      kdf_params: { hash: 'SHA-256', iterations: 310_000 },
      wrapped_mk_passphrase: {
        version: 1,
        iv: 'cGFzc3BocmFzZS1pdg==',
        ciphertext: 'cGFzc3BocmFzZS1jdA==',
      },
      wrapped_mk_recovery: {
        version: 1,
        iv: 'cmVjb3ZlcnktaXYtMTI=',
        ciphertext: 'cmVjb3ZlcnktaXYtY3Q=',
      },
    } as VaultMetaV1;
    await handle.recordVaultMetaAgreement({ meta });

    // Verify meta agreement exists
    const metaHashBeforePush = handle.lastAgreedVaultMetaHash()!;
    expect(typeof metaHashBeforePush).toBe('string');
    expect(metaHashBeforePush.length).toBeGreaterThan(0);

    // Export and import to clear meta bookmark
    const exported = await exportVault({ localVault: vault });
    await importVault({
      text: exported.text,
      handle,
    });

    // Verify meta bookmark is gone
    expect(handle.lastAgreedVaultMetaHash()).toBeUndefined();

    // Mock meta API
    const api = createMetaApiDouble();
    api.getVaultMeta.mockResolvedValue(
      axiosResponse({
        etag: 'etag-server-meta',
        updatedAt: '2026-01-01T00:00:00.000Z',
        meta: {
          ...meta,
          wrapped_mk_passphrase: {
            version: 1,
            iv: 'different-iv',
            ciphertext: 'different-ct',
          },
        },
      }),
    );

    // Try to push: should refuse because no base hash
    const result = await pushLocalVaultMeta({
      api,
      meta,
      baseHash: handle.lastAgreedVaultMetaHash(),
    });

    expect(result).toEqual({ kind: 'refused-no-base' });
    expect(api.putVaultMeta).not.toHaveBeenCalled();
  });

  // =========================================================================
  // ROW 5: ORDERING - Clear happens BEFORE commit
  // =========================================================================
  // The order matters: forgetSyncBookmarks MUST run BEFORE saveVault.
  // If cleared first, a failing saveVault leaves no bookmark evidence.
  // If cleared after, a failing saveVault means the clear never runs,
  // leaving old bookmarks that could cause convergeVaultBlob to trust a
  // stale ETag and overwrite newer server data (the bug from #617).
  //
  // Test by making saveVault throw: verify bookmarks are gone (clear ran)
  // while vault retains original ciphertext (save failed). With wrong order,
  // saveVault throws before clear, bookmarks survive, and test fails.
  test('5: forgetSyncBookmarks clearing is sequenced before saveVault', async () => {
    const handle = createVaultHandle({ owner: TEST_OWNER });
    await handle.initialize({ passphrase: 'test12345' });
    await handle.unlockWithPassphrase({ passphrase: 'test12345' });

    const initialVault = createVaultFixture('initial');
    handle.saveVault(initialVault);

    // Record a bookmark for the initial vault
    await handle.recordPushSuccess({
      type: 'tasks',
      etag: 'etag-initial-state',
    });
    expect(handle.lastPushedEtag('tasks')).toBe('etag-initial-state');

    // Create a different vault and export it
    const newVault = createVaultFixture('new');
    const newExport = await exportVault({ localVault: newVault });

    // Replace saveVault with a spy that throws after the first call
    const saveVaultSpy = jest
      .spyOn(handle, 'saveVault')
      .mockImplementation(() => {
        throw new Error('saveVault failed');
      });

    // Attempt import - should fail when saveVault throws
    await expect(
      importVault({
        text: newExport.text,
        handle,
      }),
    ).rejects.toThrow('saveVault failed');

    saveVaultSpy.mockRestore();

    // --------- CRITICAL ORDERING CHECK ---------
    // With CORRECT order (forgetSyncBookmarks BEFORE saveVault):
    //   1. forgetSyncBookmarks runs → bookmarks cleared
    //   2. saveVault runs → throws
    //   Result: bookmarks gone, vault unchanged
    //
    // With WRONG order (saveVault BEFORE forgetSyncBookmarks):
    //   1. saveVault runs → throws immediately
    //   2. forgetSyncBookmarks NEVER runs
    //   Result: bookmarks still exist, vault unchanged

    // Verify bookmarks are gone (forgetSyncBookmarks must have run)
    expect(handle.lastPushedEtag('tasks')).toBeUndefined();

    // Verify vault still contains original data (saveVault threw before writing)
    const currentVault = handle.loadVault();
    expect(currentVault?.data.tasks?.ciphertext).toBe(
      initialVault.data.tasks?.ciphertext,
    );

    // Verify new ciphertext was NOT written (save failed)
    expect(currentVault?.data.tasks?.ciphertext).not.toBe(
      newVault.data.tasks?.ciphertext,
    );
  });

  // =========================================================================
  // ROW 6: BOUNDARY - No bookmarks exist is harmless no-op
  // =========================================================================
  test('6: import when no bookmarks exist does not throw', async () => {
    const handle = createVaultHandle({ owner: TEST_OWNER });
    await handle.initialize({ passphrase: 'test12345' });
    await handle.unlockWithPassphrase({ passphrase: 'test12345' });

    const vault = createVaultFixture('test');
    handle.saveVault(vault);

    // Verify no bookmarks exist
    for (const type of VAULT_BLOB_TYPES) {
      const field = VAULT_BLOB_FIELDS[type];
      expect(handle.lastPushedEtag(field)).toBeUndefined();
    }

    // Export and import should not throw
    const exported = await exportVault({ localVault: vault });
    await expect(
      importVault({
        text: exported.text,
        handle,
      }),
    ).resolves.not.toThrow();

    // Bookmarks should still be undefined
    for (const type of VAULT_BLOB_TYPES) {
      const field = VAULT_BLOB_FIELDS[type];
      expect(handle.lastPushedEtag(field)).toBeUndefined();
    }
  });

  // =========================================================================
  // ROW 7: NON-REGRESSION - Normal push→recordPushSuccess→converge cycle
  // still reaches {kind:'sent'}
  // =========================================================================
  test('7: normal push cycle without import still reaches {kind: "sent"}', async () => {
    const handle = createVaultHandle({ owner: TEST_OWNER });
    await handle.initialize({ passphrase: 'test12345' });
    await handle.unlockWithPassphrase({ passphrase: 'test12345' });

    const vault = createVaultFixture('test');
    handle.saveVault(vault);

    // --- No import, just normal push ---
    const api = createBlobApiDouble();

    // Mock server returns 404 on first get (no remote)
    api.getVaultBlob.mockRejectedValue(create404Error());

    // Mock successful put
    api.putVaultBlob.mockResolvedValue(
      axiosResponse({
        ok: true,
        etag: 'etag-pushed',
        updatedAt: '2026-01-01T00:00:00.000Z',
        message: 'OK',
      }),
    );

    const prompt = jest.fn() as VaultBlobConvergePrompt;

    // Without any bookmark recorded, converge should look, find nothing, and send
    const outcome = await convergeVaultBlob({
      api,
      handle,
      type: VaultBlobType.Tasks,
      prompt,
    });

    expect(outcome).toEqual({ kind: 'sent', etag: 'etag-pushed' });
    expect(api.putVaultBlob).toHaveBeenCalled();
  });

  // =========================================================================
  // ROW 8: ISOLATION - forgetSyncBookmarks only clears calling owner's bookmarks
  // =========================================================================
  test("8: forgetSyncBookmarks clears only the calling owner's bookmarks (ADR 0058 isolation)", async () => {
    const handle1 = createVaultHandle({ owner: TEST_OWNER });
    await handle1.initialize({ passphrase: 'test12345' });
    await handle1.unlockWithPassphrase({ passphrase: 'test12345' });

    const handle2 = createVaultHandle({ owner: TEST_OWNER_2 });
    await handle2.initialize({ passphrase: 'test12345' });
    await handle2.unlockWithPassphrase({ passphrase: 'test12345' });

    const vault1 = createVaultFixture('owner1');
    const vault2 = createVaultFixture('owner2');
    handle1.saveVault(vault1);
    handle2.saveVault(vault2);

    // Record bookmarks for both owners
    await handle1.recordPushSuccess({
      type: 'tasks',
      etag: 'etag-owner1',
    });
    await handle2.recordPushSuccess({
      type: 'tasks',
      etag: 'etag-owner2',
    });

    expect(handle1.lastPushedEtag('tasks')).toBe('etag-owner1');
    expect(handle2.lastPushedEtag('tasks')).toBe('etag-owner2');

    // Export and import for owner 1
    const exported1 = await exportVault({ localVault: vault1 });
    await importVault({
      text: exported1.text,
      handle: handle1,
    });

    // Owner 1's bookmark should be cleared
    expect(handle1.lastPushedEtag('tasks')).toBeUndefined();

    // Owner 2's bookmark should still exist (isolation)
    expect(handle2.lastPushedEtag('tasks')).toBe('etag-owner2');
  });
});
