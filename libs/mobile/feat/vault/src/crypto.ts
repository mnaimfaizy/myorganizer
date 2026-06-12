import type { VaultCrypto } from '@myorganizer/vault-core';
import {
  pbkdf2Sync,
  randomBytes as cryptoRandomBytes,
  createCipheriv,
  createDecipheriv,
} from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';

type AesGcmKey = Uint8Array;

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export function utf8ToBytes(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'utf8'));
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8');
}

function deriveKeyFromPassphraseSync(params: {
  passphrase: string;
  salt: Uint8Array;
  iterations: number;
}): Uint8Array {
  const derived = pbkdf2Sync(
    Buffer.from(params.passphrase, 'utf8'),
    Buffer.from(params.salt),
    params.iterations,
    32,
    'sha256'
  );
  return new Uint8Array(derived);
}

function aesGcmEncryptNative(params: {
  key: AesGcmKey;
  plaintext: Uint8Array;
  iv: Uint8Array;
}): Uint8Array {
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(params.key),
    Buffer.from(params.iv)
  );
  const encrypted = cipher.update(Buffer.from(params.plaintext));
  const final = cipher.final();
  const authTag = cipher.getAuthTag();

  const result = new Uint8Array(encrypted.length + final.length + authTag.length);
  result.set(new Uint8Array(encrypted), 0);
  result.set(new Uint8Array(final), encrypted.length);
  result.set(new Uint8Array(authTag), encrypted.length + final.length);

  return result;
}

function aesGcmDecryptNative(params: {
  key: AesGcmKey;
  ciphertext: Uint8Array;
  iv: Uint8Array;
}): Uint8Array {
  const authTagLength = 16;
  const encryptedData = params.ciphertext.slice(0, -authTagLength);
  const authTag = params.ciphertext.slice(-authTagLength);

  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(params.key),
    Buffer.from(params.iv)
  );
  decipher.setAuthTag(Buffer.from(authTag));
  const decrypted = decipher.update(Buffer.from(encryptedData));
  const final = decipher.final();

  const result = new Uint8Array(decrypted.length + final.length);
  result.set(new Uint8Array(decrypted), 0);
  result.set(new Uint8Array(final), decrypted.length);

  return result;
}

export class MobileVaultCrypto implements VaultCrypto {
  randomBytes(length: number): Uint8Array {
    const buffer = cryptoRandomBytes(length);
    return new Uint8Array(buffer);
  }

  async deriveKeyFromPassphrase(params: {
    passphrase: string;
    salt: Uint8Array;
    iterations: number;
  }): Promise<AesGcmKey> {
    return deriveKeyFromPassphraseSync(params);
  }

  async importAesGcmKey(rawKeyBytes: Uint8Array): Promise<AesGcmKey> {
    return rawKeyBytes;
  }

  async aesGcmEncrypt(params: {
    key: unknown;
    plaintext: Uint8Array;
    iv: Uint8Array;
  }): Promise<Uint8Array> {
    return aesGcmEncryptNative({
      key: params.key as AesGcmKey,
      plaintext: params.plaintext,
      iv: params.iv,
    });
  }

  async aesGcmDecrypt(params: {
    key: unknown;
    ciphertext: Uint8Array;
    iv: Uint8Array;
  }): Promise<Uint8Array> {
    return aesGcmDecryptNative({
      key: params.key as AesGcmKey,
      ciphertext: params.ciphertext,
      iv: params.iv,
    });
  }
}

export const mobileVaultCrypto = new MobileVaultCrypto();
