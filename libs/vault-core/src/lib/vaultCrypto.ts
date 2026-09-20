/**
 * The one crypto suite both the Vault and its Escape Copy reader run.
 *
 * PBKDF2-SHA256 over the envelope's own iteration count, AES-256-GCM with a
 * 12-byte IV — the parameters [ADR 0039](../../../../docs/adr/0039-web-and-mobile-vaults-share-one-crypto-suite.md)
 * pins, and the parameters `cryptoCompatibility.test.ts` beside this file
 * holds web and mobile to byte for byte.
 *
 * It lives in `vault-core` rather than in `web-vault` because a third caller
 * appeared that is neither: the standalone Escape Copy reader, which is
 * bundled from this file so that it cannot drift from the exporter
 * ([ADR 0064](../../../../docs/adr/0064-an-escape-copy-is-opened-by-a-tool-that-needs-nothing-of-ours.md)).
 * `web-vault`'s `vault/crypto.ts` re-exports these names, so every existing
 * import site is unchanged.
 *
 * Every function here reaches the standard Web Crypto API and the standard
 * `btoa`/`atob`/`TextEncoder` globals, and nothing else. That is what lets the
 * reader be a single file with no dependency to fetch: Node 22 and every
 * browser the app supports provide all of them.
 */
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
  return crypto.subtle.importKey(
    'raw',
    rawKey as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function deriveKeyFromPassphrase(options: {
  passphrase: string;
  salt: Uint8Array;
  iterations: number;
}): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    utf8ToBytes(options.passphrase) as unknown as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: options.salt as unknown as BufferSource,
      iterations: options.iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function aesGcmEncrypt(options: {
  key: CryptoKey;
  plaintext: Uint8Array;
  iv: Uint8Array;
}): Promise<Uint8Array> {
  const out = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: options.iv as unknown as BufferSource },
    options.key,
    options.plaintext as unknown as BufferSource,
  );
  return new Uint8Array(out);
}

export async function aesGcmDecrypt(options: {
  key: CryptoKey;
  ciphertext: Uint8Array;
  iv: Uint8Array;
}): Promise<Uint8Array> {
  const out = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: options.iv as unknown as BufferSource },
    options.key,
    options.ciphertext as unknown as BufferSource,
  );
  return new Uint8Array(out);
}
