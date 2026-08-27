import { beforeEach, describe, expect, test } from '@jest/globals';
import { VaultService } from './VaultService';
import { FakeVaultStore } from '../testing/fakeVaultStore';

// Fixture builders
function makeValidMeta(kdf_salt: string) {
  return {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt,
    kdf_params: { iterations: 10000 },
    wrapped_mk_passphrase: {
      version: 1,
      iv: Buffer.alloc(12).toString('base64'),
      ciphertext: Buffer.from('passphrase-wrapped').toString('base64'),
    },
    wrapped_mk_recovery: {
      version: 1,
      iv: Buffer.alloc(12).toString('base64'),
      ciphertext: Buffer.from('recovery-wrapped').toString('base64'),
    },
  };
}

function makeValidBlob(ciphertextStr: string) {
  return {
    version: 1,
    iv: Buffer.alloc(12).toString('base64'),
    ciphertext: Buffer.from(ciphertextStr).toString('base64'),
  };
}

// Helper to seed a user's vault and optional blobs
async function seedUser(
  store: FakeVaultStore,
  userId: string,
  options: {
    kdfSalt: string;
    blobs?: Record<string, ReturnType<typeof makeValidBlob>>;
  },
): Promise<void> {
  const meta = makeValidMeta(options.kdfSalt);
  await store.encryptedVault.upsert({
    where: { userId },
    create: { userId, ...meta },
    update: {},
  });

  if (options.blobs) {
    for (const [type, blob] of Object.entries(options.blobs)) {
      await store.encryptedVaultBlob.upsert({
        where: { userId_type: { userId, type } },
        create: { userId, type, blob },
        update: {},
      });
    }
  }
}

