'use client';

import {
  CLOUD_BACKUP_AUTO_INTERVALS,
  CloudBackupAutoInterval,
  CloudBackupConnectionState,
  CloudBackupCoordinator,
  CloudBackupProvider,
  CloudBackupProviderId,
  GoogleDriveCloudBackupProvider,
  SchedulerHandle,
  clearProviderPrefs,
  createDefaultAuditReporter,
  getProviderPrefs,
  loadCloudBackupPreferences,
  loadVault,
  saveCloudBackupPreferences,
  setProviderPrefs,
  startScheduler,
} from '@myorganizer/web-vault';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseCloudBackupOptions {
  /** Provider id this hook controls. Currently only `'google-drive'`. */
  providerId: CloudBackupProviderId;
  /** Provider instance (typically `GoogleDriveCloudBackupProvider`). */
  provider: CloudBackupProvider;
  /**
   * Optional override for constructing a coordinator. Defaults to
   * `new CloudBackupCoordinator({ provider })`.
   */
  coordinatorFactory?: (
    provider: CloudBackupProvider,
  ) => CloudBackupCoordinator;
  /**
   * Optional async resolver for the timestamp of the latest successful
   * provider-scoped backup. Used by the scheduler to determine due-ness.
   * If not provided, the scheduler is not started even when the user
   * configures an auto-backup interval.
   */
  getLastSuccessMs?: () => Promise<number | null>;
  /**
   * Optional override for `startScheduler`, useful for tests. Defaults to
   * the implementation exported from `@myorganizer/web-vault`.
   */
  schedulerImpl?: typeof startScheduler;
}

export interface UseCloudBackupResult {
  providerId: CloudBackupProviderId;
  connection: CloudBackupConnectionState;
  /** Currently configured auto-backup interval. */
  autoInterval: CloudBackupAutoInterval;
  /** True while connect/disconnect/backup/restore is in flight. */
  isBusy: boolean;
  /** Last action error, if any. */
  lastError: string | null;
  /** Bumps after each successful backup; useful as a refreshKey trigger. */
  backupCounter: number;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  backupNow: () => Promise<void>;
  restoreLatest: () => Promise<{ sizeBytes: number } | null>;
  setAutoInterval: (next: CloudBackupAutoInterval) => void;
}

const DEFAULT_CONNECTION: CloudBackupConnectionState = {
  status: 'disconnected',
};

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

/**
 * Browser-only hook that exposes connection state + actions for a single
 * cloud backup provider. The hook owns one {@link CloudBackupCoordinator}
 * instance and persists the auto-backup interval to local storage.
 *
 * The hook is intentionally agnostic about how the {@link CloudBackupProvider}
 * is constructed; callers wire up the GIS-backed provider (or a mock) and
 * pass it in via `options.provider`.
 */
