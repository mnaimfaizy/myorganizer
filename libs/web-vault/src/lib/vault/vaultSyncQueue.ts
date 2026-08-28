/**
 * The Vault Handle's sync sink: a queue of unsent Vault Blob Types that drains
 * through the converge primitive.
 *
 * This is Vault Push — sending one changed Vault Blob as the ordinary
 * consequence of an edit — expressed as an entry into `convergeVaultBlob`
 * rather than as a second convergence. Nothing here decides between sending,
 * taking, merging and asking; it decides only *when* to ask that question and
 * *for which type*. Deciding it twice is what
 * [#512](https://github.com/mnaimfaizy/myorganizer/issues/512) was.
 *
 * The queue holds types, never payloads. Ten rapid saves to one type mark it
 * once, and the drain reads whatever the Local Vault holds at that moment, so
 * one send carries the final state. Coalescing is therefore structural: it
 * does not depend on a debounce interval tuned to guess how fast somebody
 * types, and it cannot be defeated by typing faster. A longer interval changes
 * how late the send happens and nothing else — a marked type stays marked
 * until a drain converges it, and a queue lost to a refresh costs a delay
 * rather than an edit, because the Sync Bookmark is what makes a Vault Blob
 * unsent and it is on disk.
 */
import { VaultApi, VaultBlobType } from '@myorganizer/app-api-client';

import { VAULT_BLOB_FIELDS } from './vaultBlobFields';
import {
  convergeVaultBlob,
  type ConvergingVaultHandle,
  type VaultBlobConvergeOutcome,
  type VaultBlobConvergePrompt,
} from './vaultConverge';
import type { VaultSyncSink } from './vaultHandle';

/**
 * When a drain triggered by a save should run.
 *
 * Injected rather than fixed because it is a latency choice, and a latency
 * choice is the one thing about this queue that is safe to vary: whatever the
 * scheduler does — run now, wait a second, wait for an idle callback — the
 * type stays marked until a drain converges it, because what makes a Vault
 * Blob unsent is its Sync Bookmark and not this queue.
 */
export type VaultSyncDrainScheduler = (drain: () => void) => void;

/**
 * How long the default scheduler waits before draining.
 *
 * It exists to gather a burst, not to guess a typing speed. Coalescing is
 * structural — the queue holds types and the drain reads the Local Vault when
 * it runs — so this number can be anything and the final state still goes up
 * exactly once per drain. What it buys is that a page saving on each keystroke
 * makes one request rather than one per letter: a save is `await`ed, so a
 * microtask-length wait would let every save's drain run before the next save
 * arrived, and structural coalescing would never get anything to coalesce.
 */
export const VAULT_SYNC_DRAIN_DELAY_MS = 1_000;

/**
 * What one drain did.
 *
 * `converged` is every type this drain put through the primitive, whatever it
 * decided — including the decisions that sent nothing. `failed` is the send
 * that did not land at all, and it carries no consequence for the Local Vault:
 * convergence writes local before it sends, or does not write local at all, so
 * a failure here leaves this device holding exactly what the edit left.
 *
 * Neither list is the record of what is still unsent. That is the Sync
 * Bookmark's, which is why the queue asks it rather than this result.
 */
export type VaultSyncDrainResult = {
  converged: { type: VaultBlobType; outcome: VaultBlobConvergeOutcome }[];
  failed: { type: VaultBlobType; error: unknown }[];
};

export type VaultSyncQueue = VaultSyncSink & {
  /** The Vault Blob Types marked unsent and not yet converged. */
  unsentTypes(): VaultBlobType[];
  /**
   * Converge every currently marked type against the server, reading the
   * Local Vault `handle` holds now.
   *
   * Never rejects: a transport failure is recorded in the result and re-marks
   * its type. Callers get a promise so a drain can be awaited in a test or on
   * an explicit "sync now"; a save never awaits one.
   */
  drain(handle: ConvergingVaultHandle): Promise<VaultSyncDrainResult>;
};

