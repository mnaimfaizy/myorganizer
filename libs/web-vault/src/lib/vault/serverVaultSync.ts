import {
  EncryptedBlobV1,
  GetVaultBlobResponse,
  GetVaultMetaResponse,
  PutVaultBlobResponse,
  PutVaultMetaResponse,
  VaultApi,
  VaultBlobType,
  VaultMetaV1,
} from '@myorganizer/app-api-client';

type VaultApiLike = Pick<
  VaultApi,
  'getVaultMeta' | 'putVaultMeta' | 'getVaultBlob' | 'putVaultBlob'
>;

export type ServerVaultMeta = {
  etag: string;
  updatedAt: string;
  meta: VaultMetaV1;
};

export type ServerVaultBlob = {
  etag: string;
  updatedAt: string;
  type: VaultBlobType;
  blob: EncryptedBlobV1;
};

export type ConflictDecision = 'keep-local' | 'keep-remote';

export type VaultMetaConflictHandler = (params: {
  local: VaultMetaV1;
  remote: ServerVaultMeta;
}) => Promise<ConflictDecision> | ConflictDecision;

export type VaultBlobConflictHandler = (params: {
  local: EncryptedBlobV1;
  remote: ServerVaultBlob;
}) => Promise<ConflictDecision> | ConflictDecision;

function getHttpStatus(error: unknown): number | undefined {
  const maybeAny = error as any;
  const status = maybeAny?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function defaultBlobConflictHandler(params: {
  local: EncryptedBlobV1;
  remote: ServerVaultBlob;
}): ConflictDecision {
  void params;
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return 'keep-remote';
  }

  const overwrite = window.confirm(
    'Your vault data was updated in another session. Overwrite the server version with your local changes?',
  );

  return overwrite ? 'keep-local' : 'keep-remote';
}

function toServerVaultMeta(data: GetVaultMetaResponse): ServerVaultMeta {
  return {
    etag: data.etag,
    updatedAt: data.updatedAt,
    meta: data.meta,
  };
}

function toServerVaultBlob(data: GetVaultBlobResponse): ServerVaultBlob {
  return {
    etag: data.etag,
    updatedAt: data.updatedAt,
    type: data.type,
    blob: data.blob,
  };
}

export async function getServerVaultMeta(
  // Narrower than `VaultApiLike` for the same reason as `getServerVaultBlob`:
  // reading Vault Meta needs one method, and asking for `putVaultMeta` would
  // hand every caller the ability to push a local wrapping over the server's
  // and undo a passphrase change made on another device.
  api: Pick<VaultApiLike, 'getVaultMeta'>,
): Promise<ServerVaultMeta | null> {
  try {
    const response = await api.getVaultMeta();
    return toServerVaultMeta(response.data as GetVaultMetaResponse);
  } catch (error) {
    if (getHttpStatus(error) === 404) return null;
    throw error;
  }
}

export async function getServerVaultBlob(
  // Narrower than `VaultApiLike` on purpose: reading one Vault Blob needs one
  // method, and asking for the other three would make every caller hand over
  // the ability to rewrite Vault Meta.
  api: Pick<VaultApiLike, 'getVaultBlob'>,
  type: VaultBlobType,
): Promise<ServerVaultBlob | null> {
  try {
    const response = await api.getVaultBlob({ type });
    return toServerVaultBlob(response.data as GetVaultBlobResponse);
  } catch (error) {
    if (getHttpStatus(error) === 404) return null;
    throw error;
  }
}

/** What a conditional check of one Vault Blob Type found. */
export type ServerVaultBlobCheck =
  /** `ifNoneMatch` matched the server's ETag — nothing to do. */
  | { kind: 'not-modified' }
  /** The server holds no Ciphertext for this type. */
  | { kind: 'absent' }
  /** The server's Ciphertext moved (or `ifNoneMatch` was never given). */
  | { kind: 'changed'; blob: ServerVaultBlob };

/**
 * Ask the server whether one Vault Blob Type's Ciphertext still matches
 * `ifNoneMatch` — a Sync Bookmark's ETag, or `undefined` when this device
 * holds none.
 *
 * This is Vault Pull's whole "did anything change" question, answered by a
 * conditional GET rather than by fetching and comparing: a 304 costs no
 * body and leaves nothing for the caller to do.
 */
