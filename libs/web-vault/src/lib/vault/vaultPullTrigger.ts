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

/**
 * Whether a pass left nothing for the next one to do — the condition for
 * reusing its inventory ETag.
 *
 * Stricter than "every type was answered", and deliberately so. A type in
 * `failed` was left unanswered and a pass that stopped on a 401/403 never
 * reached the types after it, but a type that was *converged* can also be left
 * owing work: convergence that refused a differing Vault Identity, deferred a
 * conflict, or found the Vault locked writes nothing and leaves the Sync
 * Bookmark where it was. The server has not moved for any of those, so the
 * next pass would be answered 304 and would never look at that type again —
 * a remote change pulled while the Vault was locked would still be unapplied
 * after the User unlocked.
 *
 * So the ETag carries only from a pass that converged nothing, which is
 * exactly the pass [ADR 0087](../../../../../docs/adr/0087-a-vault-pull-pass-asks-the-vault-blob-inventory-and-absence-deletes-nothing.md)
 * calls the steady state. The pass after a convergence costs one inventory
 * body instead of one 304, and re-derives every skip from the Sync Bookmarks
 * this device actually holds.
 */
function leftNothingToDo(result: VaultPullCheckResult): boolean {
  return (
    !result.stoppedUnauthenticated &&
    result.failed.length === 0 &&
    result.checked.every(({ outcome }) => outcome.kind !== 'converged')
  );
}

export function createVaultPullTrigger(options: {
  /**
   * What the pass below uses. `getVaultMeta` is read-only evidence for the
   * Vault Identity guard, never a Vault Meta convergence — see
   * `vaultPullCheck.ts`.
   */
  api: Pick<
    VaultApi,
    'getVaultBlob' | 'putVaultBlob' | 'getVaultMeta' | 'getVaultBlobInventory'
  >;
  prompt: VaultBlobConvergePrompt;
  schedule?: VaultPullTriggerScheduler;
}): VaultPullTrigger {
  const schedule = options.schedule ?? debounceAfterDelay;

  let stopped = false;
  let scheduled = false;
  let lastHandle: ConvergingVaultHandle | null = null;
  /**
   * The ETag the last pass's Vault Blob Inventory read answered with, so the
   * next pass can be answered 304 and read nothing at all.
   *
   * Held in memory for as long as the trigger is — one browser session — and
   * never stored: losing it costs one inventory body, never an answer.
   *
   * Kept only when the pass it came from left nothing to do — see
   * {@link leftNothingToDo}. A 304 says the server has not moved, not that
   * this device acted on what it last said, so carrying an ETag across a pass
   * that left a type unanswered or unconverged would skip that type for as
   * long as the server stayed still.
   */
  let inventoryEtag: string | undefined;
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
    const pass = async () => {
      const result = await checkVaultBlobsForUpdates({
        api: options.api,
        handle,
        prompt: options.prompt,
        inventoryEtag,
      });
      inventoryEtag = leftNothingToDo(result)
        ? result.inventoryEtag
        : undefined;
      return result;
    };
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
