'use client';

import { useVaultDisabledState } from './useVaultDisabledState';
import { vaultOperationAvailability } from '../policy';
import type { VaultOperation, VaultOperationAvailability } from '../policy';

/**
 * Get the availability of a vault operation in the current vault state.
 *
 * Wraps `useVaultDisabledState` and `vaultOperationAvailability` so callers
 * need not duplicate the two-call pattern. Recomputes when the vault state
 * changes, including when the local vault is reconciled while the page is
 * mounted.
 */
export function useVaultOperationAvailability(
  operation: VaultOperation,
): VaultOperationAvailability {
  const disabledState = useVaultDisabledState();
  return vaultOperationAvailability(operation, disabledState);
}
