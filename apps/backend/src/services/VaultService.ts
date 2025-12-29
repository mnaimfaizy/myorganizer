import { Prisma, PrismaClient } from '../prisma';

export type VaultBlobType = 'addresses' | 'mobileNumbers';

export interface VaultMetaV1 {
  version: number;
  kdf_name: string;
  kdf_salt: string;
  kdf_params: Record<string, unknown>;
  wrapped_mk_passphrase: unknown;
  wrapped_mk_recovery: unknown;
  [key: string]: unknown;
}

export interface EncryptedBlobV1 {
  version: number;
  iv: string;
  ciphertext: string;
  [key: string]: unknown;
}

export interface VaultExportV1 {
  exportVersion: 1;
  exportedAt: string;
  meta: VaultMetaV1;
  blobs: Partial<Record<VaultBlobType, EncryptedBlobV1>>;
}

type ServiceResult<T> =
  | { ok: true; status: 200 | 201; body: T }
  | {
      ok: false;
      status: 404 | 409 | 422;
      body: { message: string; details?: unknown };
    };

const VAULT_META_MAX_BYTES = 32 * 1024;
const VAULT_BLOB_MAX_BYTES = 256 * 1024;
const VAULT_EXPORT_MAX_BYTES = 1024 * 1024;

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function etagFromDate(date: Date): string {
  return `W/\"${date.getTime()}\"`;
}

function jsonByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function decodeBase64Strict(value: string): Buffer | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value.length % 4 !== 0) return null;
  if (!BASE64_RE.test(value)) return null;

  const decoded = Buffer.from(value, 'base64');

  const normalizedInput = value.replace(/=+$/, '');
  const normalizedOutput = decoded.toString('base64').replace(/=+$/, '');
  if (normalizedOutput !== normalizedInput) return null;

  return decoded;
}

function isBase64String(value: string): boolean {
  return decodeBase64Strict(value) !== null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVaultMetaV1(value: unknown): value is VaultMetaV1 {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.version === 'number' &&
    typeof value.kdf_name === 'string' &&
    typeof value.kdf_salt === 'string' &&
    isPlainObject(value.kdf_params) &&
    'wrapped_mk_passphrase' in value &&
    'wrapped_mk_recovery' in value
  );
}

function isEncryptedBlobV1(value: unknown): value is EncryptedBlobV1 {
  if (!isPlainObject(value)) return false;

  if (
    typeof value.version !== 'number' ||
    typeof value.iv !== 'string' ||
    typeof value.ciphertext !== 'string'
  ) {
    return false;
  }

  const ivBytes = decodeBase64Strict(value.iv);
  if (!ivBytes) return false;
  if (ivBytes.byteLength < 12 || ivBytes.byteLength > 24) return false;

  if (!isBase64String(value.ciphertext)) return false;

  return true;
}

export class VaultService {
  constructor(private prisma: PrismaClient) {}

  public getVaultMeta = async (
    userId: string
  ): Promise<
    ServiceResult<{ meta: VaultMetaV1; updatedAt: string; etag: string }>
  > => {
    const vault = await this.prisma.encryptedVault.findUnique({
      where: { userId },
    });
    if (!vault) {
      return { ok: false, status: 404, body: { message: 'Vault not found' } };
    }

    const meta: VaultMetaV1 = {
      version: vault.version,
      kdf_name: vault.kdf_name,
      kdf_salt: vault.kdf_salt,
      kdf_params: vault.kdf_params as Record<string, unknown>,
      wrapped_mk_passphrase: vault.wrapped_mk_passphrase,
      wrapped_mk_recovery: vault.wrapped_mk_recovery,
    };

    return {
      ok: true,
      status: 200,
      body: {
        meta,
        updatedAt: vault.updatedAt.toISOString(),
        etag: etagFromDate(vault.updatedAt),
      },
    };
  };

