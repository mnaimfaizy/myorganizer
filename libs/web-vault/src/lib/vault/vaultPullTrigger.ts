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
 * only repeat the same answer at the User's expense. The trigger exposes
 * that in memory the way `vaultSyncQueue` exposes its own `sessionEnded` —
 * `status()` and `subscribe()` — so a sync status reading can tell a lost
 * Session from a merely-quiet one even when nothing has been pushed
 * ([ADR 0088](../../../../../docs/adr/0088-a-vault-pull-pass-has-a-budget-and-is-superseded-never-queued.md),
 * decision 7).
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

/**
 * What the trigger currently knows, read without running a pass.
 *
 * Mirrors `VaultSyncQueueStatus` deliberately: a sync status reading treats
 * the two the same way, so a caller comparing them needs no second shape to
 * learn.
 */
export type VaultPullTriggerStatus = {
  /**
   * Set once a pass met a 401/403. The trigger does not resume on its own —
   * there is no Session left to check against.
   */
  sessionEnded: boolean;
};

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
  /** Everything the trigger currently knows, for a status reading. */
  status(): VaultPullTriggerStatus;
  /**
   * Be told whenever `status()` might read differently — a pass stopping the
   * trigger for good. Returns a function that stops listening.
   */
  subscribe(listener: () => void): () => void;
};

const debounceAfterDelay: VaultPullTriggerScheduler = (run) => {
  setTimeout(run, VAULT_PULL_DEBOUNCE_MS);
};

export function createVaultPullTrigger(options: {
  /**
   * What the pass below uses. `getVaultMeta` is read-only evidence for the
   * Vault Identity guard, never a Vault Meta convergence — see
   * `vaultPullCheck.ts`.
   */
  api: Pick<VaultApi, 'getVaultBlob' | 'putVaultBlob' | 'getVaultMeta'>;
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

  const listeners = new Set<() => void>();
  function notify(): void {
    for (const listener of listeners) listener();
  }

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
    if (result.stoppedUnauthenticated) {
      stopped = true;
      notify();
    }
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

    status() {
      return { sessionEnded: stopped };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
