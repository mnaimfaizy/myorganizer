'use client';

/**
 * Takes a Server Reachability reading while the component holding it is
 * mounted, and refreshes it when the tab regains focus.
 *
 * Mount-scoped on purpose, with no `enabled` flag: the caller mounts this
 * where the question matters — beside a change a User is about to commit —
 * and unmounts it when they leave. A User who never reaches that point never
 * costs a request.
 *
 * Focus is the refresh trigger because it is when the reading actually goes
 * stale. Recording a recovery key means tabbing away to a password manager
 * and coming back, which is exactly the window in which connectivity can
 * change unobserved. It is the same trigger `useVaultSyncStatus` uses to
 * catch up with runners outside its own queue, so this library refreshes on
 * focus in one way rather than two.
 *
 * Deliberately not polled. A reading that refreshes on a timer presents
 * itself as a live monitor, and a live monitor beside a button is a gate —
 * the thing PRD #598 ruled out, because no reading can promise a write will
 * land.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createVaultApi,
  probeVaultMetaReachability,
  type ServerReachability,
} from '@myorganizer/web-vault';

export type UseServerReachabilityResult = {
  /** Null until the first probe resolves. */
  reachability: ServerReachability | null;
  /** Take a fresh reading now. */
  recheck: () => void;
};

export function useServerReachability(): UseServerReachabilityResult {
  const [reachability, setReachability] = useState<ServerReachability | null>(
    null,
  );

  // Guards a setState after unmount, and is what lets a re-probe leave the
  // previous reading on screen while it runs: nothing clears state on the way
  // in, only on the way out.
  const liveRef = useRef(true);

  const probe = useCallback(() => {
    void (async () => {
      let next: ServerReachability;
      try {
        next = await probeVaultMetaReachability({ api: createVaultApi() });
      } catch {
        // `probeVaultMetaReachability` classifies every server outcome itself
        // and does not reject, so reaching here means this device could not
        // get as far as asking — building the client threw. Reported as a
        // failure to reach, which is what it is. Deliberately not a second
        // copy of the server-outcome classification: that decision has one
        // home, next to the push it predicts.
        next = 'unreachable';
      }
      if (liveRef.current) setReachability(next);
    })();
  }, []);

  useEffect(() => {
    liveRef.current = true;
    probe();

    if (typeof window === 'undefined') {
      return () => {
        liveRef.current = false;
      };
    }

    window.addEventListener('focus', probe);
    return () => {
      liveRef.current = false;
      window.removeEventListener('focus', probe);
    };
  }, [probe]);

  return { reachability, recheck: probe };
}
