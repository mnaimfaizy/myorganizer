/**
 * The Vault Pull trigger — when a device asks what changed elsewhere.
 *
 * A caller asks on mount and on window focus; both collapse into the same
 * debounced pass over `checkVaultBlobsForUpdates`, for the same reason
 * `vaultSyncQueue.ts` debounces a drain: several triggers arriving together
 * — mount immediately followed by a focus event, or several focus events in
 * one tick — should cost one pass over the Vault Blob Types, not one each.
 *
 * Convergence is eventual and focus-driven by design here, not a limitation
 * to fix later: two tabs sitting side by side do not update each other in
 * place. Tab away and back and they converge.
 *
 * Once a pass finds the Session gone (401/403), the trigger stops for good.
 * There is no Session left to check against, so a later focus event would
 * only repeat the same answer at the User's expense.
 */
import { VaultApi } from '@myorganizer/app-api-client';

import type {
  ConvergingVaultHandle,
  VaultBlobConvergePrompt,
} from './vaultConverge';
import {
  checkVaultBlobsForUpdates,
  type VaultPullCheckResult,
} from './vaultPullCheck';

export type VaultPullTriggerScheduler = (run: () => void) => void;

/**
 * How long the default scheduler waits before checking.
 *
 * Gathers a burst of triggers the way `VAULT_SYNC_DRAIN_DELAY_MS` gathers a
 * burst of saves — a mount immediately followed by a focus event costs one
 * pass, not two.
 */
export const VAULT_PULL_DEBOUNCE_MS = 500;

export type VaultPullTrigger = {
  /**
   * Ask for a check. Multiple calls inside the debounce window collapse into
   * one pass, reading whichever handle reported most recently — the same
   * reasoning as `vaultSyncQueue`'s `lastReporter`.
   *
   * A no-op once the trigger has stopped.
   */
  requestCheck(handle: ConvergingVaultHandle): void;
  /**
   * Run a pass immediately, bypassing the debounce — what `requestCheck`
   * eventually calls. Exposed so a caller can await one pass directly.
   *
   * Resolves with nothing checked, without reaching the network, once the
   * trigger has stopped.
   */
  check(handle: ConvergingVaultHandle): Promise<VaultPullCheckResult>;
};

const debounceAfterDelay: VaultPullTriggerScheduler = (run) => {
  setTimeout(run, VAULT_PULL_DEBOUNCE_MS);
};

export function createVaultPullTrigger(options: {
  api: Pick<VaultApi, 'getVaultBlob' | 'putVaultBlob'>;
  prompt: VaultBlobConvergePrompt;
  schedule?: VaultPullTriggerScheduler;
}): VaultPullTrigger {
  const schedule = options.schedule ?? debounceAfterDelay;

  let stopped = false;
  let scheduled = false;
  let lastHandle: ConvergingVaultHandle | null = null;
  /**
   * The tail of the check chain. Passes are serialised the same reason
   * `vaultSyncQueue`'s drains are: two at once would race two conditional
   * reads and merges for the same type.
   */
  let tail: Promise<unknown> = Promise.resolve();

  function runPass(
    handle: ConvergingVaultHandle,
  ): Promise<VaultPullCheckResult> {
    const pass = () =>
      checkVaultBlobsForUpdates({
        api: options.api,
        handle,
        prompt: options.prompt,
      });
    const result = tail.then(pass, pass);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function check(
    handle: ConvergingVaultHandle,
  ): Promise<VaultPullCheckResult> {
    if (stopped) {
      return { checked: [], failed: [], stoppedUnauthenticated: true };
    }

    const result = await runPass(handle);
    if (result.stoppedUnauthenticated) stopped = true;
    return result;
  }

  return {
    requestCheck(handle) {
      if (stopped) return;
      lastHandle = handle;

      // One scheduled pass per turn, however many triggers arrived in it.
      if (scheduled) return;
      scheduled = true;
      schedule(() => {
        scheduled = false;
        if (lastHandle) void check(lastHandle);
      });
    },

    check,
  };
}