  public putVaultMeta = async (
    userId: string,
    meta: unknown,
    ifMatch?: string
  ): Promise<ServiceResult<{ ok: true; etag: string; updatedAt: string }>> => {
    if (!isVaultMetaV1(meta)) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Invalid vault meta shape' },
      };
    }

    if (jsonByteLength(meta) > VAULT_META_MAX_BYTES) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Vault meta payload too large' },
      };
    }

    const existing = await this.prisma.encryptedVault.findUnique({
      where: { userId },
    });
    if (ifMatch) {
      if (!existing) {
        return {
          ok: false,
          status: 409,
          body: { message: 'ETag mismatch' },
        };
      }

      const currentEtag = etagFromDate(existing.updatedAt);
      if (ifMatch !== currentEtag) {
        return {
          ok: false,
          status: 409,
          body: { message: 'ETag mismatch' },
        };
      }
    }

    const saved = await this.prisma.encryptedVault.upsert({
      where: { userId },
      create: {
        userId,
        version: meta.version,
        kdf_name: meta.kdf_name,
        kdf_salt: meta.kdf_salt,
        kdf_params: meta.kdf_params as unknown as Prisma.InputJsonValue,
        wrapped_mk_passphrase:
          meta.wrapped_mk_passphrase as unknown as Prisma.InputJsonValue,
        wrapped_mk_recovery:
          meta.wrapped_mk_recovery as unknown as Prisma.InputJsonValue,
      },
      update: {
        version: meta.version,
        kdf_name: meta.kdf_name,
        kdf_salt: meta.kdf_salt,
        kdf_params: meta.kdf_params as unknown as Prisma.InputJsonValue,
        wrapped_mk_passphrase:
          meta.wrapped_mk_passphrase as unknown as Prisma.InputJsonValue,
        wrapped_mk_recovery:
          meta.wrapped_mk_recovery as unknown as Prisma.InputJsonValue,
      },
    });

    const status: 200 | 201 = existing ? 200 : 201;

    return {
      ok: true,
      status,
      body: {
        ok: true,
        etag: etagFromDate(saved.updatedAt),
        updatedAt: saved.updatedAt.toISOString(),
      },
    };
  };

  public getBlob = async (
    userId: string,
    type: VaultBlobType
  ): Promise<
    ServiceResult<{
      type: VaultBlobType;
      blob: EncryptedBlobV1;
      updatedAt: string;
      etag: string;
    }>
  > => {
    const blobRow = await this.prisma.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId, type } },
    });

    if (!blobRow) {
      return {
        ok: false,
        status: 404,
        body: { message: 'Vault blob not found' },
      };
    }

    return {
      ok: true,
      status: 200,
      body: {
        type,
        blob: blobRow.blob as EncryptedBlobV1,
        updatedAt: blobRow.updatedAt.toISOString(),
        etag: etagFromDate(blobRow.updatedAt),
      },
    };
  };

  public putBlob = async (
    userId: string,
    type: VaultBlobType,
    blob: unknown,
    ifMatch?: string
  ): Promise<ServiceResult<{ ok: true; etag: string; updatedAt: string }>> => {
    if (!isEncryptedBlobV1(blob)) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Invalid blob shape' },
      };
    }

    if (jsonByteLength(blob) > VAULT_BLOB_MAX_BYTES) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Blob payload too large' },
      };
    }

    const vault = await this.prisma.encryptedVault.findUnique({
      where: { userId },
    });
    if (!vault) {
      return { ok: false, status: 404, body: { message: 'Vault not found' } };
    }

    const existing = await this.prisma.encryptedVaultBlob.findUnique({
      where: { userId_type: { userId, type } },
    });

    if (ifMatch) {
      if (!existing) {
        return { ok: false, status: 409, body: { message: 'ETag mismatch' } };
      }
      const currentEtag = etagFromDate(existing.updatedAt);
      if (ifMatch !== currentEtag) {
        return { ok: false, status: 409, body: { message: 'ETag mismatch' } };
      }
    }

    const saved = await this.prisma.encryptedVaultBlob.upsert({
      where: { userId_type: { userId, type } },
      create: {
        userId,
        type,
        blob: blob as unknown as Prisma.InputJsonValue,
      },
      update: {
        blob: blob as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      ok: true,
      status: existing ? 200 : 201,
      body: {
        ok: true,
        etag: etagFromDate(saved.updatedAt),
        updatedAt: saved.updatedAt.toISOString(),
      },
    };
  };

  public exportVault = async (
    userId: string
  ): Promise<ServiceResult<VaultExportV1>> => {
    const vault = await this.prisma.encryptedVault.findUnique({
      where: { userId },
    });
    if (!vault) {
      return { ok: false, status: 404, body: { message: 'Vault not found' } };
    }

    const blobs = await this.prisma.encryptedVaultBlob.findMany({
      where: { userId },
    });

    const blobMap: Partial<Record<VaultBlobType, EncryptedBlobV1>> = {};
    for (const blobRow of blobs) {
      if (blobRow.type === 'addresses' || blobRow.type === 'mobileNumbers') {
        blobMap[blobRow.type] = blobRow.blob as EncryptedBlobV1;
      }
    }

    const meta: VaultMetaV1 = {
      version: vault.version,
      kdf_name: vault.kdf_name,
      kdf_salt: vault.kdf_salt,
      kdf_params: vault.kdf_params as Record<string, unknown>,
      wrapped_mk_passphrase: vault.wrapped_mk_passphrase,
      wrapped_mk_recovery: vault.wrapped_mk_recovery,
    };

    const payload: VaultExportV1 = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      meta,
      blobs: blobMap,
    };

    if (jsonByteLength(payload) > VAULT_EXPORT_MAX_BYTES) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Export payload too large' },
      };
    }

    return { ok: true, status: 200, body: payload };
  };

  public importVault = async (
    userId: string,
    exportBundle: unknown
  ): Promise<ServiceResult<{ ok: true }>> => {
    if (!isPlainObject(exportBundle)) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Invalid import shape' },
      };
    }

    if (jsonByteLength(exportBundle) > VAULT_EXPORT_MAX_BYTES) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Import payload too large' },
      };
    }

    if (exportBundle.exportVersion !== 1) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Unsupported exportVersion' },
      };
    }

    const meta = exportBundle.meta;
    if (!isVaultMetaV1(meta)) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Invalid vault meta shape' },
      };
    }

    const blobs = exportBundle.blobs;
    if (blobs !== undefined && !isPlainObject(blobs)) {
      return {
        ok: false,
        status: 422,
        body: { message: 'Invalid blobs shape' },
      };
    }

    await this.prisma.encryptedVault.upsert({
      where: { userId },
      create: {
        userId,
        version: meta.version,
        kdf_name: meta.kdf_name,
        kdf_salt: meta.kdf_salt,
        kdf_params: meta.kdf_params as unknown as Prisma.InputJsonValue,
        wrapped_mk_passphrase:
          meta.wrapped_mk_passphrase as unknown as Prisma.InputJsonValue,
        wrapped_mk_recovery:
          meta.wrapped_mk_recovery as unknown as Prisma.InputJsonValue,
      },
      update: {
        version: meta.version,
        kdf_name: meta.kdf_name,
        kdf_salt: meta.kdf_salt,
        kdf_params: meta.kdf_params as unknown as Prisma.InputJsonValue,
        wrapped_mk_passphrase:
          meta.wrapped_mk_passphrase as unknown as Prisma.InputJsonValue,
        wrapped_mk_recovery:
          meta.wrapped_mk_recovery as unknown as Prisma.InputJsonValue,
      },
    });

    if (blobs) {
      for (const [type, blob] of Object.entries(blobs)) {
        if (type !== 'addresses' && type !== 'mobileNumbers') continue;
        if (!isEncryptedBlobV1(blob)) {
          return {
            ok: false,
            status: 422,
            body: { message: `Invalid blob for type ${type}` },
          };
        }
        if (jsonByteLength(blob) > VAULT_BLOB_MAX_BYTES) {
          return {
            ok: false,
            status: 422,
            body: { message: `Blob payload too large for type ${type}` },
          };
        }

        await this.prisma.encryptedVaultBlob.upsert({
          where: { userId_type: { userId, type } },
          create: {
            userId,
            type,
            blob: blob as unknown as Prisma.InputJsonValue,
          },
          update: { blob: blob as unknown as Prisma.InputJsonValue },
        });
      }
    }

    return { ok: true, status: 200, body: { ok: true } };
  };
}

const vaultService = new VaultService(new PrismaClient());
export default vaultService;
