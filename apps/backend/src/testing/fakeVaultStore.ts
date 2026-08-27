/**
 * Shared in-memory stand-in for the two vault tables, keyed the way the schema
 * declares uniqueness: EncryptedVault.userId @unique, and
 * EncryptedVaultBlob @@unique([userId, type]).
 *
 * The load-bearing behaviour is the throwing: every operation refuses a `where`
 * clause that does not resolve a userId, and every upsert refuses a `create`
 * whose userId disagrees with the one being scoped to. That is what makes a
 * dropped filter in VaultService surface as a loud test failure rather than a
 * silent read of somebody else's row. Two suites depend on it:
 *
 * - VaultService.tenancy.test.ts sweeps `getCallLog()` to prove every query the
 *   service issues carries a userId.
 * - VaultController.crossUser.int.test.ts seeds rows, drives real HTTP through
 *   the real service, and reads the other user's rows back to prove they are
 *   untouched.
 *
 * Because it is the shared oracle for both, its refusals are themselves tested
 * in fakeVaultStore.guard.test.ts — a weakened check here would otherwise turn
 * both suites green for the wrong reason.
 *
 * This file lives outside the app build: apps/backend/tsconfig.app.json excludes
 * `src/testing/**`. It deliberately uses no jest APIs, so it stays a plain class.
 */

export interface VaultStoreCall {
  model: 'encryptedVault' | 'encryptedVaultBlob';
  op: 'findUnique' | 'findMany' | 'upsert';
  userId?: string;
}

export type FakeVaultRow = Record<string, unknown> & {
  userId: string;
  updatedAt: Date;
};

export type FakeBlobRow = Record<string, unknown> & {
  userId: string;
  type: string;
  blob: unknown;
  updatedAt: Date;
};

export class FakeVaultStore {
  private vaults = new Map<string, FakeVaultRow>();
  private blobs = new Map<string, FakeBlobRow>();
  private callLog: VaultStoreCall[] = [];
  private clock = 0;

  private stamp(): Date {
    return new Date(this.clock++);
  }

  /** Deep clone that preserves Date instances, so callers cannot mutate stored rows. */
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

  private requireUserId(where: any, label: string): string {
    if (!where || typeof where.userId !== 'string') {
      throw new Error(`${label} requires where.userId to be a string`);
    }
    return where.userId;
  }

  private requireUserIdType(where: any, label: string): [string, string] {
    if (!where || !where.userId_type) {
      throw new Error(`${label} requires where.userId_type`);
    }
    const { userId, type } = where.userId_type;
    if (typeof userId !== 'string' || typeof type !== 'string') {
      throw new Error(
        `${label} requires where.userId_type.userId and .type to be strings`,
      );
    }
    return [userId, type];
  }

  private requireMatchingCreate(
    create: any,
    userId: string,
    label: string,
  ): void {
    if (create && create.userId !== userId) {
      throw new Error(
        `${label} create.userId "${create.userId}" does not match where.userId "${userId}"`,
      );
    }
  }

  encryptedVault = {
    findUnique: async (args: any) => {
      const userId = this.requireUserId(
        args?.where,
        'findUnique(encryptedVault)',
      );
      this.callLog.push({
        model: 'encryptedVault',
        op: 'findUnique',
        userId,
      });
      const row = this.vaults.get(userId);
      return row ? this.clone(row) : null;
    },

    upsert: async (args: any) => {
      const userId = this.requireUserId(args?.where, 'upsert(encryptedVault)');
      this.requireMatchingCreate(
        args?.create,
        userId,
        'upsert(encryptedVault)',
      );
      this.callLog.push({ model: 'encryptedVault', op: 'upsert', userId });

      const existing = this.vaults.get(userId);
      const data = existing ? (args?.update ?? {}) : (args?.create ?? {});
      const row: FakeVaultRow = {
        ...(existing ?? {}),
        ...this.clone(data),
        userId,
        updatedAt: this.stamp(),
      };
      this.vaults.set(userId, row);
      return this.clone(row);
    },
  };

  encryptedVaultBlob = {
    findUnique: async (args: any) => {
      const [userId, type] = this.requireUserIdType(
        args?.where,
        'findUnique(encryptedVaultBlob)',
      );
      this.callLog.push({
        model: 'encryptedVaultBlob',
        op: 'findUnique',
        userId,
      });
      const row = this.blobs.get(this.key(userId, type));
      return row ? this.clone(row) : null;
    },

    findMany: async (args: any) => {
      const userId = this.requireUserId(
        args?.where,
        'findMany(encryptedVaultBlob)',
      );
      this.callLog.push({
        model: 'encryptedVaultBlob',
        op: 'findMany',
        userId,
      });
      return [...this.blobs.values()]
        .filter((row) => row.userId === userId)
        .map((row) => this.clone(row));
    },

    upsert: async (args: any) => {
      const [userId, type] = this.requireUserIdType(
        args?.where,
        'upsert(encryptedVaultBlob)',
      );
      this.requireMatchingCreate(
        args?.create,
        userId,
        'upsert(encryptedVaultBlob)',
      );
      this.callLog.push({ model: 'encryptedVaultBlob', op: 'upsert', userId });

      const key = this.key(userId, type);
      const existing = this.blobs.get(key);
      const data = existing ? (args?.update ?? {}) : (args?.create ?? {});
      const row: FakeBlobRow = {
        userId,
        type,
        blob: 'blob' in data ? this.clone(data.blob) : existing?.blob,
        updatedAt: this.stamp(),
      };
      this.blobs.set(key, row);
      return this.clone(row);
    },
  };

  private key(userId: string, type: string): string {
    return `${userId}::${type}`;
  }

  // --- Provenance sweep support (VaultService.tenancy.test.ts) ---

  getCallLog(): VaultStoreCall[] {
    return this.clone(this.callLog);
  }

  resetCallLog(): void {
    this.callLog = [];
  }

  // --- Seed / read support (VaultController.crossUser.int.test.ts) ---

  /** Clear all rows and the call log, so one instance can serve many tests. */
  reset(): void {
    this.vaults.clear();
    this.blobs.clear();
    this.callLog = [];
    this.clock = 0;
  }

  /**
   * Write a row directly, bypassing upsert. Seeding must not appear in the call
   * log, or a provenance sweep would be asserting against its own fixture.
   */
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
    this.blobs.set(this.key(userId, type), {
      userId,
      type,
      blob: this.clone(blob),
      updatedAt: this.stamp(),
    });
  }

  readVault(userId: string): FakeVaultRow | null {
    const row = this.vaults.get(userId);
    return row ? this.clone(row) : null;
  }

  readBlob(userId: string, type: string): FakeBlobRow | null {
    const row = this.blobs.get(this.key(userId, type));
    return row ? this.clone(row) : null;
  }
}
