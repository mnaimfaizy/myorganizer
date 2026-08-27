import { beforeEach, describe, expect, test } from '@jest/globals';
import { FakeVaultStore } from './fakeVaultStore';

// FakeVaultStore is the shared oracle for VaultService.tenancy.test.ts and
// VaultController.crossUser.int.test.ts. Both suites only detect a dropped
// userId filter because the fake REFUSES an unscoped query. If those refusals
// were ever weakened, both suites would keep passing while proving nothing.
// These tests guard the refusals themselves, so the guarantee does not depend
// on someone remembering to hand-mutate VaultService to check.

describe('FakeVaultStore refuses unscoped access', () => {
  let store: FakeVaultStore;

  beforeEach(() => {
    store = new FakeVaultStore();
    store.seedVault('user-a', 'salt-a');
    store.seedBlob('user-a', 'addresses', { ciphertext: 'a' });
  });

  test('encryptedVault.findUnique rejects a where with no userId', async () => {
    await expect(
      store.encryptedVault.findUnique({ where: {} }),
    ).rejects.toThrow(/requires where\.userId/);
  });

  test('encryptedVault.upsert rejects a where with no userId', async () => {
    await expect(
      store.encryptedVault.upsert({ where: {}, create: {}, update: {} }),
    ).rejects.toThrow(/requires where\.userId/);
  });

  test('encryptedVault.upsert rejects a create for a different user', async () => {
    await expect(
      store.encryptedVault.upsert({
        where: { userId: 'user-a' },
        create: { userId: 'user-b' },
        update: {},
      }),
    ).rejects.toThrow(/does not match where\.userId/);
  });

  test('encryptedVaultBlob.findUnique rejects a where with no userId_type', async () => {
    await expect(
      store.encryptedVaultBlob.findUnique({ where: {} }),
    ).rejects.toThrow(/requires where\.userId_type/);
  });

  test('encryptedVaultBlob.findMany rejects a where with no userId', async () => {
    await expect(
      store.encryptedVaultBlob.findMany({ where: {} }),
    ).rejects.toThrow(/requires where\.userId/);
  });

  test('encryptedVaultBlob.upsert rejects a where with no userId_type', async () => {
    await expect(
      store.encryptedVaultBlob.upsert({ where: {}, create: {}, update: {} }),
    ).rejects.toThrow(/requires where\.userId_type/);
  });

  test('encryptedVaultBlob.upsert rejects a create for a different user', async () => {
    await expect(
      store.encryptedVaultBlob.upsert({
        where: { userId_type: { userId: 'user-a', type: 'addresses' } },
        create: { userId: 'user-b', type: 'addresses', blob: {} },
        update: {},
      }),
    ).rejects.toThrow(/does not match where\.userId/);
  });
});

describe('FakeVaultStore isolates users', () => {
  let store: FakeVaultStore;

  beforeEach(() => {
    store = new FakeVaultStore();
    store.seedVault('user-a', 'salt-a');
    store.seedVault('user-b', 'salt-b');
    store.seedBlob('user-a', 'addresses', { ciphertext: 'a' });
    store.seedBlob('user-b', 'addresses', { ciphertext: 'b' });
  });

  test('findUnique returns only the scoped user row', async () => {
    const a: any = await store.encryptedVault.findUnique({
      where: { userId: 'user-a' },
    });
    expect(a.kdf_salt).toBe('salt-a');
  });

  test('findMany returns only the scoped user blobs', async () => {
    store.seedBlob('user-b', 'todos', { ciphertext: 'b2' });
    const rows = await store.encryptedVaultBlob.findMany({
      where: { userId: 'user-a' },
    });
    expect(rows.map((r: any) => r.userId)).toEqual(['user-a']);
  });

  test('an upsert for one user leaves the other user row untouched', async () => {
    const before = store.readVault('user-b');
    await store.encryptedVault.upsert({
      where: { userId: 'user-a' },
      create: { userId: 'user-a', kdf_salt: 'rewritten' },
      update: { kdf_salt: 'rewritten' },
    });
    expect(store.readVault('user-b')).toEqual(before);
  });

  test('reads return clones, so a caller cannot mutate stored rows', async () => {
    const first: any = await store.encryptedVault.findUnique({
      where: { userId: 'user-a' },
    });
    first.kdf_salt = 'tampered';
    const second: any = await store.encryptedVault.findUnique({
      where: { userId: 'user-a' },
    });
    expect(second.kdf_salt).toBe('salt-a');
  });

  test('seeding does not appear in the call log', () => {
    expect(store.getCallLog()).toEqual([]);
  });
});
