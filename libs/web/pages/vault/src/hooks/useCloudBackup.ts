'use client';

import {
  ESCAPE_COPY_AGE_LIMITS,
  CloudBackupConnectionState,
  CloudBackupCoordinator,
  CloudBackupProvider,
  CloudBackupProviderId,
  CloudEscapeCopy,
  EscapeCopyAgeLimit,
  clearProviderPrefs,
  createDefaultAuditReporter,
  getProviderPrefs,
  isCloudBackupPromptError,
  loadCloudBackupPreferences,
  saveCloudBackupPreferences,
  setProviderPrefs,
  startScheduler,
  type VaultHandle,
} from '@myorganizer/web-vault';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseCloudBackupOptions {
  /** Provider id this hook controls. Currently only `'google-drive'`. */
  providerId: CloudBackupProviderId;
  /** Provider instance (typically `GoogleDriveCloudBackupProvider`). */
  provider: CloudBackupProvider;
  /** The signed-in User's Vault Handle. Backup/restore write/read through it. */
  handle: VaultHandle;
  /**
   * Optional override for constructing a coordinator. Defaults to
   * `new CloudBackupCoordinator({ provider })`.
   */
  coordinatorFactory?: (
    provider: CloudBackupProvider,
  ) => CloudBackupCoordinator;
  /**
   * Optional async resolver for the timestamp of the newest Escape Copy
   * confirmed at this provider. Used by the scheduler to determine due-ness.
   * If not provided, the scheduler is not started even when the user
   * configures an age limit.
   */
  getNewestCopyMs?: () => Promise<number | null>;
  /**
   * Optional override for `startScheduler`, useful for tests. Defaults to
   * the implementation exported from `@myorganizer/web-vault`.
   */
  schedulerImpl?: typeof startScheduler;
}

export interface UseCloudBackupResult {
  providerId: CloudBackupProviderId;
  connection: CloudBackupConnectionState;
  /** Currently configured Escape Copy Age Limit. */
  ageLimit: EscapeCopyAgeLimit;
  /** True while connect/disconnect/backup/restore is in flight. */
  isBusy: boolean;
  /** Last action error, if any. */
  lastError: string | null;
  /** Bumps after each successful backup; useful as a refreshKey trigger. */
  backupCounter: number;
  /** A copy fetched and awaiting confirmation. */
  pendingRestore: CloudEscapeCopy | null;

  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  backupNow: () => Promise<void>;
  beginRestore: () => Promise<void>;
  confirmRestore: () => Promise<void>;
  cancelRestore: () => void;
  setAgeLimit: (next: EscapeCopyAgeLimit) => void;
}

const DEFAULT_CONNECTION: CloudBackupConnectionState = {
  status: 'not-linked',
};

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

/**
 * Browser-only hook that exposes connection state + actions for a single
 * cloud backup provider. The hook owns one {@link CloudBackupCoordinator}
 * instance and persists the Escape Copy Age Limit to local storage.
 *
 * The hook is intentionally agnostic about how the {@link CloudBackupProvider}
 * is constructed; callers wire up the GIS-backed provider (or a mock) and
 * pass it in via `options.provider`.
 *
 * Restore is split in two steps: `beginRestore` fetches a copy and stores it
 * pending confirmation; `confirmRestore` actually imports it after the user
 * confirms what it changes about credentials (ADR 0063).
 */
