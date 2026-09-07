/**
 * Tests for Recovery Key Acknowledgment access layer — the comparison that
 * decides whether this device's current recovery wrapping is one nobody is
 * known to hold.
 *
 * Covers the derived-acknowledgment model: whether a wrapping is unacknowledged
 * is determined by hashing it and comparing to the owner's stored record, not
 * by reading a boolean flag.
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

import type { EncryptedBlob } from './localVaultStorage';

import {
  createRecoveryKeyAcknowledgmentAccess,
  type RecoveryKeyAcknowledgmentAccess,
} from './recoveryKeyAcknowledgment';
import { recoveryKeyAcknowledgmentStorageKey } from './recoveryKeyAcknowledgmentStorage';
import { hashCiphertext } from './syncBookmarkAccess';

const WRAPPING_A: EncryptedBlob = { iv: 'iv-a', ciphertext: 'ct-a' };
const WRAPPING_B: EncryptedBlob = { iv: 'iv-b', ciphertext: 'ct-b' };

beforeEach(() => {
  localStorage.clear();
});

describe('createRecoveryKeyAcknowledgmentAccess — access layer and comparison', () => {
  describe('isUnacknowledged — the comparison', () => {
    test('1: isUnacknowledged returns false when nothing has been recorded', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(false);
    });

    test('2: after record, isUnacknowledged returns true for the same wrapping', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      await access.record(WRAPPING_A);

      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(true);
    });

    test('3: isUnacknowledged is false for a different wrapping than was recorded', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      await access.record(WRAPPING_A);

      expect(await access.isUnacknowledged(WRAPPING_B)).toBe(false);
    });

    test('4: a storage read failure degrades to false without throwing', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      await access.record(WRAPPING_A);

      const getItem = jest
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new Error('storage unavailable');
        });

      try {
        await expect(access.isUnacknowledged(WRAPPING_A)).resolves.toBe(false);
      } finally {
        getItem.mockRestore();
      }
    });

    test('4b: a wrapping that cannot be hashed degrades to false without throwing', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      const digest = jest
        .spyOn(crypto.subtle, 'digest')
        .mockRejectedValue(new Error('subtle unavailable'));

      try {
        await expect(access.isUnacknowledged(WRAPPING_A)).resolves.toBe(false);
      } finally {
        digest.mockRestore();
      }
    });
  });

  describe('record — what is written, and what a failed write costs', () => {
    test('5: the recorded value is the hash of the wrapping — stored wrappingHash equals hashCiphertext result', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      await access.record(WRAPPING_A);

      const rawRecord = localStorage.getItem(
        recoveryKeyAcknowledgmentStorageKey('user-a'),
      );
      expect(rawRecord).not.toBeNull();

      const record = JSON.parse(rawRecord!);
      const expectedHash = await hashCiphertext(WRAPPING_A);
      expect(record.wrappingHash).toBe(expectedHash);
    });

    test('6: a record that cannot be written is let go rather than raised', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      const setItem = jest
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('QuotaExceededError');
        });

      try {
        await expect(access.record(WRAPPING_A)).resolves.toBeUndefined();
      } finally {
        setItem.mockRestore();
      }

      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(false);
    });

    test('6b: a wrapping that cannot be hashed is let go rather than raised', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      const digest = jest
        .spyOn(crypto.subtle, 'digest')
        .mockRejectedValue(new Error('subtle unavailable'));

      try {
        await expect(access.record(WRAPPING_A)).resolves.toBeUndefined();
      } finally {
        digest.mockRestore();
      }

      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(false);
    });

    test('7: recording a new wrapping replaces the previous one', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      await access.record(WRAPPING_A);
      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(true);

      await access.record(WRAPPING_B);

      expect(await access.isUnacknowledged(WRAPPING_B)).toBe(true);
      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(false);
    });
  });

  describe('acknowledge — confirming the User recorded the Recovery Key', () => {
    test('8: after acknowledge, previously unacknowledged wrapping reads as false and storage key is gone', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      await access.record(WRAPPING_A);
      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(true);

      access.acknowledge();

      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(false);
      expect(
        localStorage.getItem(recoveryKeyAcknowledgmentStorageKey('user-a')),
      ).toBeNull();
    });

    test('9: acknowledge does not raise when storage refuses the removal', () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      const removeItem = jest
        .spyOn(Storage.prototype, 'removeItem')
        .mockImplementation(() => {
          throw new Error('storage unavailable');
        });

      try {
        expect(() => access.acknowledge()).not.toThrow();
      } finally {
        removeItem.mockRestore();
      }
    });
  });

  describe('remove — forgetting a pending Acknowledgment', () => {
    test('10: after remove, previously unacknowledged wrapping reads as false and storage key is gone', async () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      await access.record(WRAPPING_A);
      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(true);

      access.remove();

      expect(await access.isUnacknowledged(WRAPPING_A)).toBe(false);
      expect(
        localStorage.getItem(recoveryKeyAcknowledgmentStorageKey('user-a')),
      ).toBeNull();
    });

    test('11: remove does not raise when storage refuses the removal', () => {
      const access: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');

      const removeItem = jest
        .spyOn(Storage.prototype, 'removeItem')
        .mockImplementation(() => {
          throw new Error('storage unavailable');
        });

      try {
        expect(() => access.remove()).not.toThrow();
      } finally {
        removeItem.mockRestore();
      }
    });
  });

  describe('per-owner isolation', () => {
    test("12: owner A's record is invisible to owner B checking the same wrapping", async () => {
      const accessA: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-a');
      const accessB: RecoveryKeyAcknowledgmentAccess =
        createRecoveryKeyAcknowledgmentAccess('user-b');

      await accessA.record(WRAPPING_A);

      expect(await accessA.isUnacknowledged(WRAPPING_A)).toBe(true);
      expect(await accessB.isUnacknowledged(WRAPPING_A)).toBe(false);
    });
  });
});
