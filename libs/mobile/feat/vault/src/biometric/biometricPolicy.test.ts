import type { BiometricKeystore, BiometricKeystoreRead } from './keystore';
import { bytesToBase64 } from '../bytes';
import {
  mayEnableBiometricUnlock,
  readBiometricUnlockState,
  enableBiometricUnlock,
  disableBiometricUnlock,
  unlockWithBiometrics,
  ENROLMENT_FRESHNESS_MS,
} from './biometricPolicy';
import { authorizesPassphraseReset } from '../unlock';

/**
 * Fake in-memory BiometricKeystore for testing the policy without a device.
 * Holds a Map<userId, masterKeyBase64> and supports configurable outcomes.
 */
class FakeBiometricKeystore implements BiometricKeystore {
  private store = new Map<string, string>();
  private supportedValue = true;
  /**
   * What `read` should do instead of consulting the store. `null` is the
   * ordinary case: find this User's key, or report `missing`. A forced outcome
   * stands in for a platform the store cannot model — a dismissed prompt, an
   * enrolment change, an unrecognised error.
   */
  private forcedRead: BiometricKeystoreRead | null = null;

  setSupportedValue(value: boolean): void {
    this.supportedValue = value;
  }

  forceRead(outcome: BiometricKeystoreRead): void {
    this.forcedRead = outcome;
  }

  async isSupported(): Promise<boolean> {
    return this.supportedValue;
  }

  async has(userId: string): Promise<boolean> {
    return this.store.has(userId);
  }

  async write(userId: string, masterKeyBase64: string): Promise<void> {
    this.store.set(userId, masterKeyBase64);
  }

  async read(userId: string): Promise<BiometricKeystoreRead> {
    if (this.forcedRead !== null) return this.forcedRead;
    const masterKeyBase64 = this.store.get(userId);
    return masterKeyBase64 === undefined
      ? { outcome: 'missing' }
      : { outcome: 'ok', masterKeyBase64 };
  }

  async remove(userId: string): Promise<void> {
    this.store.delete(userId);
  }

  getStoredKey(userId: string): string | undefined {
    return this.store.get(userId);
  }
}

