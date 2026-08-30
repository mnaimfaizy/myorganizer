'use client';

import { useEffect, useMemo, useRef } from 'react';

import { createVaultApi, createVaultPullTrigger } from '@myorganizer/web-vault';

import { useOptionalVaultSession } from './session';

/**
 * Runs Vault Pull: on mount and on window focus, checks every Vault Blob
 * Type against the server and converges the ones that moved. Renders
 * nothing — a pull never asks the User anything (`prompt` always defers),
 * the same choice `VaultSessionProvider`'s push queue makes and for the same
 * reason: a Vault Blob Type pinned `promptOnConflict` surfaces its
 * divergence at the next sign-in reconcile, not as a dialog interrupting
 * whatever the User is doing in the background.
 */
export function VaultPullRunner() {
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const owner = handle?.owner ?? null;

  // Mirrors `VaultReconcileRunner`'s `handleRef`: keeps the effect below
  // keyed on `owner` alone, so a lock/unlock — which changes `handle`'s
  // identity but not its owner — never tears down and rebuilds the trigger
  // mid-debounce.
  const handleRef = useRef(handle);
  useEffect(() => {
    handleRef.current = handle;
  }, [handle]);

  const trigger = useMemo(() => {
    if (owner === null) return null;

    return createVaultPullTrigger({
      api: createVaultApi(),
      prompt: () => 'defer',
    });
  }, [owner]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!trigger) return;

    const requestCheck = () => {
      const currentHandle = handleRef.current;
      if (currentHandle) trigger.requestCheck(currentHandle);
    };

    requestCheck();
    window.addEventListener('focus', requestCheck);
    return () => window.removeEventListener('focus', requestCheck);
  }, [trigger]);

  return null;
}
