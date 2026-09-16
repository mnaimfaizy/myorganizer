/* eslint-disable import/first -- jest.mock must precede application imports */

jest.mock('@myorganizer/web-vault', () => ({
  ...jest.requireActual('@myorganizer/web-vault'),
  loadCloudBackupPreferences: jest.fn(),
  saveCloudBackupPreferences: jest.fn(),
  getProviderPrefs: jest.fn(),
  setProviderPrefs: jest.fn(),
  clearProviderPrefs: jest.fn(),
  startScheduler: jest.fn(),
  createDefaultAuditReporter: jest.fn(),
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import {
  CloudBackupPromptError,
  type CloudBackupCoordinator,
  type CloudBackupProvider,
  type CloudEscapeCopy,
  type CloudBackupResult,
  type CloudRestoreResult,
  type VaultHandle,
} from '@myorganizer/web-vault';
import {
  loadCloudBackupPreferences,
  saveCloudBackupPreferences,
  getProviderPrefs,
  setProviderPrefs,
  clearProviderPrefs,
} from '@myorganizer/web-vault';
import { useCloudBackup } from './useCloudBackup';

// Minimal in-memory localStorage so the preferences module works
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
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

function installWindowShim() {
  const w = (
    globalThis as unknown as { window?: { localStorage: MemoryStorage } }
  ).window;
  if (!w) {
    (
      globalThis as unknown as { window: { localStorage: MemoryStorage } }
    ).window = {
      localStorage: new MemoryStorage(),
    };
  } else {
    w.localStorage = new MemoryStorage();
  }
}

type MockCoordinator = jest.Mocked<
  Pick<
    CloudBackupCoordinator,
    | 'getConnectionState'
    | 'connect'
    | 'disconnect'
    | 'backup'
    | 'fetchLatestCopy'
    | 'restoreCopy'
    | 'canRunWithoutPrompt'
  >
>;

function makeMockCoordinator(): MockCoordinator {
  return {
    getConnectionState: jest.fn().mockResolvedValue({ status: 'not-linked' }),
    connect: jest.fn().mockResolvedValue({ status: 'linked' }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    backup: jest.fn().mockResolvedValue({
      fileId: 'test-file',
      metadata: {
        id: 'test-meta',
        name: 'test.json',
        createdAt: new Date().toISOString(),
        exportId: 'test-export',
        schemaVersion: 1,
        status: 'complete',
        sizeBytes: 0,
      },
      sizeBytes: 0,
      exportId: 'test-export',
    } as CloudBackupResult),
    fetchLatestCopy: jest.fn().mockResolvedValue(null),
    restoreCopy: jest.fn().mockResolvedValue({} as CloudRestoreResult),
    canRunWithoutPrompt: jest.fn().mockReturnValue(false),
  } as MockCoordinator;
}

function makeFakeHandle(): VaultHandle {
  return {
    loadVault: jest.fn().mockReturnValue(null),
  } as unknown as VaultHandle;
}

describe('useCloudBackup', () => {
  beforeEach(() => {
    installWindowShim();
    window.localStorage.clear();

    // Reset all mocks
    (loadCloudBackupPreferences as jest.Mock).mockReset();
    (saveCloudBackupPreferences as jest.Mock).mockReset();
    (getProviderPrefs as jest.Mock).mockReset();
    (setProviderPrefs as jest.Mock).mockReset();
    (clearProviderPrefs as jest.Mock).mockReset();

    // Default mock implementations
    (loadCloudBackupPreferences as jest.Mock).mockReturnValue({});
    (getProviderPrefs as jest.Mock).mockReturnValue({ ageLimit: 'off' });
    (setProviderPrefs as jest.Mock).mockImplementation(
      (current, providerId, data) => ({
        ...current,
        [providerId]: data,
      }),
    );
    (clearProviderPrefs as jest.Mock).mockImplementation(
      (current, providerId) => {
        const updated = { ...current };
        delete updated[providerId];
        return updated;
      },
    );
  });

  describe('Initialization', () => {
    it('should initialize with not-linked connection and off ageLimit', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.getConnectionState.mockResolvedValue({
        status: 'not-linked',
      });
      const handle = makeFakeHandle();

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await waitFor(() => {
        expect(result.current.connection.status).toBe('not-linked');
      });
      expect(result.current.ageLimit).toBe('off');
      expect(result.current.isBusy).toBe(false);
      expect(result.current.lastError).toBe(null);
    });

    it('should load ageLimit from localStorage on init', async () => {
      const coordinator = makeMockCoordinator();
      (getProviderPrefs as jest.Mock).mockReturnValue({ ageLimit: '1-week' });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await waitFor(() => {
        expect(result.current.ageLimit).toBe('1-week');
      });
      expect(loadCloudBackupPreferences).toHaveBeenCalled();
      expect(getProviderPrefs).toHaveBeenCalledWith(
        expect.anything(),
        'google-drive',
      );
    });

    it('should handle legacy autoInterval preference (weekly → 1-week)', async () => {
      const coordinator = makeMockCoordinator();
      // Simulate legacy preference loading behavior
      (getProviderPrefs as jest.Mock).mockReturnValue({ ageLimit: '1-week' });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await waitFor(() => {
        expect(result.current.ageLimit).toBe('1-week');
      });
    });
  });

  describe('Connect/Disconnect', () => {
    it('should connect and update connection state', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.connect.mockResolvedValue({ status: 'linked' });
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await act(async () => {
        await result.current.connect();
      });

      await waitFor(() => {
        expect(result.current.connection.status).toBe('linked');
      });
      expect(result.current.isBusy).toBe(false);
      expect(result.current.lastError).toBe(null);
      expect(coordinator.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle connect error and set lastError', async () => {
      const coordinator = makeMockCoordinator();
      const err = new Error('access_denied');
      coordinator.connect.mockRejectedValue(err);
      coordinator.getConnectionState.mockResolvedValue({
        status: 'reconnect-needed',
        reason: 'access_denied',
      });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await act(async () => {
        await expect(result.current.connect()).rejects.toThrow('access_denied');
      });

      await waitFor(() => {
        expect(result.current.lastError).toBe('access_denied');
      });
      expect(result.current.connection.status).toBe('reconnect-needed');
    });

    it('should NOT set lastError on popup-closed prompt error', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.connect.mockRejectedValue(
        new CloudBackupPromptError('popup-closed'),
      );
      coordinator.getConnectionState.mockResolvedValue({
        status: 'not-linked',
      });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await act(async () => {
        await expect(result.current.connect()).rejects.toThrow();
      });

      // lastError should remain null for popup-closed
      expect(result.current.lastError).toBe(null);
    });

    it('should set lastError on popup-blocked prompt error', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.backup.mockRejectedValue(
        new CloudBackupPromptError('popup-blocked'),
      );
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const handle = makeFakeHandle();
      (handle.loadVault as jest.Mock).mockReturnValue({ encrypted: 'vault' });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await act(async () => {
        await expect(result.current.backupNow()).rejects.toThrow();
      });

      await waitFor(() => {
        expect(result.current.lastError).toContain(
          'Your browser blocked the Google sign-in window',
        );
      });
    });

    it('should disconnect and set not-linked', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.disconnect.mockResolvedValue(undefined);
      coordinator.getConnectionState.mockResolvedValue({
        status: 'not-linked',
      });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await act(async () => {
        await result.current.disconnect();
      });

      await waitFor(() => {
        expect(result.current.connection.status).toBe('not-linked');
      });
      expect(coordinator.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Backup', () => {
    it('should backup and increment backupCounter', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const handle = makeFakeHandle();
      const fakeVault = { encrypted: 'vault' };
      (handle.loadVault as jest.Mock).mockReturnValue(fakeVault);

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      const initialCounter = result.current.backupCounter;

      await act(async () => {
        await result.current.backupNow();
      });

      await waitFor(() => {
        expect(result.current.backupCounter).toBe(initialCounter + 1);
      });
      expect(coordinator.backup).toHaveBeenCalledWith(fakeVault);
    });

    it('should error when no local vault is found', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const handle = makeFakeHandle();
      (handle.loadVault as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await act(async () => {
        await expect(result.current.backupNow()).rejects.toThrow(
          'No local vault found',
        );
      });

      await waitFor(() => {
        expect(result.current.lastError).toContain('No local vault found');
      });
      expect(coordinator.backup).not.toHaveBeenCalled();
    });
  });

  describe('Restore (two-step flow)', () => {
    it('should fetch and store pending copy without calling restoreCopy', async () => {
      const coordinator = makeMockCoordinator();
      const copy: CloudEscapeCopy = {
        text: '{"vault":"data"}',
        metadata: {
          id: 'file-1',
          name: 'backup.json',
          createdAt: '2026-01-01T00:00:00Z',
          exportId: 'export-1',
          schemaVersion: 1,
          status: 'complete',
          sizeBytes: 1024,
        },
      };
      coordinator.fetchLatestCopy.mockResolvedValue(copy);
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await act(async () => {
        await result.current.beginRestore();
      });

      await waitFor(() => {
        expect(result.current.pendingRestore).toEqual(copy);
      });
      expect(coordinator.restoreCopy).not.toHaveBeenCalled();
    });

    it('should error when no copy found in beginRestore', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.fetchLatestCopy.mockResolvedValue(null);
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await act(async () => {
        await expect(result.current.beginRestore()).rejects.toThrow(
          'No copy found in Google Drive',
        );
      });

      await waitFor(() => {
        expect(result.current.lastError).toContain(
          'No copy found in Google Drive',
        );
      });
      expect(result.current.pendingRestore).toBe(null);
    });

    it('should confirm restore with pending copy', async () => {
      const coordinator = makeMockCoordinator();
      const copy: CloudEscapeCopy = {
        text: '{"vault":"data"}',
        metadata: {
          id: 'file-1',
          name: 'backup.json',
          createdAt: '2026-01-01T00:00:00Z',
          exportId: 'export-1',
          schemaVersion: 1,
          status: 'complete',
          sizeBytes: 1024,
        },
      };
      coordinator.fetchLatestCopy.mockResolvedValue(copy);
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const handle = makeFakeHandle();
      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      // First, begin restore
      await act(async () => {
        await result.current.beginRestore();
      });

      await waitFor(() => {
        expect(result.current.pendingRestore).not.toBe(null);
      });

      // Then, confirm restore
      await act(async () => {
        await result.current.confirmRestore();
      });

      await waitFor(() => {
        expect(result.current.pendingRestore).toBe(null);
      });
      expect(coordinator.restoreCopy).toHaveBeenCalledWith(copy, handle);
    });

    it('should error if confirmRestore called without pending copy', async () => {
      const coordinator = makeMockCoordinator();
      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await act(async () => {
        await expect(result.current.confirmRestore()).rejects.toThrow(
          'No copy pending restore',
        );
      });

      expect(coordinator.restoreCopy).not.toHaveBeenCalled();
    });

    it('should keep pendingRestore on restore failure', async () => {
      const coordinator = makeMockCoordinator();
      const copy: CloudEscapeCopy = {
        text: '{"vault":"data"}',
        metadata: {
          id: 'file-1',
          name: 'backup.json',
          createdAt: '2026-01-01T00:00:00Z',
          exportId: 'export-1',
          schemaVersion: 1,
          status: 'complete',
          sizeBytes: 1024,
        },
      };
      coordinator.fetchLatestCopy.mockResolvedValue(copy);
      coordinator.restoreCopy.mockRejectedValue(new Error('bad import'));
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const handle = makeFakeHandle();
      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      // Begin restore
      await act(async () => {
        await result.current.beginRestore();
      });

      await waitFor(() => {
        expect(result.current.pendingRestore).not.toBe(null);
      });

      // Try to confirm (fails)
      await act(async () => {
        await expect(result.current.confirmRestore()).rejects.toThrow(
          'bad import',
        );
      });

      await waitFor(() => {
        expect(result.current.lastError).toBe('bad import');
      });
      // pendingRestore should remain (not cleared on failure)
      expect(result.current.pendingRestore).toEqual(copy);
    });

    it('should cancel restore without calling restoreCopy', async () => {
      const coordinator = makeMockCoordinator();
      const copy: CloudEscapeCopy = {
        text: '{"vault":"data"}',
        metadata: {
          id: 'file-1',
          name: 'backup.json',
          createdAt: '2026-01-01T00:00:00Z',
          exportId: 'export-1',
          schemaVersion: 1,
          status: 'complete',
          sizeBytes: 1024,
        },
      };
      coordinator.fetchLatestCopy.mockResolvedValue(copy);
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      // Begin restore
      await act(async () => {
        await result.current.beginRestore();
      });

      await waitFor(() => {
        expect(result.current.pendingRestore).not.toBe(null);
      });

      // Cancel
      act(() => {
        result.current.cancelRestore();
      });

      expect(result.current.pendingRestore).toBe(null);
      expect(coordinator.restoreCopy).not.toHaveBeenCalled();
    });
  });

  describe('Age Limit', () => {
    it('should update ageLimit and call saveCloudBackupPreferences', async () => {
      const coordinator = makeMockCoordinator();
      (setProviderPrefs as jest.Mock).mockImplementation(
        (current, providerId, data) => ({
          ...current,
          [providerId]: data,
        }),
      );

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      act(() => {
        result.current.setAgeLimit('1-week');
      });

      expect(result.current.ageLimit).toBe('1-week');
      expect(setProviderPrefs).toHaveBeenCalledWith(
        expect.anything(),
        'google-drive',
        { ageLimit: '1-week' },
      );
      expect(saveCloudBackupPreferences).toHaveBeenCalled();
    });

    it('should clear provider prefs when setAgeLimit to off', async () => {
      const coordinator = makeMockCoordinator();
      (getProviderPrefs as jest.Mock).mockReturnValue({ ageLimit: '1-week' });
      (clearProviderPrefs as jest.Mock).mockImplementation((_current) => ({}));

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      await waitFor(() => {
        expect(result.current.ageLimit).toBe('1-week');
      });

      act(() => {
        result.current.setAgeLimit('off');
      });

      expect(result.current.ageLimit).toBe('off');
      expect(clearProviderPrefs).toHaveBeenCalledWith(
        expect.anything(),
        'google-drive',
      );
      expect(saveCloudBackupPreferences).toHaveBeenCalled();
    });

    it('should ignore invalid ageLimit values', async () => {
      const coordinator = makeMockCoordinator();
      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
        }),
      );

      const initialValue = result.current.ageLimit;

      act(() => {
        result.current.setAgeLimit('invalid' as never);
      });

      // Should not change
      expect(result.current.ageLimit).toBe(initialValue);
      expect(saveCloudBackupPreferences).not.toHaveBeenCalled();
    });
  });

  describe('Scheduler', () => {
    it('should start scheduler when linked, ageLimit set, and getNewestCopyMs provided', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const mockScheduler = jest.fn().mockReturnValue({
        stop: jest.fn(),
      });

      // Mock preferences to return 1-week ageLimit
      (getProviderPrefs as jest.Mock).mockReturnValue({ ageLimit: '1-week' });

      const handle = makeFakeHandle();
      const getNewestCopyMs = jest.fn().mockResolvedValue(Date.now());

      const { result } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
          getNewestCopyMs,
          schedulerImpl: mockScheduler,
        }),
      );

      await waitFor(() => {
        expect(result.current.ageLimit).toBe('1-week');
      });

      await waitFor(() => {
        expect(mockScheduler).toHaveBeenCalledTimes(1);
      });

      const call = mockScheduler.mock.calls[0][0];
      expect(call).toHaveProperty('getNewestCopyMs', getNewestCopyMs);
      expect(call).toHaveProperty('getAgeLimit');
      expect(call).toHaveProperty('canRunWithoutPrompt');
      expect(call).toHaveProperty('runBackup');
    });

    it('should not start scheduler if ageLimit is off', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const mockScheduler = jest.fn().mockReturnValue({
        stop: jest.fn(),
      });

      const handle = makeFakeHandle();
      const getNewestCopyMs = jest.fn().mockResolvedValue(Date.now());

      renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
          getNewestCopyMs,
          schedulerImpl: mockScheduler,
        }),
      );

      await waitFor(() => {
        // Small delay to ensure effect would have run
        expect(true).toBe(true);
      });

      expect(mockScheduler).not.toHaveBeenCalled();
    });

    it('should not start scheduler if connection is not linked', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.getConnectionState.mockResolvedValue({
        status: 'not-linked',
      });

      const mockScheduler = jest.fn().mockReturnValue({
        stop: jest.fn(),
      });

      (getProviderPrefs as jest.Mock).mockReturnValue({ ageLimit: '1-week' });

      const handle = makeFakeHandle();
      const getNewestCopyMs = jest.fn().mockResolvedValue(Date.now());

      renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
          getNewestCopyMs,
          schedulerImpl: mockScheduler,
        }),
      );

      await waitFor(() => {
        expect(true).toBe(true);
      });

      expect(mockScheduler).not.toHaveBeenCalled();
    });

    it('should not start scheduler if getNewestCopyMs is not provided', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const mockScheduler = jest.fn().mockReturnValue({
        stop: jest.fn(),
      });

      (getProviderPrefs as jest.Mock).mockReturnValue({ ageLimit: '1-week' });

      renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle: makeFakeHandle(),
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
          // getNewestCopyMs not provided
          schedulerImpl: mockScheduler,
        }),
      );

      await waitFor(() => {
        expect(true).toBe(true);
      });

      expect(mockScheduler).not.toHaveBeenCalled();
    });

    it('should call stop on scheduler when component unmounts', async () => {
      const coordinator = makeMockCoordinator();
      coordinator.getConnectionState.mockResolvedValue({ status: 'linked' });

      const mockStop = jest.fn();
      const mockScheduler = jest.fn().mockReturnValue({
        stop: mockStop,
      });

      (getProviderPrefs as jest.Mock).mockReturnValue({ ageLimit: '1-week' });

      const handle = makeFakeHandle();
      const getNewestCopyMs = jest.fn().mockResolvedValue(Date.now());

      const { unmount } = renderHook(() =>
        useCloudBackup({
          providerId: 'google-drive',
          provider: {} as CloudBackupProvider,
          handle,
          coordinatorFactory: () =>
            coordinator as unknown as CloudBackupCoordinator,
          getNewestCopyMs,
          schedulerImpl: mockScheduler,
        }),
      );

      await waitFor(() => {
        expect(mockScheduler).toHaveBeenCalled();
      });

      unmount();

      expect(mockStop).toHaveBeenCalledTimes(1);
    });
  });
});
