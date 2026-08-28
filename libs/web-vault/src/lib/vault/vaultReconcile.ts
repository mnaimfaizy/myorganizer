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
import { stableStringify } from './stableStringify';
import { VAULT_BLOB_FIELDS, VAULT_BLOB_TYPES } from './vaultBlobFields';
import {
  localToServerMeta,
  serverMetaToLocalVault,
  takeServerBlobsUnderLocalWrapping,
  toEncryptedBlobV1,
} from './vaultShapes';

type VaultApiLike = Pick<
  VaultApi,
  'getVaultMeta' | 'putVaultMeta' | 'getVaultBlob' | 'putVaultBlob'
>;

/**
 * `defer` is the answer given by a User who gave no answer — a dismissed
 * prompt. It is not a synonym for either side: deferring writes nothing
 * anywhere, so the choice survives to be made again (ADR 0033).
 */
export type ReconcileDecision = 'keep-local' | 'keep-server' | 'defer';

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
  /** Divergence was found and the User did not choose. Nothing was written. */
  | { kind: 'noop-conflict-deferred' }
  | { kind: 'noop-already-in-sync' };

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
 * goes to `prompt`, and the caller's answer decides which side is kept. A
 * caller that answers `defer` leaves both sides exactly as they were.
 *
 * Reconcile decides Vault Blobs and only Vault Blobs. Vault Meta converges
 * separately in `vaultMetaConverge.ts` ([ADR 0057](../../../../../docs/adr/0057-vault-meta-converges-separately-and-never-silently.md)),
 * and no answer given here moves a wrapping on either side — the one
 * exception being a server that holds no Vault Meta at all, where the first
 * sync has nothing to override.
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

  if (!serverMeta) {
    // The only Vault Meta write left in reconcile, and the only safe one:
    // the server holds no wrapping at all, so there is nothing here to
    // override and no other device whose passphrase change could be reverted.
    await putServerVaultMetaEtagAware({
      api: options.api,
      meta: localToServerMeta(localVault),
    });

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

  // Vault Blobs only. Vault Meta is deliberately absent from both sides of
  // this comparison: it converges separately, on its own terms, in
  // `vaultMetaConverge.ts` (ADR 0057). Comparing it here would make an
  // ordinary passphrase change — which rewraps the same Master Key and leaves
  // every Vault Blob byte-identical — read as whole-Vault divergence and fire
  // the destructive prompt below.
  const localComparable = {
    blobs: comparableBlobs((type) =>
      normalizeLocalBlobAsServerShape(localBlobFor(localVault, type)),
    ),
  };

  const remoteComparable = {
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
      'Your encrypted vault data differs between this device and the server. Choose which version to keep. This does not change your passphrase on either side.',
    local: localVault,
    remote: { meta: serverMeta.meta, blobs: remoteBlobs },
  });

  if (decision === 'defer') {
    return { kind: 'noop-conflict-deferred' };
  }

  if (decision === 'keep-server') {
    // This device's wrapping survives the answer. The User chose between two
    // sets of Ciphertext, not between two passphrases.
    const nextLocalVault = takeServerBlobsUnderLocalWrapping({
      localVault,
      blobs: remoteBlobs,
    });

    return { kind: 'kept-server-overwrote-local', nextLocalVault };
  }

  // Vault Blobs go up; Vault Meta does not. Pushing this device's wrapping
  // here is how "keep this device's data" would silently revert a passphrase
  // change made on another device — the destruction ADR 0057 exists to stop.
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
