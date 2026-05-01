import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import type { VaultStorageV1 } from '../vault/vault';
import { CloudBackupCoordinator } from './coordinator';
import {
  CloudBackupConnectionState,
  CloudBackupFileMetadata,
  CloudBackupProvider,
  UploadBackupInput,
  UploadBackupResult,
} from './types';

class MemoryStorage {
  private readonly store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(_index: number): string | null {
    return null;
  }
  get length(): number {
    return this.store.size;
  }
}

beforeAll(() => {
  if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
    (globalThis as { window: { localStorage: MemoryStorage } }).window = {
      localStorage: new MemoryStorage(),
    };
  }
});

beforeEach(() => {
  (
    globalThis as { window: { localStorage: MemoryStorage } }
  ).window.localStorage.clear();
});

const sampleVault: VaultStorageV1 = {
  version: 1,
  kdf: {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 310_000,
    salt: 'c2FsdA==',
  },
  masterKeyWrappedWithPassphrase: {
    iv: 'cGFzc3BocmFzZS1pdg==',
    ciphertext: 'cGFzc3BocmFzZS1jdA==',
  },
  masterKeyWrappedWithRecoveryKey: {
    iv: 'cmVjb3ZlcnktaXYtMTI=',
    ciphertext: 'cmVjb3ZlcnktaXYtY3Q=',
  },
  data: {
    addresses: {
      iv: 'YWRkcmVzcy1pdi0xMjM=',
      ciphertext: 'YWRkcmVzcy1jdC0xMjM=',
    },
  },
};

class FakeProvider implements CloudBackupProvider {
  readonly id = 'google-drive' as const;
  uploads: UploadBackupInput[] = [];
  pruneCalls: { keepCount: number; stalePendingMs: number }[] = [];
  uploadShouldFail = false;
  download: { text: string; metadata: CloudBackupFileMetadata } | null = null;
  state: CloudBackupConnectionState = { status: 'connected' };

  async getConnectionState(): Promise<CloudBackupConnectionState> {
    return this.state;
  }
  async connect(): Promise<CloudBackupConnectionState> {
    this.state = { status: 'connected' };
    return this.state;
  }
  async disconnect(): Promise<void> {
    this.state = { status: 'disconnected' };
  }
  async uploadBackup(input: UploadBackupInput): Promise<UploadBackupResult> {
    if (this.uploadShouldFail) throw new Error('upload-failed');
    this.uploads.push(input);
    const meta: CloudBackupFileMetadata = {
      id: 'file-1',
      name: 'backup.json',
      createdAt: new Date().toISOString(),
      exportId: input.exportId,
      schemaVersion: input.schemaVersion,
      status: 'complete',
      sizeBytes: input.text.length,
    };
    return { fileId: meta.id, metadata: meta };
  }
  async downloadLatestBackup() {
    return this.download;
  }
  async pruneBackups(opts: { keepCount: number; stalePendingMs: number }) {
    this.pruneCalls.push(opts);
    return { deletedCompleted: 0, deletedPending: 0 };
  }
}

describe('CloudBackupCoordinator', () => {
  test('backup uploads exported envelope and prunes retention', async () => {
    const provider = new FakeProvider();
    const reporter = jest.fn(async () => undefined);
    const coordinator = new CloudBackupCoordinator({
      provider,
      auditReporter: reporter as any,
      retention: 5,
    });

    const result = await coordinator.backup(sampleVault);

    expect(provider.uploads).toHaveLength(1);
    expect(provider.uploads[0].text.startsWith('{')).toBe(true);
    expect(result.exportId).toBe(provider.uploads[0].exportId);
    expect(provider.pruneCalls[0].keepCount).toBe(5);

    const sources = (reporter as jest.Mock).mock.calls.map(
      (c) => (c[0] as any).source,
    );
    expect(sources).toContain('google-drive');
    const successCalls = (reporter as jest.Mock).mock.calls.filter(
      (c) => (c[0] as any).status === 'success',
    );
    expect(successCalls).toHaveLength(1);
  });

  test('backup reports failed audit when upload fails', async () => {
    const provider = new FakeProvider();
    provider.uploadShouldFail = true;
    const reporter = jest.fn(async () => undefined);
    const coordinator = new CloudBackupCoordinator({
      provider,
      auditReporter: reporter as any,
    });

    await expect(coordinator.backup(sampleVault)).rejects.toThrow(
      'upload-failed',
    );

    const failed = (reporter as jest.Mock).mock.calls.find(
      (c) => (c[0] as any).status === 'failed',
    );
    expect(failed).toBeDefined();
    expect((failed?.[0] as any).source).toBe('google-drive');
    expect((failed?.[0] as any).errorCode).toBe('cloud-upload-failed');
  });

  test('restoreLatest returns null when provider has no backup', async () => {
    const provider = new FakeProvider();
    const coordinator = new CloudBackupCoordinator({ provider });
    const result = await coordinator.restoreLatest();
    expect(result).toBeNull();
  });
});
