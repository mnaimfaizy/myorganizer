// Web variant of ./crypto, selected by the Vite `resolve.extensions` list in
// apps/mobile/vite.config.mts (`.web.ts` precedes `.ts`).
//
// The native implementation reaches react-native-quick-crypto, a JSI module that
// pulls react-native-nitro-modules and react-native-quick-base64 into the module
// graph. Neither bundles for react-native-web: they deep-import from
// `react-native/Libraries/*` and `TurboModuleRegistry`, which react-native-web
// does not ship. Keeping the native path out of the web graph is what makes
// `nx run mobile:build` resolvable at all.
//
// The two paths are wire-compatible on purpose. WebCrypto's AES-GCM output is
// already `ciphertext || 16-byte authTag`, which is the exact layout
// aesGcmEncryptNative assembles by hand, so a blob written on one platform
// decrypts on the other. libs/vault-core/src/lib/cryptoCompatibility.test.ts pins
// that shared format.
import type { VaultCrypto } from '@myorganizer/vault-core';

type AesGcmKey = CryptoKey;

const AUTH_TAG_BITS = 128;

function subtle(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error(
      'WebCrypto SubtleCrypto is unavailable; the vault needs a secure context (HTTPS or localhost).',
    );
  }
  return globalThis.crypto.subtle;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export class MobileVaultCrypto implements VaultCrypto {
  randomBytes(length: number): Uint8Array {
    return globalThis.crypto.getRandomValues(new Uint8Array(length));
  }

  async deriveKeyFromPassphrase(params: {
    passphrase: string;
    salt: Uint8Array;
    iterations: number;
  }): Promise<AesGcmKey> {
    const baseKey = await subtle().importKey(
      'raw',
      utf8ToBytes(params.passphrase),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return subtle().deriveKey(
      {
        name: 'PBKDF2',
        salt: params.salt,
        iterations: params.iterations,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  async importAesGcmKey(rawKeyBytes: Uint8Array): Promise<AesGcmKey> {
    return subtle().importKey('raw', rawKeyBytes, { name: 'AES-GCM' }, true, [
      'encrypt',
      'decrypt',
    ]);
  }

  async aesGcmEncrypt(params: {
    key: unknown;
    plaintext: Uint8Array;
    iv: Uint8Array;
  }): Promise<Uint8Array> {
    const encrypted = await subtle().encrypt(
      { name: 'AES-GCM', iv: params.iv, tagLength: AUTH_TAG_BITS },
      params.key as AesGcmKey,
      params.plaintext,
    );
    return new Uint8Array(encrypted);
  }

  async aesGcmDecrypt(params: {
    key: unknown;
    ciphertext: Uint8Array;
    iv: Uint8Array;
  }): Promise<Uint8Array> {
    const decrypted = await subtle().decrypt(
      { name: 'AES-GCM', iv: params.iv, tagLength: AUTH_TAG_BITS },
      params.key as AesGcmKey,
      params.ciphertext,
    );
    return new Uint8Array(decrypted);
  }
}

export const mobileVaultCrypto = new MobileVaultCrypto();
