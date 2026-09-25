'use client';

/**
 * Read a Local Vault Revision as React state, given the revision itself.
 *
 * `useLocalVaultRevision` is the hook a page reaches for; it finds the
 * revision on the Vault Session and calls this. This half is its own module
 * so that `VaultSessionProvider` — which builds the revision and cannot read
 * it back through its own context — can subscribe to it too, without the
 * provider importing the hook that imports the provider. The provider needs
 * the reading so Vault Absent Evidence, which reads `vaultStatus()` at
 * render, sees the status move when the Local Vault is replaced.
 */
import { useCallback, useSyncExternalStore } from 'react';

import type { LocalVaultRevision } from '@myorganizer/web-vault';

/**
 * The revision a caller sees when there is no Vault Session to read one from.
 * Constant, so it never triggers a reload.
 *
 * Exported because `reconcileRunner.tsx` answers the same question — what a
 * reader holding no Local Vault Revision should read — and two constants
 * spelling one concept drift apart. It lives here, beside the reader that
 * uses it, rather than being re-exported through `useLocalVaultRevision`.
 */
export const NO_REVISION = 0;

export function useLocalVaultRevisionOf(
  revision: LocalVaultRevision | null,
): number {
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
