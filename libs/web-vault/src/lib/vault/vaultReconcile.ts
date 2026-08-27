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
import { EncryptedBlob, VaultStorageV1 } from './localVaultStorage';
import { VAULT_BLOB_FIELDS, VAULT_BLOB_TYPES } from './vaultBlobFields';
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

export type ReconcileDecision = 'keep-local' | 'keep-server';

export type ReconcilePrompt = (params: {
  message: string;
  local: VaultStorageV1;
  remote: {
    meta: VaultMetaV1;
    blobs: Partial<Record<VaultBlobType, EncryptedBlobV1 | null>>;
  };
}) => Promise<ReconcileDecision> | ReconcileDecision;

export type ReconcileResult =
  /** Neither this User's device nor the server holds a Vault yet. */
  | { kind: 'noop-nothing-to-reconcile' }
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

/** The Local Vault blob for one Vault Blob Type, if the vault carries it. */
function localBlobFor(
  vault: VaultStorageV1,
  type: VaultBlobType,
): EncryptedBlob | undefined {
  return vault.data[VAULT_BLOB_FIELDS[type]];
}

/** Reads every reconciled blob type from the server, absent ones as `null`. */
async function fetchRemoteBlobs(
  api: VaultApiLike,
): Promise<Partial<Record<VaultBlobType, EncryptedBlobV1 | null>>> {
  const remoteBlobs: Partial<Record<VaultBlobType, EncryptedBlobV1 | null>> =
    {};

  for (const type of VAULT_BLOB_TYPES) {
    remoteBlobs[type] = (await getServerVaultBlob(api, type))?.blob ?? null;
  }

  return remoteBlobs;
}

/** One normalized entry per reconciled blob type, for divergence comparison. */
function comparableBlobs(
  normalizeOne: (type: VaultBlobType) => object,
): Record<string, object> {
  const blobs: Record<string, object> = {};

  for (const type of VAULT_BLOB_TYPES) {
    blobs[type] = normalizeOne(type);
  }

  return blobs;
}

/**
 * Reconciles one User's Local Vault with their server Ciphertext on sign-in.
 *
 * This is not a migration: a User whose server Vault does not exist yet is
 * having an ordinary first sync, and a User with no Vault anywhere has
 * nothing to reconcile. Genuine divergence is never resolved silently — it
 * goes to `prompt`, and the caller's answer decides which side is kept.
 */
export async function reconcileVaultWithServer(options: {
  api: VaultApiLike;
  localVault: VaultStorageV1 | null;
  prompt: ReconcilePrompt;
}): Promise<ReconcileResult> {
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
      return { kind: 'noop-nothing-to-reconcile' };
    }

    const remoteBlobs = await fetchRemoteBlobs(options.api);

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

    for (const type of VAULT_BLOB_TYPES) {
      const blob = localBlobFor(localVault, type);
      if (!blob) continue;

      await putServerVaultBlobEtagAware({
        api: options.api,
        type,
        blob: toEncryptedBlobV1(blob),
      });
    }

    return { kind: 'uploaded-local-to-server' };
  }

  const remoteBlobs = await fetchRemoteBlobs(options.api);

  const localComparable = {
    meta: normalizeLocalVaultAsServerShape(localVault),
    blobs: comparableBlobs((type) =>
      normalizeLocalBlobAsServerShape(localBlobFor(localVault, type)),
    ),
  };

  const remoteComparable = {
    meta: normalizeServerMeta(serverMeta.meta),
    blobs: comparableBlobs((type) =>
      normalizeServerBlob(remoteBlobs[type] ?? null),
    ),
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

  for (const type of VAULT_BLOB_TYPES) {
    const remote = await getServerVaultBlob(options.api, type);
    const blob = localBlobFor(localVault, type);
    if (!blob) continue;

    await putServerVaultBlobEtagAware({
      api: options.api,
      type,
      blob: toEncryptedBlobV1(blob),
      ifMatch: remote?.etag,
      onConflict: () => 'keep-local',
    });
  }

  return { kind: 'kept-local-overwrote-server' };
}
