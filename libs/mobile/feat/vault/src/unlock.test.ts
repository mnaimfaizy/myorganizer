import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'node:crypto';
import type { VaultCrypto } from '@myorganizer/vault-core/portable';
import type { VaultMetaV1 } from '@myorganizer/app-api-client';
import {
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryKey,
} from './unlock';
import { bytesToBase64 } from './bytes';
import { PBKDF2_ITERATIONS } from './constants';

/**
 * A fake VaultCrypto implementation using Node.js's built-in `crypto` module.
 * Implements AES-256-GCM + PBKDF2-SHA256 matching the real `MobileVaultCrypto`.
 *
 * Ciphertext format: encrypted || final || authTag (16 bytes)
 */
class FakeVaultCrypto implements VaultCrypto {
  randomBytes(length: number): Uint8Array {
    return new Uint8Array(randomBytes(length));
  }

  async deriveKeyFromPassphrase(params: {
    passphrase: string;
    salt: Uint8Array;
    iterations: number;
  }): Promise<unknown> {
    const derived = pbkdf2Sync(
      params.passphrase,
      params.salt,
      params.iterations,
      32, // 32 bytes = 256 bits for AES-256
      'sha256',
    );
    return new Uint8Array(derived);
  }

  async importAesGcmKey(rawKeyBytes: Uint8Array): Promise<unknown> {
    // Recovery Key bytes import directly as the AES key (no derivation)
    return rawKeyBytes;
  }

  async aesGcmEncrypt(params: {
    key: unknown;
    plaintext: Uint8Array;
    iv: Uint8Array;
  }): Promise<Uint8Array> {
    const key = params.key as Uint8Array;
    const cipher = createCipheriv('aes-256-gcm', key, params.iv);
    const encrypted = cipher.update(params.plaintext);
    const final = cipher.final();
    const authTag = cipher.getAuthTag();

    // Ciphertext layout: encrypted || final || authTag (16 bytes)
    const result = new Uint8Array(
      encrypted.length + final.length + authTag.length,
    );
    result.set(encrypted, 0);
    result.set(final, encrypted.length);
    result.set(authTag, encrypted.length + final.length);

    return result;
  }

  async aesGcmDecrypt(params: {
    key: unknown;
    ciphertext: Uint8Array;
    iv: Uint8Array;
  }): Promise<Uint8Array> {
    const key = params.key as Uint8Array;
    const authTagLength = 16;

    // Split off the last 16 bytes as auth tag
    const encryptedData = params.ciphertext.slice(0, -authTagLength);
    const authTag = params.ciphertext.slice(-authTagLength);

    const decipher = createDecipheriv('aes-256-gcm', key, params.iv);
    decipher.setAuthTag(authTag);

    // AES-GCM auth tag verification failure is thrown by decipher.setAuthTag(),
    // decipher.update(), or decipher.final() and propagates naturally.
    const decrypted = decipher.update(encryptedData);
    const final = decipher.final();

    const result = new Uint8Array(decrypted.length + final.length);
    result.set(decrypted, 0);
    result.set(final, decrypted.length);

    return result;
  }
}

