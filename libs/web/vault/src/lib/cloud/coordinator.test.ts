import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

jest.mock('../vault/vaultExportImport', () => ({
  ...jest.requireActual<typeof import('../vault/vaultExportImport')>(
    '../vault/vaultExportImport',
  ),
  importVault: jest.fn(),
}));

import type { VaultStorageV1 } from '../vault/localVaultStorage';
import type { VaultHandle } from '../vault/vaultHandle';
import { importVault as importVaultExport } from '../vault/vaultExportImport';
import { CloudBackupCoordinator } from './coordinator';
import {
  CloudBackupConnectionState,
  CloudBackupFileMetadata,
  CloudBackupProvider,
  UploadBackupInput,
  UploadBackupResult,
} from './types';

const importVault = jest.mocked(importVaultExport);

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
  key(index: number): string | null {
    return null;
  }
  get length(): number {
    return this.store.size;
  }
}

beforeAll(() => {
  if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
    (
      globalThis as unknown as { window: { localStorage: MemoryStorage } }
    ).window = {
      localStorage: new MemoryStorage(),
    };
  }
});

beforeEach(() => {
  (
    globalThis as unknown as { window: { localStorage: MemoryStorage } }
  ).window.localStorage.clear();
  jest.clearAllMocks();
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
  state: CloudBackupConnectionState = { status: 'linked' };

  async getConnectionState(): Promise<CloudBackupConnectionState> {
    return this.state;
  }
  canRunWithoutPrompt(): boolean {
    return false;
  }
  async connect(): Promise<CloudBackupConnectionState> {
    this.state = { status: 'linked' };
    return this.state;
  }
  async disconnect(): Promise<void> {
    this.state = { status: 'not-linked' };
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
  test('backup holds success report until upload completes', async () => {
    const provider = new FakeProvider();
    const callLog: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reporter = jest.fn(async (input: any) => {
      callLog.push(`reporter-${input.status}`);
    });
    const coordinator = new CloudBackupCoordinator({
      provider,
      auditReporter: reporter as any,
      retention: 5,
    });

    // Wrap uploadBackup to log when it's called
    const originalUpload = provider.uploadBackup.bind(provider);
    provider.uploadBackup = jest.fn(async (input: UploadBackupInput) => {
      callLog.push('uploadBackup-called');
      const result = await originalUpload(input);
      callLog.push('uploadBackup-resolved');
      return result;
    });

    const result = await coordinator.backup(sampleVault);

    // Success report must come AFTER uploadBackup resolved
    expect(callLog).toEqual([
      'uploadBackup-called',
      'uploadBackup-resolved',
      'reporter-success',
    ]);
    expect(result.exportId).toBe(provider.uploads[0].exportId);
    expect(provider.pruneCalls).toHaveLength(1);
    expect(provider.pruneCalls[0].keepCount).toBe(5);
  });

  test('backup reports failed audit and rethrows when upload fails', async () => {
    const provider = new FakeProvider();
    provider.uploadShouldFail = true;
    const reporter = jest.fn(async (_input: any) => undefined);
    const coordinator = new CloudBackupCoordinator({
      provider,
      auditReporter: reporter as any,
    });

    await expect(coordinator.backup(sampleVault)).rejects.toThrow(
      'upload-failed',
    );

    // Should call reporter only for failure, never for held success
    const reporterCalls = reporter.mock.calls as any[];
    expect(reporterCalls).toHaveLength(1);
    expect(reporterCalls[0][0].status).toBe('failed');
    expect(reporterCalls[0][0].event).toBe('export');
    expect(reporterCalls[0][0].errorCode).toBe('cloud-upload-failed');
    expect(provider.pruneCalls).toHaveLength(0);
  });

  test('backup resolves despite prune failure', async () => {
    const provider = new FakeProvider();
    provider.pruneBackups = jest.fn(async (_opts: any) => {
      throw new Error('prune-failed');
    });
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {
        // no-op
      });
    const reporter = jest.fn(async (_input: any) => undefined);
    const coordinator = new CloudBackupCoordinator({
      provider,
      auditReporter: reporter as any,
    });

    const result = await coordinator.backup(sampleVault);

    // Should still resolve with backup result
    expect(result.exportId).toBeDefined();
    // Should report success before prune fails
    const successCall = (reporter.mock.calls as any[]).find(
      (c) => c[0].status === 'success',
    );
    expect(successCall).toBeDefined();
    // Prune error should be logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Cloud backup retention prune failed:',
      expect.any(Error),
    );
    consoleWarnSpy.mockRestore();
  });

  test('fetchLatestCopy returns provider copy or null', async () => {
    const provider = new FakeProvider();
    const coordinator = new CloudBackupCoordinator({ provider });

    const resultNull = await coordinator.fetchLatestCopy();
    expect(resultNull).toBeNull();

    const copy = {
      text: JSON.stringify(sampleVault),
      metadata: {
        id: 'file-1',
        name: 'backup.json',
        createdAt: '2026-01-01T00:00:00Z',
        exportId: 'export-id-1',
        schemaVersion: 1,
        status: 'complete' as const,
        sizeBytes: 1024,
      },
    };
    provider.download = copy;
    const resultWithCopy = await coordinator.fetchLatestCopy();
    expect(resultWithCopy).toEqual(copy);
  });

  test('restoreCopy calls importVault with copy text and attaches metadata', async () => {
    const provider = new FakeProvider();
    const reporter = jest.fn(async () => undefined);
    const coordinator = new CloudBackupCoordinator({
      provider,
      auditReporter: reporter as any,
    });

    const envelopeText = 'envelope-text';
    const copy = {
      text: envelopeText,
      metadata: {
        id: 'file-1',
        name: 'backup.json',
        createdAt: '2026-01-01T00:00:00Z',
        exportId: 'export-id-1',
        schemaVersion: 1,
        status: 'complete' as const,
        sizeBytes: 1024,
      },
    };

    const mockHandle = {
      forgetSyncBookmarks: jest.fn(),
      saveVault: jest.fn(),
      owner: 'test-owner',
    } as unknown as VaultHandle;

    importVault.mockResolvedValueOnce({
      envelope: {
        schemaVersion: 1,
        exportId: 'export-id-1',
        exportedAt: '2026-01-01T00:00:00Z',
        meta: {
          version: 1,
          kdf_name: 'PBKDF2',
          kdf_salt: 'c2FsdA==',
          kdf_params: {},
          wrapped_mk_passphrase: {
            version: 1,
            iv: 'aXYtMTI=',
            ciphertext: 'Y3QtMTI=',
          },
          wrapped_mk_recovery: {
            version: 1,
            iv: 'cmVjLWl2LTEy',
            ciphertext: 'cmVjLWN0LTEy',
          },
        },
        blobs: {},
      },
      nextLocalVault: sampleVault,
      sizeBytes: 1024,
    });

    const result = await coordinator.restoreCopy(copy, mockHandle);

    // Verify importVault was called with correct text, handle, and reporter
    expect(importVault).toHaveBeenCalledWith(
      expect.objectContaining({
        text: envelopeText,
        handle: mockHandle,
        source: 'google-drive',
        auditReporter: reporter,
      }),
    );

    // Result should have both import result and metadata attached
    expect(result.metadata).toEqual(copy.metadata);
    expect(result.sizeBytes).toBe(1024);
  });

  test('canRunWithoutPrompt delegates to provider', async () => {
    const provider = new FakeProvider();
    const coordinator = new CloudBackupCoordinator({ provider });

    provider.canRunWithoutPrompt = jest.fn(() => true);
    expect(coordinator.canRunWithoutPrompt()).toBe(true);

    provider.canRunWithoutPrompt = jest.fn(() => false);
    expect(coordinator.canRunWithoutPrompt()).toBe(false);
  });
});