describe('VaultService Tenancy', () => {
  let store: FakeVaultStore;
  let service: VaultService;

  beforeEach(() => {
    store = new FakeVaultStore();
    service = new VaultService(store as any);
  });

  // Test 1: getVaultMeta only returns the requesting user's vault, never another user's
  test('getVaultMeta returns only the requesting user vault, not another user vault', async () => {
    // Seed both users with vaults
    await seedUser(store, 'user-a', { kdfSalt: 'salt-a' });
    await seedUser(store, 'user-b', { kdfSalt: 'salt-b' });
    store.resetCallLog();

    // Snapshot user-b's vault
    const userBVaultBefore = await store.encryptedVault.findUnique({
      where: { userId: 'user-b' },
    });
    store.resetCallLog();

    // User-a reads their vault
    const result = await service.getVaultMeta('user-a');

    // Should succeed with user-a's data only
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.status).toBe(200);
      expect(result.body.meta.kdf_salt).toBe('salt-a');
      // Assert user-b's kdf_salt never appears in the result
      expect(JSON.stringify(result.body.meta)).not.toContain('salt-b');
    }

    // User-b's vault should remain unchanged
    const userBVaultAfter = await store.encryptedVault.findUnique({
      where: { userId: 'user-b' },
    });
    expect(userBVaultAfter).toEqual(userBVaultBefore);
  });

  // Test 2: getBlob only returns the requesting user's blob, never another user's
  test('getBlob returns only the requesting user blob, not another user blob', async () => {
    const blobA = makeValidBlob('A-secret');
    const blobB = makeValidBlob('B-secret');

    // Seed both users with vaults and blobs
    await seedUser(store, 'user-a', {
      kdfSalt: 'salt-a',
      blobs: { addresses: blobA },
    });
    await seedUser(store, 'user-b', {
      kdfSalt: 'salt-b',
      blobs: { addresses: blobB },
    });
    store.resetCallLog();

    // Snapshot user-b's blob
    const userBBlobBefore = await store.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId: 'user-b', type: 'addresses' } },
    });
    store.resetCallLog();

    // User-a reads their addresses blob
    const result = await service.getBlob('user-a', 'addresses');

    // Should succeed with user-a's data only
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.status).toBe(200);
      expect(result.body.blob).toEqual(blobA);
      // Assert user-b's ciphertext never appears in the result
      expect(JSON.stringify(result.body.blob)).not.toContain(
        Buffer.from('B-secret').toString('base64'),
      );
    }

    // User-b's blob should remain unchanged
    const userBBlobAfter = await store.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId: 'user-b', type: 'addresses' } },
    });
    expect(userBBlobAfter).toEqual(userBBlobBefore);
  });

  // Test 3: putVaultMeta creates user's vault without overwriting another user's
  test('putVaultMeta creates vault for user-a without affecting user-b', async () => {
    const metaA = makeValidMeta('salt-a');

    // Seed user-b with a vault
    await seedUser(store, 'user-b', { kdfSalt: 'salt-b' });
    store.resetCallLog();

    // Snapshot user-b's vault
    const userBVaultBefore = await store.encryptedVault.findUnique({
      where: { userId: 'user-b' },
    });
    store.resetCallLog();

    // User-a creates their vault
    const result = await service.putVaultMeta('user-a', metaA);

    // Should succeed with 201
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(201);
    }

    // User-a's vault should have their kdf_salt, not user-b's
    const userAVault = await store.encryptedVault.findUnique({
      where: { userId: 'user-a' },
    });
    expect(userAVault?.kdf_salt).toBe('salt-a');

    // User-b's vault should be unchanged
    const userBVaultAfter = await store.encryptedVault.findUnique({
      where: { userId: 'user-b' },
    });
    expect(userBVaultAfter).toEqual(userBVaultBefore);
    expect(userBVaultAfter?.kdf_salt).toBe('salt-b');
  });

  // Test 4: putBlob updates only the target user's blob
  test('putBlob updates only user-a blob when both users have the same type', async () => {
    const blobA = makeValidBlob('A-secret');
    const blobB = makeValidBlob('B-secret');

    // Seed both users with vaults and addresses blobs
    await seedUser(store, 'user-a', {
      kdfSalt: 'salt-a',
      blobs: { addresses: blobA },
    });
    await seedUser(store, 'user-b', {
      kdfSalt: 'salt-b',
      blobs: { addresses: blobB },
    });
    store.resetCallLog();

    // Snapshot user-b's blob
    const userBBlobBefore = await store.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId: 'user-b', type: 'addresses' } },
    });
    store.resetCallLog();

    // User-a updates their addresses blob
    const newBlobA = makeValidBlob('A-secret-updated');
    const result = await service.putBlob('user-a', 'addresses', newBlobA);

    // Should succeed with 200
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
    }

    // User-a's blob should be updated
    const userABlobAfter = await store.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId: 'user-a', type: 'addresses' } },
    });
    expect(userABlobAfter?.blob).toEqual(newBlobA);

    // User-b's blob should remain unchanged
    const userBBlobAfter = await store.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId: 'user-b', type: 'addresses' } },
    });
    expect(userBBlobAfter).toEqual(userBBlobBefore);
    expect(userBBlobAfter?.blob).toEqual(blobB);
  });

  // Test 5: putBlob returns 404 if user has no vault; no write occurs
  test('putBlob returns 404 when user has no vault and records no write', async () => {
    // Seed only user-b with a vault
    await seedUser(store, 'user-b', { kdfSalt: 'salt-b' });
    store.resetCallLog();

    // Attempt to write a blob for user-a (who has no vault)
    const blob = makeValidBlob('A-secret');
    const result = await service.putBlob('user-a', 'addresses', blob);

    // Should be 404
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe(404);
      expect(result.body.message).toBe('Vault not found');
    }

    // Assert no blob upsert was recorded in the call log
    const callLog = store.getCallLog();
    const blobUpserts = callLog.filter(
      (call) => call.model === 'encryptedVaultBlob' && call.op === 'upsert',
    );
    expect(blobUpserts.length).toBe(0);

    // Verify no blob was created for user-a
    const userABlob = await store.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId: 'user-a', type: 'addresses' } },
    });
    expect(userABlob).toBeNull();
  });

  // Test 6: exportVault only includes that user's blobs
  test('exportVault includes only user-a blobs, not user-b blobs', async () => {
    const blobA = makeValidBlob('A-secret');
    const blobB1 = makeValidBlob('B-secret-1');
    const blobB2 = makeValidBlob('B-secret-2');

    // Seed user-a with vault + 1 blob
    await seedUser(store, 'user-a', {
      kdfSalt: 'salt-a',
      blobs: { addresses: blobA },
    });

    // Seed user-b with vault + 2 blobs
    await seedUser(store, 'user-b', {
      kdfSalt: 'salt-b',
      blobs: { tasks: blobB1, todos: blobB2 },
    });
    store.resetCallLog();

    // User-a exports their vault
    const result = await service.exportVault('user-a');

    // Should succeed
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return; // Make TypeScript happy
    }

    // Export should include only user-a's blob
    expect(Object.keys(result.body.blobs)).toEqual(['addresses']);
    expect(result.body.blobs.addresses).toEqual(blobA);

    // Verify user-b's ciphertext never appears in the payload
    const payloadStr = JSON.stringify(result.body);
    expect(payloadStr).not.toContain(
      Buffer.from('B-secret-1').toString('base64'),
    );
    expect(payloadStr).not.toContain(
      Buffer.from('B-secret-2').toString('base64'),
    );
  });

  // Test 7: importVault only affects that user's data
  test('importVault updates only user-a rows, leaving user-b unchanged', async () => {
    const blobB = makeValidBlob('B-secret');

    // Seed user-b with vault + blob
    await seedUser(store, 'user-b', {
      kdfSalt: 'salt-b',
      blobs: { tasks: blobB },
    });
    store.resetCallLog();

    // Snapshot user-b's data
    const userBVaultBefore = await store.encryptedVault.findUnique({
      where: { userId: 'user-b' },
    });
    const userBTasksBefore = await store.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId: 'user-b', type: 'tasks' } },
    });
    store.resetCallLog();

    // User-a imports a bundle with new meta and blobs
    const metaA = makeValidMeta('salt-a-imported');
    const blobA = makeValidBlob('A-secret-imported');
    const bundle = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      meta: metaA,
      blobs: {
        addresses: blobA,
      },
    };

    const result = await service.importVault('user-a', bundle);

    // Should succeed
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    // User-a's vault should have the imported meta
    const userAVaultAfter = await store.encryptedVault.findUnique({
      where: { userId: 'user-a' },
    });
    expect(userAVaultAfter?.kdf_salt).toBe('salt-a-imported');
    expect(userAVaultAfter?.version).toBe(metaA.version);

    // User-a should have the imported blob
    const userABlobAfter = await store.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId: 'user-a', type: 'addresses' } },
    });
    expect(userABlobAfter?.blob).toEqual(blobA);

    // User-b's vault and blobs should be completely unchanged
    const userBVaultAfter = await store.encryptedVault.findUnique({
      where: { userId: 'user-b' },
    });
    expect(userBVaultAfter).toEqual(userBVaultBefore);
    expect(userBVaultAfter?.kdf_salt).toBe('salt-b');

    const userBTasksAfter = await store.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId: 'user-b', type: 'tasks' } },
    });
    expect(userBTasksAfter).toEqual(userBTasksBefore);
  });

  // Test 8: Provenance sweep — all operations record the requesting userId
  test('provenance sweep confirms all operations record the correct userId', async () => {
    const meta = makeValidMeta('salt-a');
    const blob = makeValidBlob('A-secret');

    // Seed user-b so we have data to NOT leak
    await store.encryptedVault.upsert({
      where: { userId: 'user-b' },
      create: { userId: 'user-b', ...makeValidMeta('salt-b') },
      update: {},
    });
    store.resetCallLog();

    // Collect all calls across all operations
    const allCalls: Array<{ model: string; op: string; userId?: string }> = [];

    await service.getVaultMeta('user-a');
    allCalls.push(...store.getCallLog());
    store.resetCallLog();

    await service.getBlob('user-a', 'addresses');
    allCalls.push(...store.getCallLog());
    store.resetCallLog();

    await service.putVaultMeta('user-a', meta);
    allCalls.push(...store.getCallLog());
    store.resetCallLog();

    await service.putBlob('user-a', 'addresses', blob);
    allCalls.push(...store.getCallLog());
    store.resetCallLog();

    await service.exportVault('user-a');
    allCalls.push(...store.getCallLog());

    // Assert call log is non-empty
    expect(allCalls.length).toBeGreaterThan(0);

    // Assert every call has userId set to 'user-a'
    for (const call of allCalls) {
      expect(call.userId).toBe('user-a');
    }

    // Assert no call has userId === 'user-b'
    const callsWithWrongUser = allCalls.filter(
      (call) => call.userId === 'user-b',
    );
    expect(callsWithWrongUser.length).toBe(0);
  });
});
