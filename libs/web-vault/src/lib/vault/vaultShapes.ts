import {
  EncryptedBlobV1,
  VaultBlobType,
  VaultMetaV1,
} from '@myorganizer/app-api-client';

import { EncryptedBlob, VaultStorageV1 } from './vault';

export function toEncryptedBlobV1(blob: EncryptedBlob): EncryptedBlobV1 {
  return {
    version: 1,
    iv: blob.iv,
    ciphertext: blob.ciphertext,
  };
}

export function normalizeEncryptedBlobV1(value: any): EncryptedBlobV1 | null {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as any).version === 'number' &&
    (value as any).version !== 1
  ) {
    throw new Error(
      `Unsupported encrypted blob version: ${(value as any).version}`
    );
  }

  return isEncryptedBlobV1(value) ? value : null;
}

export function localToServerMeta(vault: VaultStorageV1): VaultMetaV1 {
  return {
    version: 1,
    kdf_name: vault.kdf.name,
    kdf_salt: vault.kdf.salt,
    kdf_params: {
      hash: vault.kdf.hash,
      iterations: vault.kdf.iterations,
    },
    wrapped_mk_passphrase: toEncryptedBlobV1(
      vault.masterKeyWrappedWithPassphrase
    ),
    wrapped_mk_recovery: toEncryptedBlobV1(
      vault.masterKeyWrappedWithRecoveryKey
    ),
  };
}

export function serverEncryptedBlobToLocal(
  blob: EncryptedBlobV1
): EncryptedBlob {
  return {
    iv: blob.iv,
    ciphertext: blob.ciphertext,
  };
}

export function serverMetaToLocalVault(options: {
  meta: VaultMetaV1;
  blobs: Partial<Record<VaultBlobType, EncryptedBlobV1 | null>>;
}): VaultStorageV1 {
  const { meta, blobs } = options;

  const wrappedPassphrase = normalizeEncryptedBlobV1(
    meta.wrapped_mk_passphrase
  );
  const wrappedRecovery = normalizeEncryptedBlobV1(meta.wrapped_mk_recovery);

  if (!wrappedPassphrase || !wrappedRecovery) {
    throw new Error('Server vault meta is missing wrapped keys');
  }

  if (meta.kdf_params?.hash && meta.kdf_params.hash !== 'SHA-256') {
    throw new Error(
      `Unsupported KDF hash in server vault meta: ${meta.kdf_params.hash}`
    );
  }

  const hash = 'SHA-256';
  const iterations =
    typeof meta.kdf_params?.iterations === 'number'
      ? meta.kdf_params.iterations
      : 310_000;

  const next: VaultStorageV1 = {
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash,
      iterations,
      salt: meta.kdf_salt,
    },
    masterKeyWrappedWithPassphrase:
      serverEncryptedBlobToLocal(wrappedPassphrase),
    masterKeyWrappedWithRecoveryKey:
      serverEncryptedBlobToLocal(wrappedRecovery),
    data: {},
  };

  const addresses = blobs[VaultBlobType.Addresses];
  if (addresses) {
    next.data.addresses = serverEncryptedBlobToLocal(addresses);
  }

  const mobileNumbers = blobs[VaultBlobType.MobileNumbers];
  if (mobileNumbers) {
    next.data.mobileNumbers = serverEncryptedBlobToLocal(mobileNumbers);
  }

  return next;
}

function isEncryptedBlobV1(value: any): value is EncryptedBlobV1 {
  return (
    value &&
    typeof value === 'object' &&
    value.version === 1 &&
    typeof value.iv === 'string' &&
    typeof value.ciphertext === 'string'
  );
}
