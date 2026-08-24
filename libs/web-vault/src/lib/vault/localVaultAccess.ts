/**
 * Every Local Vault operation, expressed against a single slot.
 *
 * This module is deliberately absent from the library's public surface. The
 * only supported way to reach it is `createVaultHandle`, which binds a slot to
 * one owner — see `vaultHandle.ts` and ADR 0047. The shim reaches it directly
 * for the one case that has no owner to bind, and the shim is temporary.
 */
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
import type {
  EncryptedBlob,
  LocalVaultReadResult,
  LocalVaultSlot,
  VaultRecordType,
  VaultStorageV1,
  VaultUnlockResult,
} from './localVaultStorage';

const PBKDF2_ITERATIONS = 310_000;

/**
 * A wrapped Master Key would not unwrap. The secret is wrong — the Vault is
 * not corrupt and must never be offered as resettable.
 */
export class VaultSecretMismatchError extends Error {
  public readonly code = 'vault-secret-mismatch';
  public readonly secret: 'passphrase' | 'recovery-key';

  constructor(secret: 'passphrase' | 'recovery-key') {
    super(
      secret === 'passphrase'
        ? 'The passphrase does not unlock this Vault'
        : 'The recovery key does not unlock this Vault',
    );
    this.name = 'VaultSecretMismatchError';
    this.secret = secret;
    // Preserve prototype chain for instanceof checks across module boundaries.
    Object.setPrototypeOf(this, VaultSecretMismatchError.prototype);
  }
}

/** An operation needing the Master Key was called before one was bound. */
export class VaultLockedError extends Error {
  public readonly code = 'vault-locked';

  constructor() {
    super('This Vault is locked');
    this.name = 'VaultLockedError';
    Object.setPrototypeOf(this, VaultLockedError.prototype);
  }
}

export type LocalVaultAccess = {
  /** Whether a Master Key is currently bound. */
  readonly isUnlocked: boolean;

  hasVault(): boolean;
  loadVault(): VaultStorageV1 | null;
  saveVault(vault: VaultStorageV1): void;

  initialize(options: { passphrase: string }): Promise<{ recoveryKey: string }>;
  unlockWithPassphrase(options: {
    passphrase: string;
  }): Promise<VaultUnlockResult>;
  unlockWithRecoveryKey(options: {
    recoveryKey: string;
  }): Promise<VaultUnlockResult>;
  changePassphrase(options: { newPassphrase: string }): Promise<void>;

  loadDecryptedData<T>(options: {
    type: VaultRecordType;
    defaultValue: T;
  }): Promise<T>;
  saveEncryptedData(options: {
    type: VaultRecordType;
    value: unknown;
  }): Promise<void>;
};

