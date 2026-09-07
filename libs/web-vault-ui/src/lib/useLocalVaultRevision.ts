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
import { useOptionalVaultSession } from './session';
import { useLocalVaultRevisionOf } from './useLocalVaultRevisionOf';

export function useLocalVaultRevision(): number {
  return useLocalVaultRevisionOf(useOptionalVaultSession()?.revision ?? null);
}