describe('unlock.ts', () => {
  let fakeCrypto: VaultCrypto;

  beforeEach(() => {
    fakeCrypto = new FakeVaultCrypto();
  });

  describe('unlockVaultWithRecoveryKey', () => {
    it('should unlock the vault with a correct Recovery Key', async () => {
      // Arrange: create a known Recovery Key and Master Key
      const recoveryKey = new Uint8Array(32); // 32 bytes of zeros
      recoveryKey[0] = 1; // Make it non-zero for realism
      const masterKeyPlaintext = new Uint8Array(32);
      masterKeyPlaintext[0] = 42; // Recognizable value

      // Create an IV for encryption
      const iv = randomBytes(12);

      // Encrypt the Master Key using the Recovery Key
      const wrappedCiphertext = await fakeCrypto.aesGcmEncrypt({
        key: recoveryKey,
        plaintext: masterKeyPlaintext,
        iv,
      });

      // Build the vault meta fixture
      const meta: VaultMetaV1 = {
        version: 1,
        kdf_name: 'pbkdf2-sha256',
        kdf_salt: 'AAAA', // Will be ignored for Recovery Key
        kdf_params: {},
        wrapped_mk_passphrase: { iv: 'AAAA', ciphertext: 'AAAA' },
        wrapped_mk_recovery: {
          iv: bytesToBase64(iv),
          ciphertext: bytesToBase64(wrappedCiphertext),
        },
      };

      // Act
      const outcome = await unlockVaultWithRecoveryKey(
        meta,
        bytesToBase64(recoveryKey),
        fakeCrypto,
      );

      // Assert
      expect(outcome.masterKey).toEqual(masterKeyPlaintext);
      expect(outcome.secret).toBe('recovery-key');
    });

    it('should reject when an incorrect Recovery Key is provided', async () => {
      // Arrange: create a known Recovery Key and Master Key
      const correctRecoveryKey = new Uint8Array(32);
      correctRecoveryKey[0] = 1;
      const masterKeyPlaintext = new Uint8Array(32);
      masterKeyPlaintext[0] = 42;

      // Create an IV for encryption
      const iv = randomBytes(12);

      // Encrypt the Master Key with the correct Recovery Key
      const wrappedCiphertext = await fakeCrypto.aesGcmEncrypt({
        key: correctRecoveryKey,
        plaintext: masterKeyPlaintext,
        iv,
      });

      // Create a different wrong Recovery Key
      const wrongRecoveryKey = new Uint8Array(32);
      wrongRecoveryKey[0] = 2; // Different value

      // Build the vault meta fixture
      const meta: VaultMetaV1 = {
        version: 1,
        kdf_name: 'pbkdf2-sha256',
        kdf_salt: 'AAAA',
        kdf_params: {},
        wrapped_mk_passphrase: { iv: 'AAAA', ciphertext: 'AAAA' },
        wrapped_mk_recovery: {
          iv: bytesToBase64(iv),
          ciphertext: bytesToBase64(wrappedCiphertext),
        },
      };

      // Act & Assert
      await expect(
        unlockVaultWithRecoveryKey(
          meta,
          bytesToBase64(wrongRecoveryKey),
          fakeCrypto,
        ),
      ).rejects.toThrow(); // AES-GCM auth tag verification fails
    });

    it('should record recovery-key as the Vault Unlock Secret', async () => {
      // Arrange: create known keys
      const recoveryKey = new Uint8Array(32);
      recoveryKey[0] = 1;
      const masterKeyPlaintext = new Uint8Array(32);
      masterKeyPlaintext[0] = 42;
      const iv = randomBytes(12);

      const wrappedCiphertext = await fakeCrypto.aesGcmEncrypt({
        key: recoveryKey,
        plaintext: masterKeyPlaintext,
        iv,
      });

      const meta: VaultMetaV1 = {
        version: 1,
        kdf_name: 'pbkdf2-sha256',
        kdf_salt: 'AAAA',
        kdf_params: {},
        wrapped_mk_passphrase: { iv: 'AAAA', ciphertext: 'AAAA' },
        wrapped_mk_recovery: {
          iv: bytesToBase64(iv),
          ciphertext: bytesToBase64(wrappedCiphertext),
        },
      };

      // Act
      const outcome = await unlockVaultWithRecoveryKey(
        meta,
        bytesToBase64(recoveryKey),
        fakeCrypto,
      );

      // Assert: explicitly verify the Vault Unlock Secret is recovery-key
      expect(outcome.secret).toBe('recovery-key');
    });
  });

  describe('unlockVaultWithPassphrase', () => {
    it('should unlock the vault with a correct passphrase', async () => {
      // Arrange: create a known passphrase and Master Key
      const passphrase = 'test-passphrase';
      const salt = randomBytes(16);
      const iterations = 100_000; // Use a smaller count for test speed
      const masterKeyPlaintext = new Uint8Array(32);
      masterKeyPlaintext[0] = 42;

      // Derive the wrapping key
      const wrappingKey = await fakeCrypto.deriveKeyFromPassphrase({
        passphrase,
        salt,
        iterations,
      });

      // Encrypt the Master Key
      const iv = randomBytes(12);
      const wrappedCiphertext = await fakeCrypto.aesGcmEncrypt({
        key: wrappingKey as Uint8Array,
        plaintext: masterKeyPlaintext,
        iv,
      });

      // Build the vault meta fixture
      const meta: VaultMetaV1 = {
        version: 1,
        kdf_name: 'pbkdf2-sha256',
        kdf_salt: bytesToBase64(salt),
        kdf_params: { iterations },
        wrapped_mk_passphrase: {
          iv: bytesToBase64(iv),
          ciphertext: bytesToBase64(wrappedCiphertext),
        },
        wrapped_mk_recovery: { iv: 'AAAA', ciphertext: 'AAAA' },
      };

      // Act
      const outcome = await unlockVaultWithPassphrase(
        meta,
        passphrase,
        fakeCrypto,
      );

      // Assert
      expect(outcome.masterKey).toEqual(masterKeyPlaintext);
      expect(outcome.secret).toBe('passphrase');
    });

    it('should reject when an incorrect passphrase is provided', async () => {
      // Arrange: create a known passphrase and Master Key
      const correctPassphrase = 'correct-pass';
      const wrongPassphrase = 'wrong-pass';
      const salt = randomBytes(16);
      const iterations = 100_000;
      const masterKeyPlaintext = new Uint8Array(32);
      masterKeyPlaintext[0] = 42;

      // Derive the wrapping key with the correct passphrase
      const wrappingKey = await fakeCrypto.deriveKeyFromPassphrase({
        passphrase: correctPassphrase,
        salt,
        iterations,
      });

      // Encrypt the Master Key
      const iv = randomBytes(12);
      const wrappedCiphertext = await fakeCrypto.aesGcmEncrypt({
        key: wrappingKey as Uint8Array,
        plaintext: masterKeyPlaintext,
        iv,
      });

      // Build the vault meta fixture
      const meta: VaultMetaV1 = {
        version: 1,
        kdf_name: 'pbkdf2-sha256',
        kdf_salt: bytesToBase64(salt),
        kdf_params: { iterations },
        wrapped_mk_passphrase: {
          iv: bytesToBase64(iv),
          ciphertext: bytesToBase64(wrappedCiphertext),
        },
        wrapped_mk_recovery: { iv: 'AAAA', ciphertext: 'AAAA' },
      };

      // Act & Assert
      await expect(
        unlockVaultWithPassphrase(meta, wrongPassphrase, fakeCrypto),
      ).rejects.toThrow(); // AES-GCM auth tag verification fails
    });

    it('should fall back to default PBKDF2_ITERATIONS when kdf_params.iterations is absent', async () => {
      // Arrange: create a known passphrase and Master Key
      const passphrase = 'test-passphrase';
      const salt = randomBytes(16);

      // Derive the wrapping key using the default iteration count
      const wrappingKey = await fakeCrypto.deriveKeyFromPassphrase({
        passphrase,
        salt,
        iterations: PBKDF2_ITERATIONS,
      });

      const masterKeyPlaintext = new Uint8Array(32);
      masterKeyPlaintext[0] = 42;

      // Encrypt the Master Key
      const iv = randomBytes(12);
      const wrappedCiphertext = await fakeCrypto.aesGcmEncrypt({
        key: wrappingKey as Uint8Array,
        plaintext: masterKeyPlaintext,
        iv,
      });

      // Build the vault meta fixture WITHOUT iterations in kdf_params
      const meta: VaultMetaV1 = {
        version: 1,
        kdf_name: 'pbkdf2-sha256',
        kdf_salt: bytesToBase64(salt),
        kdf_params: {}, // No iterations specified
        wrapped_mk_passphrase: {
          iv: bytesToBase64(iv),
          ciphertext: bytesToBase64(wrappedCiphertext),
        },
        wrapped_mk_recovery: { iv: 'AAAA', ciphertext: 'AAAA' },
      };

      // Act
      const outcome = await unlockVaultWithPassphrase(
        meta,
        passphrase,
        fakeCrypto,
      );

      // Assert
      expect(outcome.masterKey).toEqual(masterKeyPlaintext);
      expect(outcome.secret).toBe('passphrase');
    });
  });
});
