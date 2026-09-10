'use client';

import { useEffect, useState } from 'react';

import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  VAULT_BLOB_FIELDS,
  VAULT_BLOB_TYPES,
  type VaultHandle,
} from '@myorganizer/web-vault';

import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';

export type UnsentVaultBlobTypesState =
  | { status: 'pending'; types: null }
  | { status: 'loaded'; types: VaultBlobType[] };

const PENDING: UnsentVaultBlobTypesState = { status: 'pending', types: null };

async function unsentVaultBlobTypes(
  handle: VaultHandle,
): Promise<VaultBlobType[]> {
  const unsent: VaultBlobType[] = [];
  for (const type of VAULT_BLOB_TYPES) {
    if (await handle.hasUnsentChanges(VAULT_BLOB_FIELDS[type])) {
      unsent.push(type);
    }
  }
  return unsent;
}

/**
 * Vault Blob Types with Ciphertext this device has never sent to the server —
 * what the removal confirmation names instead of reasoning from Escape Copy
 * freshness (ADR 0068 decision point 5). Recomputed every time `active`
 * becomes true (the confirmation dialog's own `open` state), not just once
 * when the owning component mounts, so the answer reflects the Vault's state
 * at the moment the dialog is shown. `VaultHandle.hasUnsentChanges` hashes
 * Ciphertext against this owner's Sync Bookmark, so it needs no Master Key
 * and this hook is correct while the Vault is locked.
 */
export function useUnsentVaultBlobTypes(
  active: boolean,
): UnsentVaultBlobTypesState {
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;

  const [state, setState] = useState<UnsentVaultBlobTypesState>(PENDING);

  useEffect(() => {
    if (!active || !handle) {
      // Only update state if it would actually change — prevents cascading renders
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((prev) => (prev.status === 'pending' ? prev : PENDING));
      return;
    }

    let cancelled = false;
    setState(PENDING);
    void unsentVaultBlobTypes(handle).then((types) => {
      if (!cancelled) setState({ status: 'loaded', types });
    });

    return () => {
      cancelled = true;
    };
  }, [active, handle]);

  return state;
}
