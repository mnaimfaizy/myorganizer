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
 * Passes are **superseded, never queued**. A pass is started by a focus event
 * meaning "tell me what is true now", so one started earlier is answering a
 * staler question and is aborted rather than waited on
 * ([ADR 0088](../../../../../docs/adr/0088-a-vault-pull-pass-has-a-budget-and-is-superseded-never-queued.md),
 * decision 1). What this replaced was a promise chain, and the chain is what
 * [#697](https://github.com/mnaimfaizy/myorganizer/issues/697) is about: a pass
 * whose request never settled never settled the chain either, so every later
 * check waited behind it for the life of the tab, with no error and no retry.
 *
 * Two things stop a pass, and each covers what the other cannot. A newer pass
 * aborts the outstanding one — which only helps a device that is still being
 * asked. `VAULT_PULL_PASS_BUDGET_MS` aborts a pass nothing else came along to
 * supersede, which is the device left on one tab with a request that hangs.
 *
 * The two end differently, and the difference is the point. A pass that spent
 * its budget resolves with the Vault Blob Types it never answered recorded as
 * failed — it owes those answers, and a status reading is entitled to say so.
 * A superseded pass claims nothing at all: a newer pass is already asking the
 * same question, so reporting the older one's unanswered types would report a
 * gap that is already being filled. It resolves rather than rejects, marked
 * `superseded`, because a rejection here reads the same as a failure and that
 * is the one distinction this module needs kept (decision 4).
 *
 * Once a pass finds the Session gone (401/403), the trigger stops for good.
 * There is no Session left to check against, so a later focus event would
 * only repeat the same answer at the User's expense. The trigger exposes
 * that in memory the way `vaultSyncQueue` exposes its own `sessionEnded` —
 * `status()` and `subscribe()` — so a sync status reading can tell a lost
 * Session from a merely-quiet one even when nothing has been pushed
 * ([ADR 0088](../../../../../docs/adr/0088-a-vault-pull-pass-has-a-budget-and-is-superseded-never-queued.md),
 * decision 7).
 *
 * The same `status()` also carries `stalledTypes` — which Vault Blob Types
 * the most recent non-superseded pass left unanswered, the Vault Pull Stall
 * of decision 6. `subscribe()` fires for that too, so a reading catches a
 * stall, and a stall clearing, without waiting for the next `focus`.
 */
import { VaultApi, VaultBlobType } from '@myorganizer/app-api-client';

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
 * How long one pass may run before it is aborted.
 *
 * Sits here rather than in the generated API client, which is a synced output
 * and carries no timeout of its own (ADR 0088, decision 3). Ten seconds is
 * long enough that a slow-but-answering connection finishes a pass over every
 * Vault Blob Type, and short enough that a device on a hung request is pulling
 * again on the next focus rather than on the next reload.
 *
 * Injectable through `budgetMs` so a test can shrink it to milliseconds; the
 * constant is what production runs on.
 */
export const VAULT_PULL_PASS_BUDGET_MS = 10_000;

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
  /**
   * The Vault Blob Types the most recent non-superseded pass left unanswered
   * — over budget, a failed Vault Blob Inventory read, or a type it could not
   * reach. Empty once a pass answers every type. This is the Vault Pull Stall
   * of ADR 0088, decision 6: state about the last pass, not a flag anything
   * has to lower — a later pass that gets every answer clears it by leaving
   * this empty, and a superseded pass never touches it, because it claims
   * nothing about what it was overtaken before finishing.
   */
  stalledTypes: VaultBlobType[];
};

/**
 * What one pass run through the trigger did.
 *
 * `VaultPullCheckResult` is what the pass itself found; `superseded` is the
 * trigger's own answer and the pass never sets it, because being overtaken is
 * not something a pass can observe about itself.
 *
 * Required rather than optional so every result states it. A caller deciding
 * whether the most recent pass left anything owing — the Vault Pull Stall of
 * ADR 0088, decision 6 — has to tell "nothing left to answer" from "not this
 * pass's question any more", and an absent field makes those two read alike.
 */
