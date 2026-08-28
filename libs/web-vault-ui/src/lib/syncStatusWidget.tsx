'use client';

/**
 * Wires the live Vault Session to `SyncStatusIndicator`. Not a Vault UI
 * Component itself — it reads `useVaultSyncStatus`, which is live state, so
 * it cannot be expressed with mock props alone (GUIDELINES §1) — the same
 * reason `pullRunner.tsx` and `reconcileRunner.tsx` sit beside the Vault UI
 * Components in this library rather than among them.
 */
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { useVaultSyncStatus } from './useVaultSyncStatus';

export function SyncStatusWidget({ className }: { className?: string }) {
  const { status, retry } = useVaultSyncStatus();

  return (
    <SyncStatusIndicator
      status={status}
      onRetry={retry}
      className={className}
    />
  );
}
