'use client';

/**
 * Reads the current sync status from the Vault Session — see
 * `computeVaultSyncStatus` in `@myorganizer/web-vault` for what "current"
 * means. No state is owned here beyond the last reading: every recompute
 * re-derives from the Sync Bookmarks and the sync queue's own status, so a
 * component unmounting and remounting loses nothing.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  computeVaultSyncStatus,
  type VaultSyncStatus,
} from '@myorganizer/web-vault';

import { useOptionalVaultSession } from './session';

export type UseVaultSyncStatusResult = {
  /** Null until a Vault Session exists and the first reading has resolved. */
  status: VaultSyncStatus | null;
  /**
   * Ask the sync queue to try every unsent and terminally-failed type again
   * right now. A no-op without a Vault Session.
   */
  retry: () => void;
};

export function useVaultSyncStatus(): UseVaultSyncStatusResult {
  const session = useOptionalVaultSession();
  const handle = session?.handle ?? null;
  const syncQueue = session?.syncQueue ?? null;

  const [status, setStatus] = useState<VaultSyncStatus | null>(null);

  useEffect(() => {
    // Nothing to subscribe to without a Vault Session — the hook's return
    // already masks a stale `status` to null in that case (see below), so
    // there is nothing to reset here.
    if (!handle || !syncQueue) return;

    let cancelled = false;
    const recompute = () => {
      void computeVaultSyncStatus({
        handle,
        queueStatus: syncQueue.status(),
      }).then((next) => {
        if (!cancelled) setStatus(next);
      });
    };

    recompute();
    // The queue notifies on every change that could move this reading — a
    // mark, a drain finishing, a retry scheduled or firing.
    const unsubscribe = syncQueue.subscribe(recompute);

    // Vault Pull and Vault Reconcile converge through the same primitive but
    // outside this queue, so a bookmark they advance would not otherwise
    // notify this hook. Recomputing on focus catches up with them the same
    // moment `VaultPullRunner` itself re-checks — convergence here is already
    // eventual and focus-driven by design (PRD #544), so this is consistent
    // with that rather than a new staleness window.
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', recompute);
    }

    return () => {
      cancelled = true;
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', recompute);
      }
    };
  }, [handle, syncQueue]);

  const retry = useCallback(() => {
    if (!handle || !syncQueue) return;
    void syncQueue.retryNow(handle);
  }, [handle, syncQueue]);

  // A stale reading from a since-departed Vault Session (sign-out) is never
  // shown — masked here rather than cleared by an effect, which is what lets
  // the effect above skip setState entirely when there is no Session.
  return { status: handle && syncQueue ? status : null, retry };
}
