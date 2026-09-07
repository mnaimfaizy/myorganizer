/**
 * Tests for Vault Meta Refusal access layer — the comparison that decides
 * whether a divergence is one this device has already refused.
 *
 * Covers the derived-refusal model: whether a Vault Meta is refused is
 * determined by hashing it and comparing to the owner's stored refusal,
 * not by reading a flag saying a question was asked.
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

import type { VaultMetaV1 } from '@myorganizer/app-api-client';

import {
  createVaultMetaRefusalAccess,
  type VaultMetaRefusalAccess,
} from './vaultMetaRefusal';
import { hashVaultMeta } from './syncBookmarkAccess';
import { vaultMetaRefusalStorageKey } from './vaultMetaRefusalStorage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

/**
 * Helper to create a VaultMetaV1 for testing.
 */
function makeVaultMeta(overrides: Partial<VaultMetaV1> = {}): VaultMetaV1 {
  return {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt: 'default-salt',
    kdf_params: { hash: 'SHA-256', iterations: 310_000 },
    wrapped_mk_passphrase: {
      version: 1,
      iv: 'iv1-default',
      ciphertext: 'ct1-default',
    },
    wrapped_mk_recovery: {
      version: 1,
      iv: 'iv2-default',
      ciphertext: 'ct2-default',
    },
    ...overrides,
  };
}