describe('biometricPolicy.ts', () => {
  let keystore: FakeBiometricKeystore;

  beforeEach(() => {
    keystore = new FakeBiometricKeystore();
  });

  describe('mayEnableBiometricUnlock', () => {
    it('returns true for passphrase with fresh unlockedAt', () => {
      const now = 1000000;
      const unlockedAt = now - 60000; // 1 minute ago

      const result = mayEnableBiometricUnlock({
        secret: 'passphrase',
        unlockedAt,
        now,
      });

      expect(result).toBe(true);
    });

    it('returns true for passphrase with age exactly 0', () => {
      const now = 1000000;
      const result = mayEnableBiometricUnlock({
        secret: 'passphrase',
        unlockedAt: now,
        now,
      });

      expect(result).toBe(true);
    });

    it('returns false when unlockedAt is null', () => {
      const result = mayEnableBiometricUnlock({
        secret: 'passphrase',
        unlockedAt: null,
        now: 1000000,
      });

      expect(result).toBe(false);
    });

    it('returns false when now < unlockedAt (clock moved backwards)', () => {
      const now = 1000000;
      const unlockedAt = 1000100; // in the future
      const result = mayEnableBiometricUnlock({
        secret: 'passphrase',
        unlockedAt,
        now,
      });

      expect(result).toBe(false);
    });

    describe('boundary test: enrolment freshness', () => {
      it('returns true at ENROLMENT_FRESHNESS_MS - 1', () => {
        const now = 1000000;
        const unlockedAt = now - (ENROLMENT_FRESHNESS_MS - 1);

        const result = mayEnableBiometricUnlock({
          secret: 'passphrase',
          unlockedAt,
          now,
        });

        expect(result).toBe(true);
      });

      it('returns true at exactly ENROLMENT_FRESHNESS_MS (inclusive)', () => {
        const now = 1000000;
        const unlockedAt = now - ENROLMENT_FRESHNESS_MS;

        const result = mayEnableBiometricUnlock({
          secret: 'passphrase',
          unlockedAt,
          now,
        });

        expect(result).toBe(true);
      });

      it('returns false at ENROLMENT_FRESHNESS_MS + 1', () => {
        const now = 1000000;
        const unlockedAt = now - (ENROLMENT_FRESHNESS_MS + 1);

        const result = mayEnableBiometricUnlock({
          secret: 'passphrase',
          unlockedAt,
          now,
        });

        expect(result).toBe(false);
      });
    });

    it('returns false for recovery-key even with fresh unlockedAt', () => {
      const now = 1000000;
      const result = mayEnableBiometricUnlock({
        secret: 'recovery-key',
        unlockedAt: now - 60000,
        now,
      });

      expect(result).toBe(false);
    });

    it('returns false for biometric even with fresh unlockedAt', () => {
      const now = 1000000;
      const result = mayEnableBiometricUnlock({
        secret: 'biometric',
        unlockedAt: now - 60000,
        now,
      });

      expect(result).toBe(false);
    });
  });

  describe('readBiometricUnlockState', () => {
    it('returns unsupported when keystore is not supported', async () => {
      keystore.setSupportedValue(false);

      const state = await readBiometricUnlockState(keystore, 'user-a');

      expect(state).toBe('unsupported');
    });

    it('returns off when supported and nothing is stored', async () => {
      keystore.setSupportedValue(true);

      const state = await readBiometricUnlockState(keystore, 'user-a');

      expect(state).toBe('off');
    });

    it('returns on when supported and item exists for user', async () => {
      keystore.setSupportedValue(true);
      await keystore.write('user-a', bytesToBase64(new Uint8Array(32)));

      const state = await readBiometricUnlockState(keystore, 'user-a');

      expect(state).toBe('on');
    });

    it('is bound to one user: different user is off', async () => {
      keystore.setSupportedValue(true);
      await keystore.write('user-a', bytesToBase64(new Uint8Array(32)));

      const stateB = await readBiometricUnlockState(keystore, 'user-b');

      expect(stateB).toBe('off');
    });
  });

  describe('enableBiometricUnlock', () => {
    it('enables with fresh passphrase authorization and returns outcome enabled', async () => {
      keystore.setSupportedValue(true);
      const masterKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const now = 1000000;

      const result = await enableBiometricUnlock({
        keystore,
        userId: 'user-a',
        masterKey,
        authorization: { secret: 'passphrase', unlockedAt: now - 60000, now },
      });

      expect(result).toEqual({ outcome: 'enabled' });
    });

    it('stores master key as base64', async () => {
      keystore.setSupportedValue(true);
      const masterKey = new Uint8Array([42, 43, 44, 45]);
      const now = 1000000;

      await enableBiometricUnlock({
        keystore,
        userId: 'user-a',
        masterKey,
        authorization: { secret: 'passphrase', unlockedAt: now - 60000, now },
      });

      const stored = keystore.getStoredKey('user-a');
      expect(stored).toBe(bytesToBase64(masterKey));
    });

    it('refuses with recovery-key secret and does not write', async () => {
      keystore.setSupportedValue(true);
      const masterKey = new Uint8Array(32);
      const now = 1000000;

      const result = await enableBiometricUnlock({
        keystore,
        userId: 'user-a',
        masterKey,
        authorization: { secret: 'recovery-key', unlockedAt: now - 60000, now },
      });

      expect(result).toEqual({
        outcome: 'refused',
        reason: 'not-passphrase',
      });
      expect(keystore.getStoredKey('user-a')).toBe(undefined);
    });

    it('refuses with biometric secret and does not write', async () => {
      keystore.setSupportedValue(true);
      const masterKey = new Uint8Array(32);
      const now = 1000000;

      const result = await enableBiometricUnlock({
        keystore,
        userId: 'user-a',
        masterKey,
        authorization: { secret: 'biometric', unlockedAt: now - 60000, now },
      });

      expect(result).toEqual({
        outcome: 'refused',
        reason: 'not-passphrase',
      });
      expect(keystore.getStoredKey('user-a')).toBe(undefined);
    });

    it('refuses with stale passphrase authorization and does not write', async () => {
      keystore.setSupportedValue(true);
      const masterKey = new Uint8Array(32);
      const now = 1000000;

      const result = await enableBiometricUnlock({
        keystore,
        userId: 'user-a',
        masterKey,
        authorization: {
          secret: 'passphrase',
          unlockedAt: now - (ENROLMENT_FRESHNESS_MS + 10000),
          now,
        },
      });

      expect(result).toEqual({
        outcome: 'refused',
        reason: 'stale-passphrase',
      });
      expect(keystore.getStoredKey('user-a')).toBe(undefined);
    });

    it('refuses with null unlockedAt and does not write', async () => {
      keystore.setSupportedValue(true);
      const masterKey = new Uint8Array(32);
      const now = 1000000;

      const result = await enableBiometricUnlock({
        keystore,
        userId: 'user-a',
        masterKey,
        authorization: { secret: 'passphrase', unlockedAt: null, now },
      });

      expect(result).toEqual({
        outcome: 'refused',
        reason: 'stale-passphrase',
      });
      expect(keystore.getStoredKey('user-a')).toBe(undefined);
    });

    it('refuses non-passphrase before checking freshness (ordering test)', async () => {
      keystore.setSupportedValue(true);
      const masterKey = new Uint8Array(32);
      const now = 1000000;

      const result = await enableBiometricUnlock({
        keystore,
        userId: 'user-a',
        masterKey,
        authorization: {
          secret: 'recovery-key',
          unlockedAt: now - (ENROLMENT_FRESHNESS_MS + 10000), // stale
          now,
        },
      });

      expect(result).toEqual({
        outcome: 'refused',
        reason: 'not-passphrase',
      });
    });

    it('refuses when keystore is unsupported and does not write', async () => {
      keystore.setSupportedValue(false);
      const masterKey = new Uint8Array(32);
      const now = 1000000;

      const result = await enableBiometricUnlock({
        keystore,
        userId: 'user-a',
        masterKey,
        authorization: { secret: 'passphrase', unlockedAt: now - 60000, now },
      });

      expect(result).toEqual({
        outcome: 'refused',
        reason: 'unsupported',
      });
      expect(keystore.getStoredKey('user-a')).toBe(undefined);
    });

    it('returns failed when keystore write throws', async () => {
      const writeError = new Error('Write failed');
      const errorKeystore: BiometricKeystore = {
        isSupported: async () => true,
        has: async () => false,
        write: async () => {
          throw writeError;
        },
        read: async () => ({ outcome: 'missing' }),
        remove: async () => {
          throw new Error('remove should not be called in this test');
        },
      };

      const masterKey = new Uint8Array(32);
      const now = 1000000;
      const result = await enableBiometricUnlock({
        keystore: errorKeystore,
        userId: 'user-a',
        masterKey,
        authorization: { secret: 'passphrase', unlockedAt: now - 60000, now },
      });

      expect(result.outcome).toBe('failed');
      if (result.outcome === 'failed') {
        expect(result.error).toBe(writeError);
      }
    });
  });

  describe('disableBiometricUnlock', () => {
    it('removes the item for a user', async () => {
      keystore.setSupportedValue(true);
      await keystore.write('user-a', bytesToBase64(new Uint8Array(32)));

      await disableBiometricUnlock(keystore, 'user-a');

      expect(keystore.getStoredKey('user-a')).toBeUndefined();
    });

    it('is idempotent: succeeds when called twice', async () => {
      await disableBiometricUnlock(keystore, 'user-a');
      await disableBiometricUnlock(keystore, 'user-a');

      expect(keystore.getStoredKey('user-a')).toBeUndefined();
    });

    it('is user-isolated: removing user-a leaves user-b', async () => {
      keystore.setSupportedValue(true);
      const key = bytesToBase64(new Uint8Array(32));
      await keystore.write('user-a', key);
      await keystore.write('user-b', key);

      await disableBiometricUnlock(keystore, 'user-a');

      expect(keystore.getStoredKey('user-a')).toBe(undefined);
      expect(keystore.getStoredKey('user-b')).toBe(key);
    });
  });

  describe('unlockWithBiometrics', () => {
    it('unlocks and returns master key when read succeeds and key opens vault', async () => {
      const masterKey = new Uint8Array([11, 12, 13, 14, 15, 16, 17, 18]);
      await keystore.write('user-a', bytesToBase64(masterKey));

      const result = await unlockWithBiometrics({
        keystore,
        userId: 'user-a',
        stillOpensVault: async () => true,
      });

      expect(result).toEqual({ outcome: 'unlocked', masterKey });
    });

    it('keeps item when unlocked', async () => {
      const masterKey = new Uint8Array(32);
      const masterKeyBase64 = bytesToBase64(masterKey);
      await keystore.write('user-a', masterKeyBase64);

      await unlockWithBiometrics({
        keystore,
        userId: 'user-a',
        stillOpensVault: async () => true,
      });

      expect(keystore.getStoredKey('user-a')).toBe(masterKeyBase64);
    });

    it('returns cancelled and keeps item when read returns cancelled', async () => {
      keystore.forceRead({ outcome: 'cancelled' });
      const masterKey = new Uint8Array(32);
      const masterKeyBase64 = bytesToBase64(masterKey);
      await keystore.write('user-a', masterKeyBase64);

      const result = await unlockWithBiometrics({
        keystore,
        userId: 'user-a',
        stillOpensVault: async () => true,
      });

      expect(result).toEqual({ outcome: 'cancelled' });
      expect(keystore.getStoredKey('user-a')).toBe(masterKeyBase64);
    });

    it('returns unavailable with missing reason when read returns missing', async () => {
      const result = await unlockWithBiometrics({
        keystore,
        userId: 'user-a',
        stillOpensVault: async () => true,
      });

      expect(result).toEqual({
        outcome: 'unavailable',
        reason: 'missing',
      });
    });

    it('returns unavailable with invalidated reason and deletes item when read returns invalidated', async () => {
      keystore.forceRead({ outcome: 'invalidated' });
      const masterKey = new Uint8Array(32);
      await keystore.write('user-a', bytesToBase64(masterKey));

      const result = await unlockWithBiometrics({
        keystore,
        userId: 'user-a',
        stillOpensVault: async () => true,
      });

      expect(result).toEqual({
        outcome: 'unavailable',
        reason: 'invalidated',
      });
      expect(keystore.getStoredKey('user-a')).toBeUndefined();
    });

    it('returns unavailable with stale reason and deletes item when stillOpensVault returns false', async () => {
      const masterKey = new Uint8Array(32);
      await keystore.write('user-a', bytesToBase64(masterKey));

      const result = await unlockWithBiometrics({
        keystore,
        userId: 'user-a',
        stillOpensVault: async () => false,
      });

      expect(result).toEqual({
        outcome: 'unavailable',
        reason: 'stale',
      });
      expect(keystore.getStoredKey('user-a')).toBeUndefined();
    });

    it('returns failed and keeps item when stillOpensVault throws', async () => {
      const masterKey = new Uint8Array(32);
      const masterKeyBase64 = bytesToBase64(masterKey);
      await keystore.write('user-a', masterKeyBase64);
      const error = new Error('Network failure');

      const result = await unlockWithBiometrics({
        keystore,
        userId: 'user-a',
        stillOpensVault: async () => {
          throw error;
        },
      });

      expect(result).toEqual({ outcome: 'failed', error });
      expect(keystore.getStoredKey('user-a')).toBe(masterKeyBase64);
    });

    it('returns failed and keeps item when read returns failed', async () => {
      const error = new Error('Platform error');
      keystore.forceRead({ outcome: 'failed', error });

      const result = await unlockWithBiometrics({
        keystore,
        userId: 'user-a',
        stillOpensVault: async () => true,
      });

      expect(result).toEqual({ outcome: 'failed', error });
    });

    it('is user-isolated: does not return user-a key for user-b', async () => {
      const keyA = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]);
      const keyABase64 = bytesToBase64(keyA);
      await keystore.write('user-a', keyABase64);

      const result = await unlockWithBiometrics({
        keystore,
        userId: 'user-b',
        stillOpensVault: async () => true,
      });

      expect(result).toEqual({
        outcome: 'unavailable',
        reason: 'missing',
      });
      expect(keystore.getStoredKey('user-a')).toBe(keyABase64);
    });
  });

  describe('biometric secret never authorizes passphrase reset', () => {
    it('biometric secret does not authorize reset', () => {
      expect(authorizesPassphraseReset('biometric')).toBe(false);
    });

    it('passphrase secret does not authorize reset', () => {
      expect(authorizesPassphraseReset('passphrase')).toBe(false);
    });

    it('recovery-key secret authorizes reset', () => {
      expect(authorizesPassphraseReset('recovery-key')).toBe(true);
    });
  });
});
