import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import { ValidateError } from 'tsoa';

jest.setTimeout(30_000);

// The other two tenancy suites each prove one half of the guarantee in isolation:
// VaultController.tenancy.int.test.ts mocks VaultService wholesale, so it can show
// which userId crosses the controller boundary but has no stored row to inspect;
// VaultService.tenancy.test.ts inspects stored rows but never sees a token. Issue
// #505 asks for the refusal to be asserted "by status code AND by confirming B's
// stored record is unchanged" — that is one claim, so it needs one test. This file
// wires the REAL routes, controller, and VaultService over a fake store, drives it
// over HTTP with User A's token, and reads User B's rows back out of the store.

type VaultRow = Record<string, unknown> & { userId: string };
type BlobRow = Record<string, unknown> & { userId: string; type: string };

/**
 * Minimal stand-in for the two vault tables, keyed the way the schema declares
 * uniqueness: EncryptedVault.userId @unique, EncryptedVaultBlob @@unique([userId, type]).
 * Every operation throws when its `where` fails to resolve a userId, so a filter
 * dropped in VaultService surfaces as a loud failure rather than a silent read of
 * somebody else's row.
 */
class FakeVaultStore {
  private vaults = new Map<string, VaultRow>();
  private blobs = new Map<string, BlobRow>();
  private clock = 0;

  private stamp(): Date {
    return new Date(++this.clock);
  }

  private clone<T>(value: T): T {
    if (value instanceof Date) return new Date(value) as unknown as T;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.clone(item)) as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = this.clone((value as Record<string, unknown>)[key]);
    }
    return out as T;
  }

  private scopedUserId(where: any, label: string): string {
    if (!where || typeof where.userId !== 'string') {
      throw new Error(`${label} requires a where.userId`);
    }
    return where.userId;
  }

  private scopedComposite(where: any, label: string): [string, string] {
    const composite = where?.userId_type;
    if (
      !composite ||
      typeof composite.userId !== 'string' ||
      typeof composite.type !== 'string'
    ) {
      throw new Error(`${label} requires a where.userId_type`);
    }
    return [composite.userId, composite.type];
  }

  encryptedVault = {
    findUnique: async ({ where }: any) => {
      const userId = this.scopedUserId(where, 'encryptedVault.findUnique');
      const row = this.vaults.get(userId);
      return row ? this.clone(row) : null;
    },
    upsert: async ({ where, create, update }: any) => {
      const userId = this.scopedUserId(where, 'encryptedVault.upsert');
      const existing = this.vaults.get(userId);
      if (!existing && create?.userId !== userId) {
        throw new Error(
          `encryptedVault.upsert create.userId "${create?.userId}" does not match where.userId "${userId}"`,
        );
      }
      const row = {
        ...(existing ?? {}),
        ...this.clone(existing ? update : create),
        userId,
        updatedAt: this.stamp(),
      } as VaultRow;
      this.vaults.set(userId, row);
      return this.clone(row);
    },
  };

  encryptedVaultBlob = {
    findUnique: async ({ where }: any) => {
      const [userId, type] = this.scopedComposite(
        where,
        'encryptedVaultBlob.findUnique',
      );
      const row = this.blobs.get(`${userId}::${type}`);
      return row ? this.clone(row) : null;
    },
    findMany: async ({ where }: any) => {
      const userId = this.scopedUserId(where, 'encryptedVaultBlob.findMany');
      return [...this.blobs.values()]
        .filter((row) => row.userId === userId)
        .map((row) => this.clone(row));
    },
    upsert: async ({ where, create, update }: any) => {
      const [userId, type] = this.scopedComposite(
        where,
        'encryptedVaultBlob.upsert',
      );
      const key = `${userId}::${type}`;
      const existing = this.blobs.get(key);
      if (!existing && create?.userId !== userId) {
        throw new Error(
          `encryptedVaultBlob.upsert create.userId "${create?.userId}" does not match where.userId "${userId}"`,
        );
      }
      const row: BlobRow = {
        userId,
        type,
        blob: this.clone((existing ? update : create).blob),
        updatedAt: this.stamp(),
      };
      this.blobs.set(key, row);
      return this.clone(row);
    },
  };

  reset(): void {
    this.vaults.clear();
    this.blobs.clear();
  }

  readVault(userId: string): VaultRow | null {
    const row = this.vaults.get(userId);
    return row ? this.clone(row) : null;
  }

  readBlob(userId: string, type: string): BlobRow | null {
    const row = this.blobs.get(`${userId}::${type}`);
    return row ? this.clone(row) : null;
  }

  seedVault(userId: string, kdfSalt: string): void {
    this.vaults.set(userId, {
      userId,
      version: 1,
      kdf_name: 'PBKDF2',
      kdf_salt: kdfSalt,
      kdf_params: { iterations: 1 },
      wrapped_mk_passphrase: { owner: userId },
      wrapped_mk_recovery: { owner: userId },
      updatedAt: this.stamp(),
    });
  }

  seedBlob(userId: string, type: string, blob: unknown): void {
    this.blobs.set(`${userId}::${type}`, {
      userId,
      type,
      blob,
      updatedAt: this.stamp(),
    });
  }
}