export async function checkServerVaultBlob(
  // Narrower than `VaultApiLike` for the same reason `getServerVaultBlob` is.
  api: Pick<VaultApiLike, 'getVaultBlob'>,
  type: VaultBlobType,
  ifNoneMatch: string | undefined,
): Promise<ServerVaultBlobCheck> {
  try {
    const response = await api.getVaultBlob({ type, ifNoneMatch });
    return {
      kind: 'changed',
      blob: toServerVaultBlob(response.data as GetVaultBlobResponse),
    };
  } catch (error) {
    const status = getHttpStatus(error);
    if (status === 304) return { kind: 'not-modified' };
    if (status === 404) return { kind: 'absent' };
    throw error;
  }
}

export type PutVaultMetaResult =
  | {
      kind: 'updated';
      etag: string;
      updatedAt: string;
    }
  | {
      kind: 'kept-remote';
      remote: ServerVaultMeta;
    };

export async function putServerVaultMetaEtagAware(options: {
  // The two methods this actually uses, and not the two it does not. Handing
  // a caller `putVaultBlob` to write a Vault Meta is the same overreach this
  // file avoids on every read path.
  api: Pick<VaultApiLike, 'getVaultMeta' | 'putVaultMeta'>;
  meta: VaultMetaV1;
  ifMatch?: string;
  /**
   * Required, and deliberately not defaulted. A Vault Meta conflict means two
   * devices changed a wrapping independently, and a wrapping cannot be
   * verified without the passphrase it was derived from (ADR 0057) — so there
   * is no answer this function could pick that is safe in general, and a
   * default would pick one anyway. The blob path below still defaults,
   * because Ciphertext a conflict handler chooses between can at least be
   * decrypted and compared.
   */
  onConflict: VaultMetaConflictHandler;
}): Promise<PutVaultMetaResult> {
  const { onConflict } = options;

  try {
    const response = await options.api.putVaultMeta({
      putVaultMetaRequest: { meta: options.meta },
      ifMatch: options.ifMatch,
    });

    const data = response.data as PutVaultMetaResponse;
    return { kind: 'updated', etag: data.etag, updatedAt: data.updatedAt };
  } catch (error) {
    if (getHttpStatus(error) !== 409) throw error;

    const remote = await getServerVaultMeta(options.api);
    if (!remote) throw error;

    const decision = await onConflict({ local: options.meta, remote });
    if (decision === 'keep-remote') {
      return { kind: 'kept-remote', remote };
    }

    const retry = await options.api.putVaultMeta({
      putVaultMetaRequest: { meta: options.meta },
      ifMatch: remote.etag,
    });

    const data = retry.data as PutVaultMetaResponse;
    return { kind: 'updated', etag: data.etag, updatedAt: data.updatedAt };
  }
}

export type PutVaultBlobResult =
  | {
      kind: 'updated';
      etag: string;
      updatedAt: string;
    }
  | {
      kind: 'kept-remote';
      remote: ServerVaultBlob;
    };

export async function putServerVaultBlobEtagAware(options: {
  api: VaultApiLike;
  type: VaultBlobType;
  blob: EncryptedBlobV1;
  ifMatch?: string;
  onConflict?: VaultBlobConflictHandler;
}): Promise<PutVaultBlobResult> {
  const onConflict = options.onConflict ?? defaultBlobConflictHandler;

  try {
    const response = await options.api.putVaultBlob({
      type: options.type,
      putVaultBlobRequest: { type: options.type, blob: options.blob },
      ifMatch: options.ifMatch,
    });

    const data = response.data as PutVaultBlobResponse;
    return { kind: 'updated', etag: data.etag, updatedAt: data.updatedAt };
  } catch (error) {
    if (getHttpStatus(error) !== 409) throw error;

    const remote = await getServerVaultBlob(options.api, options.type);
    if (!remote) throw error;

    const decision = await onConflict({ local: options.blob, remote });
    if (decision === 'keep-remote') {
      return { kind: 'kept-remote', remote };
    }

    const retry = await options.api.putVaultBlob({
      type: options.type,
      putVaultBlobRequest: { type: options.type, blob: options.blob },
      ifMatch: remote.etag,
    });

    const data = retry.data as PutVaultBlobResponse;
    return { kind: 'updated', etag: data.etag, updatedAt: data.updatedAt };
  }
}
