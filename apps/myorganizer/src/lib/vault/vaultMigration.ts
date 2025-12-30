import {
  EncryptedBlobV1,
  VaultApi,
  VaultBlobType,
  VaultMetaV1,
} from '@myorganizer/app-api-client';

import { getHttpStatus } from '../http/getHttpStatus';

import {
  getServerVaultBlob,
  getServerVaultMeta,
  putServerVaultBlobEtagAware,
  putServerVaultMetaEtagAware,
} from './serverVaultSync';
import { EncryptedBlob, VaultStorageV1 } from './vault';

type VaultApiLike = Pick<
  VaultApi,
  'getVaultMeta' | 'putVaultMeta' | 'getVaultBlob' | 'putVaultBlob'
>;

export type MigrationDecision = 'keep-local' | 'keep-server';

export type MigrationPrompt = (params: {
  message: string;
  local: VaultStorageV1;
  remote: {
    meta: VaultMetaV1;
    blobs: Partial<Record<VaultBlobType, EncryptedBlobV1 | null>>;
  };
}) => Promise<MigrationDecision> | MigrationDecision;

export type MigrationResult =
  | { kind: 'skipped-no-local-vault' }
  | { kind: 'skipped-not-authenticated' }
  | { kind: 'downloaded-server-to-local'; nextLocalVault: VaultStorageV1 }
  | { kind: 'uploaded-local-to-server' }
  | { kind: 'kept-local-overwrote-server' }
  | { kind: 'kept-server-overwrote-local'; nextLocalVault: VaultStorageV1 }
  | { kind: 'noop-already-in-sync' };

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return '{"$number":"NaN"}';
    }
    if (value === Number.POSITIVE_INFINITY) {
      return '{"$number":"Infinity"}';
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return '{"$number":"-Infinity"}';
    }
    return JSON.stringify(value);
  }

  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`)
    .join(',')}}`;
}