export function generateRecoveryKey(): string {
  return bytesToBase64(randomBytes(32));
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

function vaultOf(read: LocalVaultReadResult): VaultStorageV1 | null {
  return read.status === 'owned' || read.status === 'unclaimed'
    ? read.vault
    : null;
}

export function createLocalVaultAccess(options: {
  slot: LocalVaultSlot;
  masterKeyBytes?: Uint8Array | null;
}): LocalVaultAccess {
  const slot = options.slot;
  let boundMasterKeyBytes: Uint8Array | null = options.masterKeyBytes ?? null;

  const requireMasterKey = (): Uint8Array => {
    if (!boundMasterKeyBytes) throw new VaultLockedError();
    return boundMasterKeyBytes;
  };

  const requireVault = (): {
    read: LocalVaultReadResult;
    vault: VaultStorageV1;
  } => {
    const read = slot.read();
    const vault = vaultOf(read);
    if (!vault) throw new Error('Vault is not initialized');
    return { read, vault };
  };

  /**
   * Unwrap, then claim. A failed unwrap returns before anything is written, so
   * an Unclaimed Local Vault survives it byte-identical.
   */
  const unwrapAndClaim = async (options: {
    read: LocalVaultReadResult;
    vault: VaultStorageV1;
    wrappingKey: CryptoKey;
    wrapped: EncryptedBlob;
    secret: 'passphrase' | 'recovery-key';
  }): Promise<VaultUnlockResult> => {
    let masterKeyBytes: Uint8Array;
    try {
      masterKeyBytes = await unwrapMasterKeyWithKey({
        wrappingKey: options.wrappingKey,
        wrapped: options.wrapped,
      });
    } catch {
      throw new VaultSecretMismatchError(options.secret);
    }

    if (options.read.status === 'unclaimed') {
      slot.claim(options.vault);
    }

    boundMasterKeyBytes = masterKeyBytes;
    return { masterKeyBytes };
  };

  return {
    get isUnlocked() {
      return boundMasterKeyBytes !== null;
    },

    hasVault() {
      return vaultOf(slot.read()) !== null;
    },

    loadVault() {
      return vaultOf(slot.read());
    },

    saveVault(vault) {
      slot.write(vault);
    },

    async initialize({ passphrase }) {
      const salt = randomBytes(16);
      const derivedKey = await deriveKeyFromPassphrase({
        passphrase,
        salt,
        iterations: PBKDF2_ITERATIONS,
      });

      const masterKeyBytes = randomBytes(32);

      const recoveryKey = generateRecoveryKey();
      const recoveryWrappingKey = await importAesGcmKey(
        base64ToBytes(recoveryKey),
      );

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

      slot.write(vault);

      return { recoveryKey };
    },

    async unlockWithPassphrase({ passphrase }) {
      const { read, vault } = requireVault();

      const derivedKey = await deriveKeyFromPassphrase({
        passphrase,
        salt: base64ToBytes(vault.kdf.salt),
        iterations: vault.kdf.iterations,
      });

      return unwrapAndClaim({
        read,
        vault,
        wrappingKey: derivedKey,
        wrapped: vault.masterKeyWrappedWithPassphrase,
        secret: 'passphrase',
      });
    },

    async unlockWithRecoveryKey({ recoveryKey }) {
      const { read, vault } = requireVault();

      let recoveryWrappingKey: CryptoKey;
      try {
        recoveryWrappingKey = await importAesGcmKey(base64ToBytes(recoveryKey));
      } catch {
        // A recovery key that is not even importable is still a wrong secret,
        // not a damaged Vault.
        throw new VaultSecretMismatchError('recovery-key');
      }

      return unwrapAndClaim({
        read,
        vault,
        wrappingKey: recoveryWrappingKey,
        wrapped: vault.masterKeyWrappedWithRecoveryKey,
        secret: 'recovery-key',
      });
    },

    async changePassphrase({ newPassphrase }) {
      const masterKeyBytes = requireMasterKey();
      const { vault } = requireVault();

      const derivedKey = await deriveKeyFromPassphrase({
        passphrase: newPassphrase,
        salt: base64ToBytes(vault.kdf.salt),
        iterations: vault.kdf.iterations,
      });

      vault.masterKeyWrappedWithPassphrase = await wrapMasterKeyWithKey({
        wrappingKey: derivedKey,
        masterKeyBytes,
      });

      slot.write(vault);
    },

    async loadDecryptedData<T>({
      type,
      defaultValue,
    }: {
      type: VaultRecordType;
      defaultValue: T;
    }): Promise<T> {
      const masterKeyBytes = requireMasterKey();

      const vault = vaultOf(slot.read());
      if (!vault) return defaultValue;

      const blob = vault.data[type];
      if (!blob) return defaultValue;

      const masterKey = await importAesGcmKey(masterKeyBytes);
      return decryptJsonWithMasterKey<T>({ masterKey, blob });
    },

    async saveEncryptedData({ type, value }) {
      const masterKeyBytes = requireMasterKey();
      const { vault } = requireVault();

      const masterKey = await importAesGcmKey(masterKeyBytes);
      vault.data[type] = await encryptJsonWithMasterKey({ masterKey, value });

      slot.write(vault);
    },
  };
}
