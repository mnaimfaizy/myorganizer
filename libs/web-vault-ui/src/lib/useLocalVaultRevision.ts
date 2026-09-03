'use client';

/**
 * Read the Local Vault Revision as React state.
 *
 * A page that loads Vault records into `useState` on mount goes on rendering
 * them after convergence has replaced what is stored — and, because every page
 * here saves the whole blob back from what it is holding, goes on to write the
 * converged record back out. Adding this hook's return value to a load
 * effect's dependencies is what makes the page read again instead
 * ([#587](https://github.com/mnaimfaizy/myorganizer/issues/587)).
 *
 * The number itself carries no meaning and is never rendered; only the fact
 * that it changed matters. A page outside a Vault Session gets a constant, so
 * a component that may render without a provider needs no branch of its own.
 */
import { useCallback, useSyncExternalStore } from 'react';

import { useOptionalVaultSession } from './session';

/**
 * The revision a caller sees when there is no Vault Session to read one from.
 * Constant, so it never triggers a reload.
 *
 * Exported because `reconcileRunner.tsx` answers the same question — what a
 * reader holding no Local Vault Revision should read — and two constants
 * spelling one concept drift apart.
 */
export const NO_REVISION = 0;

export function useLocalVaultRevision(): number {
  const revision = useOptionalVaultSession()?.revision ?? null;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!revision) return () => undefined;
      return revision.subscribe(onStoreChange);
    },
    [revision],
  );

  const getSnapshot = useCallback(
    () => revision?.current() ?? NO_REVISION,
    [revision],
  );

  // The third argument is the server snapshot. It has to be the same constant
  // every render or React reports a hydration mismatch — and it is honest
  // besides: a Local Vault lives in browser storage, so on the server there is
  // no revision to have moved.
  return useSyncExternalStore(subscribe, getSnapshot, () => NO_REVISION);
}
