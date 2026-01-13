export type Base64String = string;

export function bytesToBase64(bytes: Uint8Array): Base64String {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: Base64String): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function importAesGcmKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function deriveKeyFromPassphrase(options: {
  passphrase: string;
  salt: Uint8Array;
  iterations: number;
}): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    utf8ToBytes(options.passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: options.salt,
      iterations: options.iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function aesGcmEncrypt(options: {
  key: CryptoKey;
  plaintext: Uint8Array;
  iv: Uint8Array;
}): Promise<Uint8Array> {
  const out = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: options.iv },
    options.key,
    options.plaintext
  );
  return new Uint8Array(out);
}

export async function aesGcmDecrypt(options: {
  key: CryptoKey;
  ciphertext: Uint8Array;
  iv: Uint8Array;
}): Promise<Uint8Array> {
  const out = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: options.iv },
    options.key,
    options.ciphertext
  );
  return new Uint8Array(out);
}