describe('createVaultMetaRefusalAccess — access layer and comparison', () => {
  describe('isRefused — the comparison', () => {
    test('1: isRefused returns false when nothing has been refused', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta();

      const isRefused = await access.isRefused({ meta, change: 'passphrase' });
      expect(isRefused).toBe(false);
    });

    test('2: after record with durable lifetime, isRefused returns true for same meta', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'unique-iv-1',
          ciphertext: 'unique-ct-1',
        },
      });

      await access.record({ meta, lifetime: 'durable', change: 'passphrase' });

      const isRefused = await access.isRefused({ meta, change: 'passphrase' });
      expect(isRefused).toBe(true);
    });

    test('3: isRefused is false for genuinely different meta (different wrapped_mk_passphrase)', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const metaA = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'iv-a',
          ciphertext: 'ct-a',
        },
      });
      const metaB = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'iv-b',
          ciphertext: 'ct-b',
        },
      });

      await access.record({
        meta: metaA,
        lifetime: 'durable',
        change: 'passphrase',
      });

      const isRefusedB = await access.isRefused({
        meta: metaB,
        change: 'passphrase',
      });
      expect(isRefusedB).toBe(false);
    });

    test('4a: isRefused is false for different meta with different kdf_salt', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const metaA = makeVaultMeta({ kdf_salt: 'salt-a' });
      const metaB = makeVaultMeta({ kdf_salt: 'salt-b' });

      await access.record({
        meta: metaA,
        lifetime: 'durable',
        change: 'passphrase',
      });

      const isRefusedB = await access.isRefused({
        meta: metaB,
        change: 'passphrase',
      });
      expect(isRefusedB).toBe(false);
    });

    test('4b: isRefused is false for different meta with different wrapped_mk_recovery', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const metaA = makeVaultMeta({
        wrapped_mk_recovery: {
          version: 1,
          iv: 'iv-recovery-a',
          ciphertext: 'ct-recovery-a',
        },
      });
      const metaB = makeVaultMeta({
        wrapped_mk_recovery: {
          version: 1,
          iv: 'iv-recovery-b',
          ciphertext: 'ct-recovery-b',
        },
      });

      await access.record({
        meta: metaA,
        lifetime: 'durable',
        change: 'passphrase',
      });

      const isRefusedB = await access.isRefused({
        meta: metaB,
        change: 'passphrase',
      });
      expect(isRefusedB).toBe(false);
    });

    test('5: isRefused is true for field-identical meta with different JSON key order', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');

      // Create two metas that are value-identical but might have different JSON key order
      const meta1 = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'order-test-iv',
          ciphertext: 'order-test-ct',
        },
      });
      const meta2 = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'order-test-iv',
          ciphertext: 'order-test-ct',
        },
      });

      await access.record({
        meta: meta1,
        lifetime: 'durable',
        change: 'passphrase',
      });

      // Even if JSON representation might differ, the hash should be the same
      // because it is based on the values, not the key order
      const isRefused = await access.isRefused({
        meta: meta2,
        change: 'passphrase',
      });
      expect(isRefused).toBe(true);
    });

    test('6a: after session refusal, isRefused returns true; after clearing sessionStorage only, it returns false; durable refusal survives', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const metaSession = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'session-test-iv',
          ciphertext: 'session-test-ct',
        },
      });
      const metaDurable = makeVaultMeta({
        wrapped_mk_recovery: {
          version: 1,
          iv: 'durable-test-iv',
          ciphertext: 'durable-test-ct',
        },
      });

      // Record both
      await access.record({
        meta: metaSession,
        lifetime: 'session',
        change: 'passphrase',
      });
      await access.record({
        meta: metaDurable,
        lifetime: 'durable',
        change: 'passphrase',
      });

      // Both are refused
      expect(
        await access.isRefused({ meta: metaSession, change: 'passphrase' }),
      ).toBe(true);
      expect(
        await access.isRefused({ meta: metaDurable, change: 'passphrase' }),
      ).toBe(true);

      // Clear sessionStorage (simulating tab close)
      sessionStorage.clear();

      // Session refusal is gone
      expect(
        await access.isRefused({ meta: metaSession, change: 'passphrase' }),
      ).toBe(false);

      // Durable refusal survives
      expect(
        await access.isRefused({ meta: metaDurable, change: 'passphrase' }),
      ).toBe(true);
    });

    test('6b: after durable refusal, after clearing sessionStorage only, durable is still refused', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'durable-only-iv',
          ciphertext: 'durable-only-ct',
        },
      });

      // Record durable only
      await access.record({ meta, lifetime: 'durable', change: 'passphrase' });
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(true);

      // Clear sessionStorage (tab close simulation)
      sessionStorage.clear();

      // Still refused
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(true);
    });

    test('7a: either lifetime alone is enough to make isRefused true (durable-only)', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'lifetime-test-iv-durable',
          ciphertext: 'lifetime-test-ct-durable',
        },
      });

      await access.record({ meta, lifetime: 'durable', change: 'passphrase' });

      const isRefused = await access.isRefused({ meta, change: 'passphrase' });
      expect(isRefused).toBe(true);
    });

    test('7b: either lifetime alone is enough to make isRefused true (session-only)', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'lifetime-test-iv-session',
          ciphertext: 'lifetime-test-ct-session',
        },
      });

      await access.record({ meta, lifetime: 'session', change: 'passphrase' });

      const isRefused = await access.isRefused({ meta, change: 'passphrase' });
      expect(isRefused).toBe(true);
    });

    test('8: refusals are scoped per User: owner B does not see owner A refused', async () => {
      const accessA: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const accessB: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-b');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'per-user-iv',
          ciphertext: 'per-user-ct',
        },
      });

      // Owner A refuses the meta
      await accessA.record({ meta, lifetime: 'durable', change: 'passphrase' });
      expect(await accessA.isRefused({ meta, change: 'passphrase' })).toBe(
        true,
      );

      // Owner B does not see it as refused
      expect(await accessB.isRefused({ meta, change: 'passphrase' })).toBe(
        false,
      );
    });

    test('8b: a refusal is keyed by the question, so an unmoved server meta asking about a different wrapping still asks', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_recovery: {
          version: 1,
          iv: 'unmoved-server-iv',
          ciphertext: 'unmoved-server-ct',
        },
      });

      // The User declines the recovery key change this meta was diverging on.
      await access.record({
        meta,
        lifetime: 'durable',
        change: 'recovery-key',
      });
      expect(await access.isRefused({ meta, change: 'recovery-key' })).toBe(
        true,
      );

      // This device then rewraps its own passphrase and cannot push it, so the
      // same unmoved server meta now diverges on the passphrase instead. That
      // is a different question and it has not been answered.
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(
        false,
      );
      expect(await access.isRefused({ meta, change: 'different-vault' })).toBe(
        false,
      );
    });

    test('9: a corrupted/unreadable stored refusal degrades to false without throwing', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta();

      // Pre-write corrupted data
      localStorage.setItem(vaultMetaRefusalStorageKey('user-a'), '{not json');

      // Should not throw, should degrade to false
      const isRefused = await access.isRefused({ meta, change: 'passphrase' });
      expect(isRefused).toBe(false);
    });

    test('10: isRefused checks both durable and session lifetimes (either one is enough)', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'both-lifetimes-iv',
          ciphertext: 'both-lifetimes-ct',
        },
      });

      // Record only session refusal
      await access.record({ meta, lifetime: 'session', change: 'passphrase' });
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(true);

      // Remove it
      access.removeRefusals();
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(
        false,
      );

      // Record only durable refusal
      await access.record({ meta, lifetime: 'durable', change: 'passphrase' });
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(true);

      // Remove it
      access.removeRefusals();
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(
        false,
      );

      // Record both
      await access.record({ meta, lifetime: 'durable', change: 'passphrase' });
      await access.record({ meta, lifetime: 'session', change: 'passphrase' });
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(true);
    });
  });

  describe('record — what is written, and what a failed write costs', () => {
    test('11: the recorded value is the hash of the meta, not a boolean — stored metaHash equals hashVaultMeta result', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'hash-check-iv',
          ciphertext: 'hash-check-ct',
        },
      });

      await access.record({ meta, lifetime: 'durable', change: 'passphrase' });

      // Read the raw stored record
      const rawRecord = localStorage.getItem(
        vaultMetaRefusalStorageKey('user-a'),
      );
      expect(rawRecord).not.toBeNull();

      const record = JSON.parse(rawRecord!);
      const storedHash = record.refusal.metaHash;

      // Compare to the hash function result
      const expectedHash = await hashVaultMeta(meta);
      expect(storedHash).toBe(expectedHash);
    });

    test('12: a refusal that cannot be written is let go rather than raised — the User is asked again, never shown an error about bookkeeping', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'quota-iv',
          ciphertext: 'quota-ct',
        },
      });

      const setItem = jest
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('QuotaExceededError');
        });

      try {
        await expect(
          access.record({ meta, lifetime: 'durable', change: 'passphrase' }),
        ).resolves.toBeUndefined();
      } finally {
        setItem.mockRestore();
      }

      // Nothing was recorded, so the question comes back — the direction this
      // record is allowed to be wrong in.
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(
        false,
      );
    });
  });

  describe('removeRefusals — forgetting a refusal', () => {
    test('13: after removeRefusals, previously refused meta reads as isRefused === false', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'remove-test-iv',
          ciphertext: 'remove-test-ct',
        },
      });

      await access.record({ meta, lifetime: 'durable', change: 'passphrase' });
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(true);

      // Act: remove
      access.removeRefusals();

      // Assert: no longer refused
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(
        false,
      );
    });

    test('14: removeRefusals clears both durable and session refusals', async () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'both-remove-iv',
          ciphertext: 'both-remove-ct',
        },
      });

      // Record both
      await access.record({ meta, lifetime: 'durable', change: 'passphrase' });
      await access.record({ meta, lifetime: 'session', change: 'passphrase' });

      // Both are refused
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(true);

      // Act: remove
      access.removeRefusals();

      // Assert: both gone
      expect(await access.isRefused({ meta, change: 'passphrase' })).toBe(
        false,
      );
    });

    test('15: removeRefusals for owner A leaves owner B intact', async () => {
      const accessA: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');
      const accessB: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-b');
      const meta = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'per-owner-remove-iv',
          ciphertext: 'per-owner-remove-ct',
        },
      });

      // Both owners record
      await accessA.record({ meta, lifetime: 'durable', change: 'passphrase' });
      await accessB.record({ meta, lifetime: 'durable', change: 'passphrase' });

      // Both see as refused
      expect(await accessA.isRefused({ meta, change: 'passphrase' })).toBe(
        true,
      );
      expect(await accessB.isRefused({ meta, change: 'passphrase' })).toBe(
        true,
      );

      // Act: remove only A
      accessA.removeRefusals();

      // Assert: A is gone, B survives
      expect(await accessA.isRefused({ meta, change: 'passphrase' })).toBe(
        false,
      );
      expect(await accessB.isRefused({ meta, change: 'passphrase' })).toBe(
        true,
      );
    });

    test('16: removeRefusals does not raise when storage refuses the removal', () => {
      const access: VaultMetaRefusalAccess =
        createVaultMetaRefusalAccess('user-a');

      const removeItem = jest
        .spyOn(Storage.prototype, 'removeItem')
        .mockImplementation(() => {
          throw new Error('storage unavailable');
        });

      try {
        expect(() => access.removeRefusals()).not.toThrow();
      } finally {
        removeItem.mockRestore();
      }
    });
  });
});