export function useCloudBackup(
  options: UseCloudBackupOptions,
): UseCloudBackupResult {
  const {
    providerId,
    provider,
    handle,
    coordinatorFactory,
    getNewestCopyMs,
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
  const [ageLimit, setAgeLimitState] = useState<EscapeCopyAgeLimit>('off');
  const [isBusy, setIsBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [backupCounter, setBackupCounter] = useState(0);
  const [pendingRestore, setPendingRestore] = useState<CloudEscapeCopy | null>(
    null,
  );

  const mountedRef = useRef(true);

  // Initial load: read prefs and connection state.
  useEffect(() => {
    mountedRef.current = true;
    const prefs = loadCloudBackupPreferences();
    setAgeLimitState(getProviderPrefs(prefs, providerId).ageLimit);

    void coordinator
      .getConnectionState()
      .then((state) => {
        if (mountedRef.current) setConnection(state);
      })
      .catch(() => {
        // ignore; default to not-linked
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
        // Quiet popup-closed errors: user dismissed the prompt, not a failure
        if (isCloudBackupPromptError(err) && err.failure === 'popup-closed') {
          // Rethrow but don't show error
          throw err;
        }
        if (isCloudBackupPromptError(err) && err.failure === 'popup-blocked') {
          const msg =
            'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
          if (mountedRef.current) setLastError(msg);
          throw new Error(msg);
        }
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
      try {
        const next = await coordinator.connect();
        if (mountedRef.current) setConnection(next);
      } finally {
        await refreshConnection();
      }
    });
  }, [coordinator, refreshConnection, runWithBusy]);

  const reconnect = useCallback(async () => {
    await runWithBusy(async () => {
      try {
        const next = await coordinator.connect();
        if (mountedRef.current) setConnection(next);
      } finally {
        await refreshConnection();
      }
    });
  }, [coordinator, refreshConnection, runWithBusy]);

  const disconnect = useCallback(async () => {
    await runWithBusy(async () => {
      try {
        await coordinator.disconnect();
        if (mountedRef.current) {
          setConnection({ status: 'not-linked' });
        }
      } finally {
        await refreshConnection();
      }
    });
  }, [coordinator, refreshConnection, runWithBusy]);

  const backupNow = useCallback(async () => {
    await runWithBusy(async () => {
      const localVault = handle.loadVault();
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
  }, [coordinator, handle, refreshConnection, runWithBusy]);

  const beginRestore = useCallback(async () => {
    await runWithBusy(async () => {
      try {
        const copy = await coordinator.fetchLatestCopy();
        if (!copy) {
          throw new Error('No copy found in Google Drive.');
        }
        if (mountedRef.current) {
          setPendingRestore(copy);
        }
      } finally {
        await refreshConnection();
      }
    });
  }, [coordinator, refreshConnection, runWithBusy]);

  const confirmRestore = useCallback(async () => {
    if (!pendingRestore) {
      throw new Error('No copy pending restore.');
    }
    await runWithBusy(async () => {
      try {
        await coordinator.restoreCopy(pendingRestore, handle);
        if (mountedRef.current) {
          setPendingRestore(null);
        }
      } finally {
        await refreshConnection();
      }
    });
  }, [coordinator, handle, pendingRestore, refreshConnection, runWithBusy]);

  const cancelRestore = useCallback(() => {
    setPendingRestore(null);
  }, []);

  const setAgeLimit = useCallback(
    (next: EscapeCopyAgeLimit) => {
      if (!ESCAPE_COPY_AGE_LIMITS.includes(next)) return;
      setAgeLimitState(next);
      const current = loadCloudBackupPreferences();
      const updated =
        next === 'off'
          ? clearProviderPrefs(current, providerId)
          : setProviderPrefs(current, providerId, { ageLimit: next });
      saveCloudBackupPreferences(updated);
    },
    [providerId],
  );

  // Auto-backup scheduler: only runs when linked, ageLimit !== 'off',
  // and a `getNewestCopyMs` resolver was supplied.
  const ageLimitRef = useRef<EscapeCopyAgeLimit>(ageLimit);
  ageLimitRef.current = ageLimit;
  useEffect(() => {
    if (!getNewestCopyMs) return;
    if (ageLimit === 'off') return;
    if (connection.status !== 'linked') return;

    const start = schedulerImpl ?? startScheduler;
    const schedulerHandle = start({
      getNewestCopyMs,
      getAgeLimit: () => ageLimitRef.current,
      canRunWithoutPrompt: () => coordinator.canRunWithoutPrompt(),
      runBackup: async () => {
        const localVault = handle.loadVault();
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
      schedulerHandle.stop();
    };
  }, [
    ageLimit,
    connection.status,
    coordinator,
    getNewestCopyMs,
    handle,
    refreshConnection,
    schedulerImpl,
  ]);

  return {
    providerId,
    connection,
    ageLimit,
    isBusy,
    lastError,
    backupCounter,
    pendingRestore,
    connect,
    reconnect,
    disconnect,
    backupNow,
    beginRestore,
    confirmRestore,
    cancelRestore,
    setAgeLimit,
  };
}
