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

function defaultMetaConflictHandler(params: {
  local: VaultMetaV1;
  remote: ServerVaultMeta;
}): ConflictDecision {
  void params;
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return 'keep-remote';
  }

  const overwrite = window.confirm(
    'Your vault was updated in another session. Overwrite the server version with your local changes?' // minimum acceptable UX
  );

  return overwrite ? 'keep-local' : 'keep-remote';
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
    'Your vault data was updated in another session. Overwrite the server version with your local changes?' // minimum acceptable UX
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
  api: VaultApiLike
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
  api: VaultApiLike,
  type: VaultBlobType
): Promise<ServerVaultBlob | null> {
  try {
    const response = await api.getVaultBlob({ type });
    return toServerVaultBlob(response.data as GetVaultBlobResponse);
  } catch (error) {
    if (getHttpStatus(error) === 404) return null;
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
  api: VaultApiLike;
  meta: VaultMetaV1;
  ifMatch?: string;
  onConflict?: VaultMetaConflictHandler;
}): Promise<PutVaultMetaResult> {
  const onConflict = options.onConflict ?? defaultMetaConflictHandler;

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