const drainAfterDelay: VaultSyncDrainScheduler = (drain) => {
  setTimeout(drain, VAULT_SYNC_DRAIN_DELAY_MS);
};

export function createVaultSyncQueue(options: {
  /** The two Vault Blob endpoints convergence uses, and no others. */
  api: Pick<VaultApi, 'getVaultBlob' | 'putVaultBlob'>;
  /** Asked only for the Vault Blob Types pinned `promptOnConflict`. */
  prompt: VaultBlobConvergePrompt;
  schedule?: VaultSyncDrainScheduler;
}): VaultSyncQueue {
  const schedule = options.schedule ?? drainAfterDelay;

  /** The whole of the queue's state: which types are unsent. No Ciphertext. */
  const unsent = new Set<VaultBlobType>();
  let scheduled = false;
  /**
   * The handle that reported the most recent change, drained by the scheduled
   * callback. It is the most recent rather than the first because locking and
   * unlocking build a new handle over the same Local Vault, and the newest one
   * is the one whose Master Key state matches the edit that just happened.
   */
  let lastReporter: ConvergingVaultHandle | null = null;
  /**
   * The tail of the drain chain. Drains are serialised because two at once
   * would race two conditional pushes for the same type, and the loser would
   * be a 409 that this device caused itself.
   */
  let tail: Promise<unknown> = Promise.resolve();

  async function runDrain(
    handle: ConvergingVaultHandle,
  ): Promise<VaultSyncDrainResult> {
    const result: VaultSyncDrainResult = { converged: [], failed: [] };
    /**
     * Types this drain has already been through that came back still unsent.
     * They are re-marked for a later drain, so without this they would be
     * picked straight back up and retried forever inside this one.
     */
    const stalled = new Set<VaultBlobType>();

    const takeNext = (): VaultBlobType | undefined => {
      for (const type of unsent) {
        if (stalled.has(type)) continue;
        // Unmarked *before* converging, not after: a save landing while this
        // one is in flight re-marks the type, and the loop below picks it up
        // again. Unmarking afterwards would erase that mark and strand the
        // newer edit until the next save.
        unsent.delete(type);
        return type;
      }
      return undefined;
    };

    for (let type = takeNext(); type; type = takeNext()) {
      try {
        result.converged.push({
          type,
          outcome: await convergeVaultBlob({
            api: options.api,
            handle,
            type,
            prompt: options.prompt,
          }),
        });

        // Converging is not the same as agreeing. Convergence returns without
        // sending in several ordinary cases — a conflict met while the Vault
        // was locked, a merge the server outran, a User who deferred the
        // choice — and each one leaves this device holding Ciphertext the
        // server has not got. Ask the Sync Bookmark rather than reading the
        // outcome's shape: the bookmark is what makes a Vault Blob unsent, so
        // it cannot disagree with itself, and a seventh outcome kind added
        // later needs no branch here to be handled correctly.
        if (await handle.hasUnsentChanges(VAULT_BLOB_FIELDS[type])) {
          unsent.add(type);
          stalled.add(type);
        }
      } catch (error) {
        // Nothing local moved — convergence writes local before it sends, or
        // not at all — so re-marking says only that a later drain should try
        // again.
        unsent.add(type);
        stalled.add(type);
        result.failed.push({ type, error });
      }
    }

    return result;
  }

  function drain(handle: ConvergingVaultHandle): Promise<VaultSyncDrainResult> {
    const result = tail.then(
      () => runDrain(handle),
      () => runDrain(handle),
    );
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    vaultBlobChanged({ type, handle }) {
      unsent.add(type);
      lastReporter = handle;

      // One scheduled drain per turn, however many types were marked in it.
      // The drain converges every marked type, so a second would find nothing.
      if (scheduled) return;
      scheduled = true;
      schedule(() => {
        scheduled = false;
        if (lastReporter) void drain(lastReporter);
      });
    },

    unsentTypes() {
      return [...unsent];
    },

    drain,
  };
}
