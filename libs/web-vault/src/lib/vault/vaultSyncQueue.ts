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
 *
 * A failed send is not one thing — see `vaultSyncFailure.ts`. A transient
 * failure (network, 5xx, or anything unclassified) re-marks its type and
 * schedules an automatic retry with backoff. A session-ended failure
 * (401/403) stops the whole drain in place: the remaining marked types are
 * left marked, and nothing retries automatically until a caller drains again
 * with a live Session. A rejected failure (422) is terminal — the server
 * looked at this Ciphertext and refused it, and it will refuse the same bytes
 * again, so the type is recorded as a terminal failure instead of being
 * re-marked, and only a manual retry (`retryNow`) gives it another attempt.
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
import { classifyVaultSyncFailure } from './vaultSyncFailure';

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
 * When an automatic retry after a transient failure should run, given how
 * many consecutive transient-only drains have happened for this queue.
 *
 * Separate from {@link VaultSyncDrainScheduler}: a save schedules the first
 * attempt, this schedules the retries a failed attempt earns. Injected for
 * the same reason — the backoff curve is a latency choice, never a
 * correctness one, since a type stays marked (or terminal) regardless of how
 * long the wait is.
 */
export type VaultSyncRetryScheduler = (
  retry: () => void,
  attempt: number,
) => void;

/** The first automatic retry's delay, in milliseconds. */
export const VAULT_SYNC_RETRY_BASE_DELAY_MS = 2_000;

/** The longest an automatic retry ever waits, however many attempts fail. */
export const VAULT_SYNC_RETRY_MAX_DELAY_MS = 60_000;

/** Exponential backoff, capped, so a device offline for an hour is not
 * hammering the server every two seconds nor waiting an unbounded time to
 * notice reconnection. */
function retryDelayFor(attempt: number): number {
  return Math.min(
    VAULT_SYNC_RETRY_MAX_DELAY_MS,
    VAULT_SYNC_RETRY_BASE_DELAY_MS * 2 ** attempt,
  );
}

const retryAfterBackoff: VaultSyncRetryScheduler = (retry, attempt) => {
  setTimeout(retry, retryDelayFor(attempt));
};

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

/**
 * A Vault Blob Type the server has refused outright (422) — see
 * `vaultSyncFailure.ts`. Carries the HTTP status and nothing else: no error
 * message, no response body. The queue decided *that* this type is stuck, not
 * *what to tell the User about it* — that is a presentation concern, built
 * from `type` alone by whoever renders the status, which is what keeps
 * whatever the server chose to say in a 422 body out of anything a User
 * reads.
 */
export type VaultSyncTerminalFailure = {
  type: VaultBlobType;
  status: number;
};

/**
 * What the queue currently knows, read without draining anything.
 *
 * This is the "last drain outcome" half of sync status — the other half is
 * the Sync Bookmark comparison a caller makes separately per type. Nothing
 * here is persisted; it lives only as long as this queue instance does, which
 * is exactly as long as one browser session's Vault Handle does.
 */
