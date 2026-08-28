export interface VaultCrypto {
  randomBytes(length: number): Uint8Array;

  // These methods are intentionally abstract to avoid leaking WebCrypto/CryptoKey
  // into shared code that should be usable for mobile implementations.
  deriveKeyFromPassphrase(params: {
    passphrase: string;
    salt: Uint8Array;
    iterations: number;
  }): Promise<unknown>;

  importAesGcmKey(rawKeyBytes: Uint8Array): Promise<unknown>;

  aesGcmEncrypt(params: {
    key: unknown;
    plaintext: Uint8Array;
    iv: Uint8Array;
  }): Promise<Uint8Array>;

  aesGcmDecrypt(params: {
    key: unknown;
    ciphertext: Uint8Array;
    iv: Uint8Array;
  }): Promise<Uint8Array>;
}