export type VaultPullPassResult = VaultPullCheckResult & {
  /**
   * Set when a newer pass took over before this one finished. Such a result
   * claims nothing: `checked` and `failed` are both empty, whatever the
   * abandoned pass had reached by then.
   */
  superseded: boolean;
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
   * Supersedes any outstanding pass, which resolves marked `superseded`
   * without waiting for whatever it is stuck on.
   *
   * Resolves with nothing checked, without reaching the network, once the
   * trigger has stopped.
   */
  check(handle: ConvergingVaultHandle): Promise<VaultPullPassResult>;
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

/**
 * A pass the trigger is still speaking for, and the two handles on it.
 *
 * `controller` is what a budget uses; `supersede` is what a newer pass uses,
 * and it does more than abort — it settles the older caller, which an abort on
 * its own cannot promise (a request is free to ignore one).
 */
type OutstandingPass = {
  supersede: () => void;
  controller: AbortController;
};

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
  /**
   * How long one pass may run, defaulting to {@link VAULT_PULL_PASS_BUDGET_MS}.
   * Here so a test can shrink it — production has no reason to pass one.
   */
  budgetMs?: number;
}): VaultPullTrigger {
  const schedule = options.schedule ?? debounceAfterDelay;
  const budgetMs = options.budgetMs ?? VAULT_PULL_PASS_BUDGET_MS;

  let stopped = false;
  let scheduled = false;
  let lastHandle: ConvergingVaultHandle | null = null;
  /**
   * The Vault Blob Types the most recent non-superseded pass left unanswered
   * — see {@link VaultPullTriggerStatus.stalledTypes}. Updated only by a pass
   * that actually finishes; a superseded one leaves this exactly as it found
   * it.
   */
  let stalledTypes: VaultBlobType[] = [];
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
   * The pass this trigger currently speaks for, if any.
   *
   * At most one **answers** at a time: a new pass supersedes its predecessor
   * rather than queueing behind it, and the superseded one stops being able to
   * report anything. It is not a claim that at most one is executing — an
   * abandoned pass ends its own waits but does not reach into a
   * `convergeVaultBlob` it already entered, so for as long as that write is in
   * flight, two passes overlap. That is the partly-applied pass ADR 0088's
   * decision 5 allows, and it is bounded by one type's convergence rather than
   * by the life of the tab, which is what the promise chain could not say.
   */
  let outstanding: OutstandingPass | null = null;

  const listeners = new Set<() => void>();
  function notify(): void {
    for (const listener of listeners) listener();
  }

  async function runPass(
    handle: ConvergingVaultHandle,
  ): Promise<VaultPullPassResult> {
    // Whatever was running is answering a staler question than this one.
    outstanding?.supersede();

    const controller = new AbortController();
    let wasSuperseded = false;
    const pass: OutstandingPass = { supersede: () => undefined, controller };
    // Resolved by `supersede()` and raced against the pass below, so being
    // overtaken ends this call even when the request it is stuck on ignores
    // the abort. Waiting for the abort to land is the mistake #697 is made
    // of: an unsettled request keeps an unsettled caller.
    const superseded = new Promise<VaultPullPassResult>((resolve) => {
      pass.supersede = () => {
        wasSuperseded = true;
        controller.abort(
          new Error('A newer Vault Pull Pass superseded this one.'),
        );
        resolve({
          checked: [],
          failed: [],
          stoppedUnauthenticated: false,
          superseded: true,
        });
      };
    });
    outstanding = pass;

    const overBudget = setTimeout(() => {
      controller.abort(
        new Error(
          `A Vault Pull Pass ran past its ${budgetMs}ms budget and was aborted.`,
        ),
      );
    }, budgetMs);

    try {
      const result = await Promise.race([
        checkVaultBlobsForUpdates({
          api: options.api,
          handle,
          prompt: options.prompt,
          inventoryEtag,
          signal: controller.signal,
        }).then((checked): VaultPullPassResult => {
          // Only a pass still speaking for the trigger may move the ETag.
          // This runs even for a pass that lost the race above — it finished,
          // late — and a stale answer written here would land on top of its
          // successor's.
          if (!wasSuperseded) {
            inventoryEtag = leftNothingToDo(checked)
              ? checked.inventoryEtag
              : undefined;
          }
          return { ...checked, superseded: false };
        }),
        superseded,
      ]);
      return result;
    } finally {
      clearTimeout(overBudget);
      if (outstanding === pass) outstanding = null;
    }
  }

  async function check(
    handle: ConvergingVaultHandle,
  ): Promise<VaultPullPassResult> {
    if (stopped) {
      return {
        checked: [],
        failed: [],
        stoppedUnauthenticated: true,
        superseded: false,
      };
    }

    const result = await runPass(handle);
    if (!result.superseded) {
      // A superseded pass claims nothing — see `VaultPullPassResult`. Only a
      // pass that actually finished may move what the trigger reports.
      const nextStalledTypes = result.failed.map((failure) => failure.type);
      const stalledChanged =
        nextStalledTypes.length !== stalledTypes.length ||
        nextStalledTypes.some((type, index) => type !== stalledTypes[index]);
      stalledTypes = nextStalledTypes;

      const stopsNow = result.stoppedUnauthenticated && !stopped;
      if (stopsNow) stopped = true;

      // Either half of `status()` may have just moved — a stop, or the
      // Vault Pull Stall reading — and a caller reading only on the next
      // `focus` would show a stale answer until the one after that.
      if (stopsNow || stalledChanged) notify();
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
      return { sessionEnded: stopped, stalledTypes };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