const store = new FakeVaultStore();

// The real VaultService singleton is constructed at module load from
// createPrismaClient(). Handing it the fake store is what lets this suite keep the
// service REAL — mocking VaultService here would collapse the very seam under test.
jest.mock('../prisma', () => ({
  __esModule: true,
  createPrismaClient: () => store,
  Prisma: {},
}));

jest.mock('../helpers/PlatformTokenHandler', () => ({
  __esModule: true,
  PlatformTokenHandler: { buildLoginResponse: jest.fn() },
  default: { buildLoginResponse: jest.fn() },
}));

jest.mock('../utils/passport', () => ({
  __esModule: true,
  default: { authenticate: () => (_req: any, _res: any, next: any) => next() },
}));

const TOKEN_TO_USER: Record<string, string> = {
  'token-a': 'user-a',
  'token-b': 'user-b',
};

jest.mock('../middleware/authentication', () => ({
  expressAuthentication: async (req: any) => {
    const header = req?.headers?.authorization;
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice('Bearer '.length)
        : header;
    const id = typeof token === 'string' ? TOKEN_TO_USER[token] : undefined;
    if (!id) {
      const err = new Error('Unauthorized') as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    req.user = { id };
    return req.user;
  },
}));

jest.mock('../services/VaultBackupService', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../services/UserService', () => ({ __esModule: true, default: {} }));
jest.mock('../services/YouTubeSyncWorkerService', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../services/YouTubeDigestService', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../services/YouTubeSyncService', () => ({
  __esModule: true,
  default: {},
}));

function makeApp() {
  const { RegisterRoutes } = require('../routes/routes');

  const app = express();
  app.use(bodyParser.json({ limit: '2mb' }));
  RegisterRoutes(app);

  app.use(function tsoaErrorHandler(
    err: unknown,
    _req: any,
    res: any,
    next: any,
  ) {
    if (err instanceof ValidateError) {
      return res
        .status(422)
        .json({ message: 'Validation Failed', details: err?.fields });
    }
    const anyErr = err as any;
    if (
      anyErr &&
      typeof anyErr === 'object' &&
      typeof anyErr.status === 'number'
    ) {
      return res.status(anyErr.status).json({ message: anyErr.message });
    }
    if (err instanceof Error) {
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    return next(err);
  });

  return app;
}

const IV = Buffer.alloc(12).toString('base64');
const A_CIPHERTEXT = Buffer.from('user-a-secret').toString('base64');
const B_CIPHERTEXT = Buffer.from('user-b-secret').toString('base64');
const A_REWRITTEN_CIPHERTEXT =
  Buffer.from('user-a-rewritten').toString('base64');

function blobWith(ciphertext: string) {
  return { version: 1, iv: IV, ciphertext };
}

function metaWith(kdfSalt: string) {
  return {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt: kdfSalt,
    kdf_params: { iterations: 1 },
    wrapped_mk_passphrase: { owner: kdfSalt },
    wrapped_mk_recovery: { owner: kdfSalt },
  };
}

describe('Vault cross-user isolation (real service over a fake store)', () => {
  let app: express.Express;

  beforeEach(() => {
    store.reset();
    store.seedVault('user-a', 'salt-a');
    store.seedBlob('user-a', 'addresses', blobWith(A_CIPHERTEXT));
    store.seedVault('user-b', 'salt-b');
    store.seedBlob('user-b', 'addresses', blobWith(B_CIPHERTEXT));
    app = makeApp();
  });

  test('GET /vault under token-a returns A own meta and never B meta', async () => {
    const res = await request(app)
      .get('/vault')
      .set('Authorization', 'Bearer token-a');

    expect(res.status).toBe(200);
    expect(res.body.meta.kdf_salt).toBe('salt-a');
    expect(JSON.stringify(res.body)).not.toContain('salt-b');
  });

  test('GET /vault/blob/:type under token-a returns A ciphertext and never B ciphertext', async () => {
    const res = await request(app)
      .get('/vault/blob/addresses')
      .set('Authorization', 'Bearer token-a');

    expect(res.status).toBe(200);
    expect(res.body.blob.ciphertext).toBe(A_CIPHERTEXT);
    expect(JSON.stringify(res.body)).not.toContain(B_CIPHERTEXT);
  });

  test('PUT /vault under token-a leaves B stored vault row byte-identical', async () => {
    const before = store.readVault('user-b');

    const res = await request(app)
      .put('/vault')
      .set('Authorization', 'Bearer token-a')
      .send({ meta: metaWith('salt-a-rewritten') });

    expect(res.status).toBe(200);

    const after = store.readVault('user-b');
    expect(after).toEqual(before);
    expect(after?.kdf_salt).toBe('salt-b');
    expect(store.readVault('user-a')?.kdf_salt).toBe('salt-a-rewritten');
  });

  test('PUT /vault/blob/:type under token-a leaves B stored blob row byte-identical', async () => {
    const before = store.readBlob('user-b', 'addresses');

    const res = await request(app)
      .put('/vault/blob/addresses')
      .set('Authorization', 'Bearer token-a')
      .send({ type: 'addresses', blob: blobWith(A_REWRITTEN_CIPHERTEXT) });

    expect(res.status).toBe(200);

    const after = store.readBlob('user-b', 'addresses');
    expect(after).toEqual(before);
    expect((after?.blob as { ciphertext: string }).ciphertext).toBe(
      B_CIPHERTEXT,
    );

    const rewritten = store.readBlob('user-a', 'addresses');
    expect((rewritten?.blob as { ciphertext: string }).ciphertext).toBe(
      A_REWRITTEN_CIPHERTEXT,
    );
  });

  test('POST /vault/export under token-a returns only A blobs', async () => {
    store.seedBlob('user-b', 'todos', blobWith(B_CIPHERTEXT));

    const res = await request(app)
      .post('/vault/export')
      .set('Authorization', 'Bearer token-a');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.blobs)).toEqual(['addresses']);
    expect(res.body.meta.kdf_salt).toBe('salt-a');
    expect(JSON.stringify(res.body)).not.toContain(B_CIPHERTEXT);
  });

  test('the same GET /vault under token-b returns B own records, proving the token selects the owner', async () => {
    const res = await request(app)
      .get('/vault')
      .set('Authorization', 'Bearer token-b');

    expect(res.status).toBe(200);
    expect(res.body.meta.kdf_salt).toBe('salt-b');
    expect(JSON.stringify(res.body)).not.toContain('salt-a');
  });
});