export type VaultSyncQueueStatus = {
  /** Types marked unsent and eligible for another attempt — automatic or manual. */
  unsentTypes: VaultBlobType[];
  /** Types the server refused outright. Not included in `unsentTypes`. */
  terminalFailures: VaultSyncTerminalFailure[];
  /**
   * Set once a drain met a 401/403. Draining does not resume on its own —
   * see `retryNow`.
   */
  sessionEnded: boolean;
  /** Whether an automatic retry is currently waiting on its backoff delay. */
  retryScheduled: boolean;
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
  /** Everything the queue currently knows, for a status reading. */
  status(): VaultSyncQueueStatus;
  /**
   * A User-initiated retry: every terminal failure is given another attempt
   * alongside whatever is already unsent, the backoff clock resets, and a
   * Session-ended stop is lifted so the attempt actually reaches the network
   * rather than being skipped as already-known-stopped.
   *
   * Not automatic and never scheduled by the queue itself — a terminal
   * failure earns exactly the attempts a User asks for, never a retry loop
   * dressed up as one.
   */
  retryNow(handle: ConvergingVaultHandle): Promise<VaultSyncDrainResult>;
  /**
   * Be told whenever `status()` might read differently — a mark, a drain
   * finishing, or a retry being scheduled or firing. Returns a function that
   * stops listening.
   */
  subscribe(listener: () => void): () => void;
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
  retrySchedule?: VaultSyncRetryScheduler;
}): VaultSyncQueue {
  const schedule = options.schedule ?? drainAfterDelay;
  const retrySchedule = options.retrySchedule ?? retryAfterBackoff;

  /** The whole of the queue's state: which types are unsent. No Ciphertext. */
  const unsent = new Set<VaultBlobType>();
  /** Types the server refused outright. Disjoint from `unsent`. */
  const terminal = new Map<VaultBlobType, VaultSyncTerminalFailure>();
  let sessionEnded = false;
  let retryScheduled = false;
  /** How many consecutive drains ended with a transient failure left over. */
  let retryAttempt = 0;
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

  const listeners = new Set<() => void>();
  function notify(): void {
    for (const listener of listeners) listener();
  }

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
        result.failed.push({ type, error });
        const failureClass = classifyVaultSyncFailure(error);

        if (failureClass === 'session-ended') {
          // The Ciphertext still has not reached the server, so the type
          // stays marked — but nothing else in `unsent` gets a turn this
          // drain. Retrying against a Session that is already gone would
          // only repeat the same 401/403 for every remaining type.
          unsent.add(type);
          sessionEnded = true;
          break;
        }

        if (failureClass === 'rejected') {
          // Terminal: the server looked at this Ciphertext specifically and
          // refused it, and will refuse the same bytes again. Recording it
          // here — never back into `unsent` — is what stops a naive backoff
          // from retrying a 422 forever while the status reads "not synced
          // yet" for a save that will never land.
          terminal.set(type, { type, status: getStatus(error) });
          continue;
        }

        // Transient: nothing about this Ciphertext was rejected, the attempt
        // just did not land. Re-mark for a later drain, automatic or manual.
        unsent.add(type);
        stalled.add(type);
      }
    }

    return result;
  }

  function getStatus(error: unknown): number {
    // classifyVaultSyncFailure already confirmed this is a 'rejected'
    // failure, which only happens for a numeric 422 status.
    return (
      (error as { response?: { status?: number } })?.response?.status ?? 422
    );
  }

  function afterDrain(
    handle: ConvergingVaultHandle,
    result: VaultSyncDrainResult,
  ): void {
    notify();

    if (sessionEnded) {
      retryScheduled = false;
      return;
    }

    const hasTransientFailure = result.failed.some(
      (entry) => classifyVaultSyncFailure(entry.error) === 'transient',
    );

    if (!hasTransientFailure) {
      retryAttempt = 0;
      retryScheduled = false;
      return;
    }

    retryScheduled = true;
    const attempt = retryAttempt;
    retryAttempt += 1;
    notify();
    retrySchedule(() => {
      retryScheduled = false;
      void drain(handle);
    }, attempt);
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
    // Scheduling the follow-up (retry or none) never blocks the caller's
    // await on this drain's own result.
    void result.then(
      (drained) => afterDrain(handle, drained),
      () => undefined,
    );
    return result;
  }

  return {
    vaultBlobChanged({ type, handle }) {
      // A fresh edit deserves a fresh attempt: a type that was terminal
      // because *that* Ciphertext was refused says nothing about whether the
      // new Ciphertext will be too.
      terminal.delete(type);
      unsent.add(type);
      lastReporter = handle;
      notify();

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

    status() {
      return {
        unsentTypes: [...unsent],
        terminalFailures: [...terminal.values()],
        sessionEnded,
        retryScheduled,
      };
    },

    retryNow(handle) {
      for (const type of terminal.keys()) {
        unsent.add(type);
      }
      terminal.clear();
      sessionEnded = false;
      retryAttempt = 0;
      notify();
      return drain(handle);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
