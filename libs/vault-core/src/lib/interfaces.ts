import type { VaultRecordType } from './types';

export interface VaultStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem?(key: string): Promise<void> | void;
}

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

export interface VaultService {
  loadEncryptedVault(): Promise<string | null>;
  saveEncryptedVault(value: string): Promise<void>;

  loadDecryptedData<T>(params: {
    masterKeyBytes: Uint8Array;
    type: VaultRecordType;
    defaultValue: T;
  }): Promise<T>;

  saveEncryptedData(params: {
    masterKeyBytes: Uint8Array;
    type: VaultRecordType;
    value: unknown;
  }): Promise<void>;
}
