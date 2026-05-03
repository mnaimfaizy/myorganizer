'use client';

import { createVaultBackupsApi } from '@myorganizer/web-vault';
import { useCallback, useEffect, useState } from 'react';

import type { LatestBackupRecord } from './useLatestBackup';

export type LatestCloudBackupState =
  | { status: 'loading'; record: null }
  | { status: 'empty'; record: null }
  | { status: 'loaded'; record: LatestBackupRecord }
  | { status: 'error'; record: null; error: unknown };

export type LatestCloudBackupApiFactory = () => {
  getLatestBackup: (req: {
    status?: string;
    source?: string;
  }) => Promise<{ data: LatestBackupRecord }>;
};

/**
 * Fetch the most recent successful Google Drive backup record on mount and
 * whenever `refreshKey` changes. Mirrors {@link useLatestBackup} but filters
 * by `source='google-drive'` so the returned record is provider-scoped.
 */
export function useLatestCloudBackup(
  refreshKey = 0,
  apiFactory: LatestCloudBackupApiFactory = createVaultBackupsApi as unknown as LatestCloudBackupApiFactory,
): LatestCloudBackupState {
  const [state, setState] = useState<LatestCloudBackupState>({
    status: 'loading',
    record: null,
  });

  const fetchLatest = useCallback(async () => {
    try {
      const api = apiFactory();
      const response = await api.getLatestBackup({
        status: 'success',
        source: 'google-drive',
      });
      setState({ status: 'loaded', record: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 404) {
        setState({ status: 'empty', record: null });
        return;
      }
      setState({ status: 'error', record: null, error });
    }
  }, [apiFactory]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading', record: null });
    void fetchLatest();
  }, [fetchLatest, refreshKey]);

  return state;
}