export function useCloudBackup(
  options: UseCloudBackupOptions,
): UseCloudBackupResult {
  const {
    providerId,
    provider,
    coordinatorFactory,
    getLastSuccessMs,
    schedulerImpl,
  } = options;

  const coordinator = useMemo<CloudBackupCoordinator>(() => {
    if (coordinatorFactory) return coordinatorFactory(provider);
    return new CloudBackupCoordinator({
      provider,
      auditReporter: createDefaultAuditReporter(),
    });
  }, [provider, coordinatorFactory]);

  const [connection, setConnection] =
    useState<CloudBackupConnectionState>(DEFAULT_CONNECTION);
  const [autoInterval, setAutoIntervalState] =
    useState<CloudBackupAutoInterval>('off');
  const [isBusy, setIsBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [backupCounter, setBackupCounter] = useState(0);

  const mountedRef = useRef(true);

  // Initial load: read prefs and connection state.
  useEffect(() => {
    mountedRef.current = true;
    const prefs = loadCloudBackupPreferences();
    setAutoIntervalState(getProviderPrefs(prefs, providerId).autoInterval);

    void coordinator
      .getConnectionState()
      .then((state) => {
        if (mountedRef.current) setConnection(state);
      })
      .catch(() => {
        // ignore; default to disconnected
      });

    return () => {
      mountedRef.current = false;
    };
  }, [coordinator, providerId]);

  const refreshConnection = useCallback(async () => {
    const state = await coordinator.getConnectionState();
    if (mountedRef.current) setConnection(state);
  }, [coordinator]);

  const runWithBusy = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      setIsBusy(true);
      setLastError(null);
      try {
        return await fn();
      } catch (err) {
        if (mountedRef.current) setLastError(describeError(err));
        throw err;
      } finally {
        if (mountedRef.current) setIsBusy(false);
      }
    },
    [],
  );

  const connect = useCallback(async () => {
    await runWithBusy(async () => {
      const next = await coordinator.connect();
      if (mountedRef.current) setConnection(next);
    });
  }, [coordinator, runWithBusy]);

  const disconnect = useCallback(async () => {
    await runWithBusy(async () => {
      await coordinator.disconnect();
      if (mountedRef.current) {
        setConnection({ status: 'disconnected' });
      }
    });
  }, [coordinator, runWithBusy]);

  const backupNow = useCallback(async () => {
    await runWithBusy(async () => {
      const localVault = loadVault();
      if (!localVault) {
        throw new Error(
          'No local vault found. Create or unlock your vault first.',
        );
      }
      try {
        await coordinator.backup(localVault);
        if (mountedRef.current) {
          setBackupCounter((n) => n + 1);
        }
      } finally {
        // Refresh connection state in case token rotation marked the
        // provider as needing reconnect, regardless of success/failure.
        await refreshConnection();
      }
    });
  }, [coordinator, refreshConnection, runWithBusy]);

  const restoreLatest = useCallback(async () => {
    return await runWithBusy(async () => {
      const result = await coordinator.restoreLatest();
      await refreshConnection();
      if (!result) return null;
      return { sizeBytes: result.sizeBytes };
    });
  }, [coordinator, refreshConnection, runWithBusy]);

  const setAutoInterval = useCallback(
    (next: CloudBackupAutoInterval) => {
      if (!CLOUD_BACKUP_AUTO_INTERVALS.includes(next)) return;
      setAutoIntervalState(next);
      const current = loadCloudBackupPreferences();
      const updated =
        next === 'off'
          ? clearProviderPrefs(current, providerId)
          : setProviderPrefs(current, providerId, { autoInterval: next });
      saveCloudBackupPreferences(updated);
    },
    [providerId],
  );

  // Auto-backup scheduler: only runs when connected, interval !== 'off',
  // and a `getLastSuccessMs` resolver was supplied.
  const intervalRef = useRef<CloudBackupAutoInterval>(autoInterval);
  intervalRef.current = autoInterval;
  useEffect(() => {
    if (!getLastSuccessMs) return;
    if (autoInterval === 'off') return;
    if (connection.status !== 'connected') return;

    const start = schedulerImpl ?? startScheduler;
    const handle: SchedulerHandle = start({
      getInterval: () => intervalRef.current,
      getLastSuccessMs,
      canRunNow: async () => {
        let canRun: boolean;
        if (provider instanceof GoogleDriveCloudBackupProvider) {
          canRun = await provider.canRunSilently();
        } else {
          const state = await provider.getConnectionState();
          canRun = state.status === 'connected';
        }
        // Reflect any state transition (e.g. silent token denial) in the UI.
        await refreshConnection();
        return canRun;
      },
      runBackup: async () => {
        const localVault = loadVault();
        if (!localVault) return;
        try {
          await coordinator.backup(localVault);
          if (mountedRef.current) {
            setBackupCounter((n) => n + 1);
          }
        } catch (err) {
          if (mountedRef.current) setLastError(describeError(err));
        }
        await refreshConnection();
      },
    });

    return () => {
      handle.stop();
    };
  }, [
    autoInterval,
    connection.status,
    coordinator,
    getLastSuccessMs,
    provider,
    refreshConnection,
    schedulerImpl,
  ]);

  return {
    providerId,
    connection,
    autoInterval,
    isBusy,
    lastError,
    backupCounter,
    connect,
    disconnect,
    backupNow,
    restoreLatest,
    setAutoInterval,
  };
}
