'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { useOptionalVaultSession } from './session';

/**
 * The `data-testid` an E2E spec waits on to know the dashboard's mount-time
 * vault async work has settled — not just that the shell rendered. See
 * `VaultMountSettleProvider`'s doc comment for what "settled" means and why
 * this exists (issue #858).
 */
export const DASHBOARD_MOUNT_SETTLED_TEST_ID = 'dashboard-mount-settled';

type VaultMountSettleLeg = 'meta-converge' | 'reconcile';

const ALL_LEGS: readonly VaultMountSettleLeg[] = ['meta-converge', 'reconcile'];

type VaultMountSettleContextValue = {
  reportSettled: (leg: VaultMountSettleLeg) => void;
};

const VaultMountSettleContext =
  createContext<VaultMountSettleContextValue | null>(null);

/**
 * Tracks whether the dashboard's mount-time vault async work has settled —
 * `VaultMetaConvergeRunner`'s and `VaultReconcileRunner`'s first pass
 * (reported explicitly through `useReportVaultMountSettle`), and
 * `VaultPullRunner`'s, read from the Vault Pull trigger's own
 * `firstSettled` since that runner's `requestCheck` is fire-and-forget by
 * design and has nothing of its own to await.
 *
 * Exists only to give E2E a deterministic "safe to hard-navigate now"
 * signal, rendered as a `data-testid` marker beside `children`. Nothing
 * here changes when these runners actually run, what they do, or how they
 * debounce/coalesce — it only watches.
 *
 * `waitForDashboardReady` (apps/myorganizer-e2e) proves `DashboardGuard`
 * resolved; it proves nothing about this. A spec that hard-navigates
 * immediately after login, before this settles, can tear down these
 * runners' in-flight requests mid-pass — the race issue #858 traced a
 * recurring WebKit `page.goto: internal error` back to.
 */
interface VaultMountSettleProviderProps {
  children: ReactNode;
}

export function VaultMountSettleProvider({
  children,
}: VaultMountSettleProviderProps) {
  const vaultSession = useOptionalVaultSession();
  const owner = vaultSession?.handle?.owner ?? null;
  const pullTrigger = vaultSession?.pullTrigger ?? null;

  const [settledLegs, setSettledLegs] = useState<
    ReadonlySet<VaultMountSettleLeg>
  >(new Set());
  const [pullSettled, setPullSettled] = useState(false);

  // A new owner starts a new mount's worth of work: forget what the
  // previous owner's passes reported, the same reset the runners themselves
  // give their own in-flight state on an owner change. Adjusted during
  // render rather than in an effect — the React-recommended way to reset
  // state derived from a prop
  // (https://react.dev/learn/you-might-not-need-an-effect) — which also
  // sidesteps an ordering hazard an effect would have: mount effects fire
  // children-first, so an effect here would run after a child's own mount
  // effect had already reported a leg, wiping it out.
  const [ownerAtLastRender, setOwnerAtLastRender] = useState(owner);
  if (owner !== ownerAtLastRender) {
    setOwnerAtLastRender(owner);
    setSettledLegs(new Set());
    setPullSettled(false);
  }

  // No owner means no session to watch — nothing pending, settled by
  // default (mirrors the mount-time state before DashboardGuard even lets a
  // caller reach this far in practice).
  const allSettled =
    owner === null ||
    (pullSettled && ALL_LEGS.every((leg) => settledLegs.has(leg)));

  useEffect(() => {
    if (!pullTrigger) return;
    let cancelled = false;
    void pullTrigger.firstSettled.then(() => {
      if (cancelled) return;
      setPullSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [pullTrigger]);

  const reportSettled = useCallback((leg: VaultMountSettleLeg) => {
    setSettledLegs((current) => {
      if (current.has(leg)) return current;
      return new Set(current).add(leg);
    });
  }, []);

  return (
    <VaultMountSettleContext.Provider value={{ reportSettled }}>
      {children}
      <span
        aria-hidden="true"
        data-testid={DASHBOARD_MOUNT_SETTLED_TEST_ID}
        data-settled={String(allSettled)}
        style={{ display: 'none' }}
      />
    </VaultMountSettleContext.Provider>
  );
}

/**
 * Report that `leg`'s first pass has settled. A no-op outside
 * `VaultMountSettleProvider` — `VaultMetaConvergeRunner` and
 * `VaultReconcileRunner`'s own unit tests render standalone, with no
 * wrapping provider.
 */
export function useReportVaultMountSettle(
  leg: VaultMountSettleLeg,
): () => void {
  const ctx = useContext(VaultMountSettleContext);
  return useCallback(() => {
    ctx?.reportSettled(leg);
  }, [ctx, leg]);
}
