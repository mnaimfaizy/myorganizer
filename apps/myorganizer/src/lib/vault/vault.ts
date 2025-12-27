import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  deriveKeyFromPassphrase,
  importAesGcmKey,
  randomBytes,
  utf8ToBytes,
} from './crypto';

const VAULT_STORAGE_KEY = 'myorganizer_vault_v1';
const PBKDF2_ITERATIONS = 310_000;

export type VaultRecordType = 'addresses' | 'mobileNumbers';

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};

export type VaultStorageV1 = {
  version: 1;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  masterKeyWrappedWithPassphrase: EncryptedBlob;
  masterKeyWrappedWithRecoveryKey: EncryptedBlob;
  data: {
    addresses?: EncryptedBlob;
    mobileNumbers?: EncryptedBlob;
  };
};

export type VaultUnlockResult = {
  masterKeyBytes: Uint8Array;
};

export function loadVault(): VaultStorageV1 | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as VaultStorageV1;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveVault(vault: VaultStorageV1): void {
  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
}

export function hasVault(): boolean {
  return loadVault() !== null;
}

export function generateRecoveryKey(): string {
  // User-facing: base64 32 bytes. Later we can switch to a word list.
  const bytes = randomBytes(32);
  return bytesToBase64(bytes);
}

async function wrapMasterKeyWithKey(options: {
  wrappingKey: CryptoKey;
  masterKeyBytes: Uint8Array;
}): Promise<EncryptedBlob> {
  const iv = randomBytes(12);
  const ciphertext = await aesGcmEncrypt({
    key: options.wrappingKey,
    plaintext: options.masterKeyBytes,
    iv,
  });

  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

async function unwrapMasterKeyWithKey(options: {
  wrappingKey: CryptoKey;
  wrapped: EncryptedBlob;
}): Promise<Uint8Array> {
  const iv = base64ToBytes(options.wrapped.iv);
  const ciphertext = base64ToBytes(options.wrapped.ciphertext);
  return aesGcmDecrypt({ key: options.wrappingKey, iv, ciphertext });
}

export async function initializeVault(options: {
  passphrase: string;
}): Promise<{ recoveryKey: string }> {
  const salt = randomBytes(16);
  const derivedKey = await deriveKeyFromPassphrase({
    passphrase: options.passphrase,
    salt,
    iterations: PBKDF2_ITERATIONS,
  });

  const masterKeyBytes = randomBytes(32);

  const recoveryKey = generateRecoveryKey();
  const recoveryKeyBytes = base64ToBytes(recoveryKey);
  const recoveryWrappingKey = await importAesGcmKey(recoveryKeyBytes);

  const vault: VaultStorageV1 = {
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    masterKeyWrappedWithPassphrase: await wrapMasterKeyWithKey({
      wrappingKey: derivedKey,
      masterKeyBytes,
    }),
    masterKeyWrappedWithRecoveryKey: await wrapMasterKeyWithKey({
      wrappingKey: recoveryWrappingKey,
      masterKeyBytes,
    }),
    data: {},
  };

  saveVault(vault);

  return { recoveryKey };
}

export async function unlockVaultWithPassphrase(options: {
  passphrase: string;
}): Promise<VaultUnlockResult> {
  const vault = loadVault();
  if (!vault) {
    throw new Error('Vault is not initialized');
  }

  const salt = base64ToBytes(vault.kdf.salt);
  const derivedKey = await deriveKeyFromPassphrase({
    passphrase: options.passphrase,
    salt,
    iterations: vault.kdf.iterations,
  });

  const masterKeyBytes = await unwrapMasterKeyWithKey({
    wrappingKey: derivedKey,
    wrapped: vault.masterKeyWrappedWithPassphrase,
  });

  return { masterKeyBytes };
}

export async function unlockVaultWithRecoveryKey(options: {
  recoveryKey: string;
}): Promise<VaultUnlockResult> {
  const vault = loadVault();
  if (!vault) {
    throw new Error('Vault is not initialized');
  }

  const recoveryKeyBytes = base64ToBytes(options.recoveryKey);
  const recoveryWrappingKey = await importAesGcmKey(recoveryKeyBytes);

  const masterKeyBytes = await unwrapMasterKeyWithKey({
    wrappingKey: recoveryWrappingKey,
    wrapped: vault.masterKeyWrappedWithRecoveryKey,
  });

  return { masterKeyBytes };
}

export async function setNewPassphrase(options: {
  masterKeyBytes: Uint8Array;
  newPassphrase: string;
}): Promise<void> {
  const vault = loadVault();
  if (!vault) {
    throw new Error('Vault is not initialized');
  }

  const salt = base64ToBytes(vault.kdf.salt);
  const derivedKey = await deriveKeyFromPassphrase({
    passphrase: options.newPassphrase,
    salt,
    iterations: vault.kdf.iterations,
  });

  vault.masterKeyWrappedWithPassphrase = await wrapMasterKeyWithKey({
    wrappingKey: derivedKey,
    masterKeyBytes: options.masterKeyBytes,
  });

  saveVault(vault);
}

async function encryptJsonWithMasterKey(options: {
  masterKey: CryptoKey;
  value: unknown;
}): Promise<EncryptedBlob> {
  const iv = randomBytes(12);
  const plaintext = utf8ToBytes(JSON.stringify(options.value));
  const ciphertext = await aesGcmEncrypt({
    key: options.masterKey,
    plaintext,
    iv,
  });
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

async function decryptJsonWithMasterKey<T>(options: {
  masterKey: CryptoKey;
  blob: EncryptedBlob;
}): Promise<T> {
  const iv = base64ToBytes(options.blob.iv);
  const ciphertext = base64ToBytes(options.blob.ciphertext);
  const plaintext = await aesGcmDecrypt({
    key: options.masterKey,
    iv,
    ciphertext,
  });
  return JSON.parse(bytesToUtf8(plaintext)) as T;
}

export async function loadDecryptedData<T>(options: {
  masterKeyBytes: Uint8Array;
  type: VaultRecordType;
  defaultValue: T;
}): Promise<T> {
  const vault = loadVault();
  if (!vault) return options.defaultValue;

  const blob = vault.data[options.type];
  if (!blob) return options.defaultValue;

  const masterKey = await importAesGcmKey(options.masterKeyBytes);
  return decryptJsonWithMasterKey<T>({ masterKey, blob });
}

export async function saveEncryptedData(options: {
  masterKeyBytes: Uint8Array;
  type: VaultRecordType;
  value: unknown;
}): Promise<void> {
  const vault = loadVault();
  if (!vault) throw new Error('Vault is not initialized');

  const masterKey = await importAesGcmKey(options.masterKeyBytes);
  const blob = await encryptJsonWithMasterKey({
    masterKey,
    value: options.value,
  });

  vault.data[options.type] = blob;
  saveVault(vault);
}
