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
import {
  localToServerMeta,
  normalizeEncryptedBlobV1,
  serverMetaToLocalVault,
  toEncryptedBlobV1,
} from './vaultShapes';

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
  value: EncryptedBlob | undefined,
): object {
  if (!value) return { blob: null };
  const b = toEncryptedBlobV1(value);
  return normalizeServerBlob(b);
}

export async function migrateVaultPhase1ToPhase2(options: {
  api: VaultApiLike;
  localVault: VaultStorageV1 | null;
  prompt: MigrationPrompt;
}): Promise<MigrationResult> {
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
        [VaultBlobType.Subscriptions]:
          (await getServerVaultBlob(options.api, VaultBlobType.Subscriptions))
            ?.blob ?? null,
        [VaultBlobType.Todos]:
          (await getServerVaultBlob(options.api, VaultBlobType.Todos))?.blob ??
          null,
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

    if (localVault.data.subscriptions) {
      await putServerVaultBlobEtagAware({
        api: options.api,
        type: VaultBlobType.Subscriptions,
        blob: toEncryptedBlobV1(localVault.data.subscriptions),
      });
    }

    if (localVault.data.todos) {
      await putServerVaultBlobEtagAware({
        api: options.api,
        type: VaultBlobType.Todos,
        blob: toEncryptedBlobV1(localVault.data.todos),
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
    [VaultBlobType.Subscriptions]:
      (await getServerVaultBlob(options.api, VaultBlobType.Subscriptions))
        ?.blob ?? null,
    [VaultBlobType.Todos]:
      (await getServerVaultBlob(options.api, VaultBlobType.Todos))?.blob ??
      null,
  };

  const localComparable = {
    meta: normalizeLocalVaultAsServerShape(localVault),
    blobs: {
      [VaultBlobType.Addresses]: normalizeLocalBlobAsServerShape(
        localVault.data.addresses,
      ),
      [VaultBlobType.MobileNumbers]: normalizeLocalBlobAsServerShape(
        localVault.data.mobileNumbers,
      ),
      [VaultBlobType.Subscriptions]: normalizeLocalBlobAsServerShape(
        localVault.data.subscriptions,
      ),
      [VaultBlobType.Todos]: normalizeLocalBlobAsServerShape(
        localVault.data.todos,
      ),
    },
  };

  const remoteComparable = {
    meta: normalizeServerMeta(serverMeta.meta),
    blobs: {
      [VaultBlobType.Addresses]: normalizeServerBlob(
        remoteBlobs[VaultBlobType.Addresses] ?? null,
      ),
      [VaultBlobType.MobileNumbers]: normalizeServerBlob(
        remoteBlobs[VaultBlobType.MobileNumbers] ?? null,
      ),
      [VaultBlobType.Subscriptions]: normalizeServerBlob(
        remoteBlobs[VaultBlobType.Subscriptions] ?? null,
      ),
      [VaultBlobType.Todos]: normalizeServerBlob(
        remoteBlobs[VaultBlobType.Todos] ?? null,
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

  await putServerVaultMetaEtagAware({
    api: options.api,
    meta: localMeta,
    ifMatch: serverMeta.etag,
    onConflict: () => 'keep-local',
  });

  const remoteAddresses = await getServerVaultBlob(
    options.api,
    VaultBlobType.Addresses,
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
    VaultBlobType.MobileNumbers,
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

  const remoteSubscriptions = await getServerVaultBlob(
    options.api,
    VaultBlobType.Subscriptions,
  );

  if (localVault.data.subscriptions) {
    await putServerVaultBlobEtagAware({
      api: options.api,
      type: VaultBlobType.Subscriptions,
      blob: toEncryptedBlobV1(localVault.data.subscriptions),
      ifMatch: remoteSubscriptions?.etag,
      onConflict: () => 'keep-local',
    });
  }

  const remoteTodos = await getServerVaultBlob(
    options.api,
    VaultBlobType.Todos,
  );

  if (localVault.data.todos) {
    await putServerVaultBlobEtagAware({
      api: options.api,
      type: VaultBlobType.Todos,
      blob: toEncryptedBlobV1(localVault.data.todos),
      ifMatch: remoteTodos?.etag,
      onConflict: () => 'keep-local',
    });
  }

  return { kind: 'kept-local-overwrote-server' };
}