function toEncryptedBlobV1(blob: EncryptedBlob): EncryptedBlobV1 {
  return {
    version: 1,
    iv: blob.iv,
    ciphertext: blob.ciphertext,
  };
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

function normalizeEncryptedBlobV1(value: any): EncryptedBlobV1 | null {
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

function localToServerMeta(vault: VaultStorageV1): VaultMetaV1 {
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

function normalizeServerMeta(meta: VaultMetaV1): object {
  return {
    version: meta.version,
    kdf_name: meta.kdf_name,
    kdf_salt: meta.kdf_salt,
    kdf_params: meta.kdf_params,
    wrapped_mk_passphrase: normalizeEncryptedBlobV1(meta.wrapped_mk_passphrase),
    wrapped_mk_recovery: normalizeEncryptedBlobV1(meta.wrapped_mk_recovery),
  };
}

function normalizeLocalVaultAsServerShape(vault: VaultStorageV1): object {
  const meta = localToServerMeta(vault);
  return normalizeServerMeta(meta);
}

function serverEncryptedBlobToLocal(blob: EncryptedBlobV1): EncryptedBlob {
  return {
    iv: blob.iv,
    ciphertext: blob.ciphertext,
  };
}

function serverMetaToLocalVault(options: {
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

  const hash: 'SHA-256' = 'SHA-256';
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

function normalizeServerBlob(value: EncryptedBlobV1 | null): object {
  if (!value) return { blob: null };

  if (value.version !== 1) {
    throw new Error(`Unsupported vault blob version: ${value.version}`);
  }

  return {
    blob: {
      version: value.version,
      iv: value.iv,
      ciphertext: value.ciphertext,
    },
  };
}

function normalizeLocalBlobAsServerShape(
  value: EncryptedBlob | undefined
): object {
  if (!value) return { blob: null };
  const b = toEncryptedBlobV1(value);
  return normalizeServerBlob(b);
}

/**
 * Migrates a user's encrypted vault from local-only storage (Phase 1) to
 * server-backed storage (Phase 2).
 *
 * Behavior summary:
 * - If there is no local vault:
 *   - If unauthenticated (401/403): returns `skipped-not-authenticated`.
 *   - If the server has a vault: downloads it and returns `downloaded-server-to-local`.
 *   - If the server has no vault: returns `skipped-no-local-vault`.
 * - If there is a local vault:
 *   - If unauthenticated (401/403): returns `skipped-not-authenticated`.
 *   - If the server has no vault: uploads local vault and returns `uploaded-local-to-server`.
 *   - If both exist:
 *     - If they are already equivalent after normalization: returns `noop-already-in-sync`.
 *     - Otherwise: calls `prompt` to choose which copy to keep.
 *       - `keep-server`: returns `kept-server-overwrote-local` with a new local vault.
 *       - `keep-local`: overwrites server using ETag/If-Match and returns `kept-local-overwrote-server`.
 */
export async function migrateVaultPhase1ToPhase2(options: {
  api: VaultApiLike;
  localVault: VaultStorageV1 | null;
  prompt: MigrationPrompt;
}): Promise<MigrationResult> {
  // If local is missing, prefer server-backed storage and cache it locally.
  if (!options.localVault) {
    let serverMeta;
    try {
      serverMeta = await getServerVaultMeta(options.api);
    } catch (error) {
      const status = getHttpStatus(error);
      if (status === 401 || status === 403) {
        return { kind: 'skipped-not-authenticated' };
      }
      throw error;
    }

    if (!serverMeta) {
      return { kind: 'skipped-no-local-vault' };
    }

    const remoteBlobs: Partial<Record<VaultBlobType, EncryptedBlobV1 | null>> =
      {
        [VaultBlobType.Addresses]:
          (await getServerVaultBlob(options.api, VaultBlobType.Addresses))
            ?.blob ?? null,
        [VaultBlobType.MobileNumbers]:
          (await getServerVaultBlob(options.api, VaultBlobType.MobileNumbers))
            ?.blob ?? null,
      };

    const nextLocalVault = serverMetaToLocalVault({
      meta: serverMeta.meta,
      blobs: remoteBlobs,
    });

    return { kind: 'downloaded-server-to-local', nextLocalVault };
  }

  const localVault = options.localVault;

  let serverMeta;
  try {
    serverMeta = await getServerVaultMeta(options.api);
  } catch (error) {
    const status = getHttpStatus(error);
    if (status === 401 || status === 403) {
      return { kind: 'skipped-not-authenticated' };
    }
    throw error;
  }

  const localMeta = localToServerMeta(localVault);

  // Server empty => upload local
  if (!serverMeta) {
    await putServerVaultMetaEtagAware({ api: options.api, meta: localMeta });

    if (localVault.data.addresses) {
      await putServerVaultBlobEtagAware({
        api: options.api,
        type: VaultBlobType.Addresses,
        blob: toEncryptedBlobV1(localVault.data.addresses),
      });
    }

    if (localVault.data.mobileNumbers) {
      await putServerVaultBlobEtagAware({
        api: options.api,
        type: VaultBlobType.MobileNumbers,
        blob: toEncryptedBlobV1(localVault.data.mobileNumbers),
      });
    }

    return { kind: 'uploaded-local-to-server' };
  }

  const remoteBlobs: Partial<Record<VaultBlobType, EncryptedBlobV1 | null>> = {
    [VaultBlobType.Addresses]:
      (await getServerVaultBlob(options.api, VaultBlobType.Addresses))?.blob ??
      null,
    [VaultBlobType.MobileNumbers]:
      (await getServerVaultBlob(options.api, VaultBlobType.MobileNumbers))
        ?.blob ?? null,
  };

  const localComparable = {
    meta: normalizeLocalVaultAsServerShape(localVault),
    blobs: {
      [VaultBlobType.Addresses]: normalizeLocalBlobAsServerShape(
        localVault.data.addresses
      ),
      [VaultBlobType.MobileNumbers]: normalizeLocalBlobAsServerShape(
        localVault.data.mobileNumbers
      ),
    },
  };

  const remoteComparable = {
    meta: normalizeServerMeta(serverMeta.meta),
    blobs: {
      [VaultBlobType.Addresses]: normalizeServerBlob(
        remoteBlobs[VaultBlobType.Addresses] ?? null
      ),
      [VaultBlobType.MobileNumbers]: normalizeServerBlob(
        remoteBlobs[VaultBlobType.MobileNumbers] ?? null
      ),
    },
  };

  const differs =
    stableStringify(localComparable) !== stableStringify(remoteComparable);

  if (!differs) {
    return { kind: 'noop-already-in-sync' };
  }

  const decision = await options.prompt({
    message:
      'We found encrypted vault data both locally and on the server, and they differ. Choose which version to keep.',
    local: localVault,
    remote: { meta: serverMeta.meta, blobs: remoteBlobs },
  });

  if (decision === 'keep-server') {
    const nextLocalVault = serverMetaToLocalVault({
      meta: serverMeta.meta,
      blobs: remoteBlobs,
    });

    return { kind: 'kept-server-overwrote-local', nextLocalVault };
  }

  // keep-local => overwrite server with local values (ETag-aware)
  await putServerVaultMetaEtagAware({
    api: options.api,
    meta: localMeta,
    ifMatch: serverMeta.etag,
    onConflict: () => 'keep-local',
  });

  // Upload local blobs to server. Note: This only uploads blobs that exist locally.
  // Server blobs that don't exist locally are NOT deleted because the backend API
  // doesn't provide a DELETE endpoint for vault blobs. This means if the server has
  // blob types that the local vault doesn't have, they'll remain on the server.
  const remoteAddresses = await getServerVaultBlob(
    options.api,
    VaultBlobType.Addresses
  );

  if (localVault.data.addresses) {
    await putServerVaultBlobEtagAware({
      api: options.api,
      type: VaultBlobType.Addresses,
      blob: toEncryptedBlobV1(localVault.data.addresses),
      ifMatch: remoteAddresses?.etag,
      onConflict: () => 'keep-local',
    });
  }

  const remoteMobileNumbers = await getServerVaultBlob(
    options.api,
    VaultBlobType.MobileNumbers
  );

  if (localVault.data.mobileNumbers) {
    await putServerVaultBlobEtagAware({
      api: options.api,
      type: VaultBlobType.MobileNumbers,
      blob: toEncryptedBlobV1(localVault.data.mobileNumbers),
      ifMatch: remoteMobileNumbers?.etag,
      onConflict: () => 'keep-local',
    });
  }

  return { kind: 'kept-local-overwrote-server' };
}
