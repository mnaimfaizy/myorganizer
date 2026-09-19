'use client';

import { useEffect, useRef } from 'react';

import { useOptionalVaultSession } from './session';

/**
 * Runs Vault Pull: on mount and on window focus, checks every Vault Blob
 * Type against the server and converges the ones that moved. Renders
 * nothing — a pull never asks the User anything (`prompt` always defers),
 * the same choice `VaultSessionProvider`'s push queue makes and for the same
 * reason: a Vault Blob Type pinned `promptOnConflict` surfaces its
 * divergence at the next reconcile pass, not as a dialog interrupting
 * whatever the User is doing in the background.
 *
 * The trigger itself lives on the Vault Session, created once per owner
 * beside the Vault Sync Queue — this component only wires it to mount and
 * focus. A trigger built here instead would not survive this component
 * unmounting, and a second instance duplicated every pass (#616).
 */
export function VaultPullRunner() {
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const trigger = vaultSession?.pullTrigger ?? null;

  // Mirrors `VaultReconcileRunner`'s `handleRef`: keeps the effect below
  // keyed on the trigger alone, so a lock/unlock — which changes `handle`'s
  // identity but not the trigger, since both are keyed on owner — never
  // tears down and rebuilds the effect mid-debounce.
  const handleRef = useRef(handle);
  useEffect(() => {
    handleRef.current = handle;
  }, [handle]);

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
