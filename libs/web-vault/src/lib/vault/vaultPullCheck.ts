/**
 * The pull check — asking the server which Vault Blob Types moved since this
 * device's Sync Bookmarks, and converging the ones that did.
 *
 * This is Vault Pull's decision loop, expressed as repeated entries into
 * `convergeVaultBlob` rather than a second convergence — see
 * [ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)
 * and the note at the top of `vaultConverge.ts`.
 *
 * A pass reads the Vault Blob Inventory first and asks about a Vault Blob Type
 * only when the inventory says its Ciphertext differs from this device's Sync
 * Bookmark ([ADR 0087](../../../../../docs/adr/0087-a-vault-pull-pass-asks-the-vault-blob-inventory-and-absence-deletes-nothing.md)).
 * Three things follow, and each is load-bearing:
 *
 *   - A type with **no** Sync Bookmark here differs from every etag the
 *     inventory could name, so it is read. That is how a type created on
 *     another device is discovered; skipping types this device holds nothing
 *     for would end that discovery silently.
 *   - A type **missing from the inventory** is neither read nor written. There
 *     is nothing to pull for it, which is never the same as something to
 *     delete (decision 5) — reading absence as deletion is the shape that
 *     destroyed grocery Ciphertext in
 *     [#512](https://github.com/mnaimfaizy/myorganizer/issues/512).
 *   - A **failed** inventory read fails the pass: every type is recorded
 *     unanswered and none is read. There is deliberately no fallback to the
 *     five-way fan-out (decision 6) — a path that runs only when something is
 *     already wrong is a path nothing exercises.
 *
 * The inventory read is itself conditional, so the steady state of a pass is
 * one request answered 304 and nothing else. `inventoryEtag` carries the ETag
 * a previous pass was answered with; see its doc for what a caller may pass.
 *
 * Per-type reads stay serial, and a pass that has something to converge also
 * observes the server's Vault Meta once and hands that observation to every
 * type it converges: convergence refuses to take a Vault Blob across a
 * differing Vault Identity and cannot go and look for itself, because it runs
 * once per type ([ADR 0067](../../../../../docs/adr/0067-a-vault-blob-is-never-taken-across-a-vault-identity.md)).
 * A pass with nothing to converge makes no such request — there is nothing for
 * the evidence to guard.
 *
 * Session loss is not a retryable failure here. A 401 or 403 means this
 * device can no longer speak for the User, so the pass stops rather than
 * working through the remaining Vault Blob Types against a Session that is
 * already gone. That holds for the inventory read exactly as it holds for a
 * per-type one.
 *
 * A pass can also be cut short from outside, through an `AbortSignal` its
 * caller owns — `vaultPullTrigger.ts` aborts a pass that a newer one
 * supersedes or that has run past its budget
 * ([ADR 0088](../../../../../docs/adr/0088-a-vault-pull-pass-has-a-budget-and-is-superseded-never-queued.md),
 * decisions 1–3). It acts in three places, and the three are not the same
 * promise:
 *
 *   - It **reaches the network** on every read this pass makes itself — the
 *     inventory, each per-type conditional GET, and the one Vault Meta
 *     observation — through the generated client's per-call request options, so
 *     a request in flight is actually cancelled and its socket released.
 *   - It **ends every wait**, through {@link untilAborted}. Handing a transport
 *     a signal is a request to stop, not a guarantee, and a pass that only
 *     learned its budget was spent by the request rejecting would never end at
 *     all against one that ignored it — which is the exact failure the budget
 *     exists to prevent (ADR 0088's Context: "One request that never settles
 *     stops the device pulling"). So the wait is ended here whether or not the
 *     request obeys.
 *   - It is **checked before each type**, which is what makes the common case
 *     cost nothing: an abort that landed between two types buys no request.
 *
 * Every type the pass did not answer is recorded in `failed`, so a pass cut
 * short reports what it owes rather than reporting a clean sweep of the types
 * it never looked at. Because each wait ends where the type was owed, that set
 * is the real one and not an approximation.
 *
 * What the signal does **not** do is cancel the requests `convergeVaultBlob`
 * makes — its conflict re-read and its write are its own, and this pass does
 * not reach into them. Only the waiting stops. So a convergence aborted
 * mid-write may still land on the server, and that is allowed rather than
 * worked around: each type converges against its own blob and its own Sync
 * Bookmark, so a pass abandoned part-way has left every converged type
 * complete, and a write whose bookmark was never recorded costs a repeated
 * push, never an edit (ADR 0088, decision 5, and
 * [ADR 0058](../../../../../docs/adr/0058-a-sync-bookmark-is-a-second-per-user-namespace-not-a-second-vault.md)).
 */
import { VaultApi, VaultBlobType } from '@myorganizer/app-api-client';

import { getHttpStatus } from '../http/getHttpStatus';

import {
  checkServerVaultBlob,
  checkServerVaultBlobInventory,
  observeServerVaultMetaOnce,
  type ServerVaultBlobCheck,
} from './serverVaultSync';
import { VAULT_BLOB_FIELDS, VAULT_BLOB_TYPES } from './vaultBlobFields';
import {
  convergeVaultBlob,
  type ConvergingVaultHandle,
  type VaultBlobConvergeOutcome,
  type VaultBlobConvergePrompt,
} from './vaultConverge';

/**
 * What checking one Vault Blob Type found.
 *
 * `'changed'` is `ServerVaultBlobCheck`'s, never this pass's: a changed check
 * always becomes `'converged'` before it is recorded, so a consumer switching
 * on `kind` never has to handle a check that was never converged.
 */
export type VaultPullOutcome =
  | Exclude<ServerVaultBlobCheck, { kind: 'changed' }>
  | { kind: 'converged'; outcome: VaultBlobConvergeOutcome };

/** What one pass over every Vault Blob Type did. */
export type VaultPullCheckResult = {
  /** Every type this pass reached, and what it found. */
  checked: { type: VaultBlobType; outcome: VaultPullOutcome }[];
  /**
   * A type this pass could not check — a transport failure, not a 401/403.
   *
   * Also every type left unreached when the pass was aborted, each recorded
   * against the signal's abort reason. Unanswered is unanswered however the
   * pass came to stop, and a caller that must say whether the last pass got
   * every answer reads exactly this.
   */
  failed: { type: VaultBlobType; error: unknown }[];
  /**
   * Set when the inventory read or a per-type check found the Session gone.
   * The remaining Vault Blob Types were never reached — there is no Session
   * left to check them against.
   */
  stoppedUnauthenticated: boolean;
  /**
   * The ETag the Vault Blob Inventory answered with, or `undefined` when this
   * pass never got one — a failed inventory read, or a Session already gone.
   *
   * A 304 reports back the ETag that produced it, since a 304 is the server
   * saying that ETag still describes what it holds.
   */
  inventoryEtag?: string;
};

/**
 * The endpoints this check uses, and no others.
 *
 * `getVaultMeta` is here for one field: convergence refuses to take a Vault
 * Blob across a differing Vault Identity and needs this pass's observation of
 * the server's Vault Meta to say whether it differs
 * ([ADR 0067](../../../../../docs/adr/0067-a-vault-blob-is-never-taken-across-a-vault-identity.md)).
 * Reading a Vault Meta is not converging one — that stays in
 * `vaultMetaConverge.ts`, and nothing here can write one.
 */
type VaultPullApi = Pick<
  VaultApi,
  'getVaultBlob' | 'putVaultBlob' | 'getVaultMeta' | 'getVaultBlobInventory'
>;

/**
 * What a Vault Blob Type left unreached by an abort is recorded against.
 *
 * The signal's own reason where there is one — the trigger names the
 * difference between a supersede and a spent budget there — and a plain error
 * otherwise, so a `failed` entry never carries `undefined` in the one field a
 * caller reads to find out what went wrong.
 */
function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error('The Vault Pull Pass was aborted.');
}

/**
 * Wait for `work`, or for `signal` to abort — whichever comes first.
 *
 * This is what makes a budget a budget. An `AbortSignal` handed to the
 * generated client is a request to stop and not a promise to: axios honours it,
 * a stubbed transport need not, and a request already past the point of
 * cancelling will not. A pass that learned its time was up only by its own
 * request rejecting would therefore keep the failure it was built to end —
 * the device stops pulling, silently, exactly as in
 * [#697](https://github.com/mnaimfaizy/myorganizer/issues/697).
 *
 * So the wait is ended here, from the pass's side, and the abandoned request is
 * left to settle into nothing. Rejecting with the signal's own reason is what
 * lets the caller's existing failure handling record the type as unanswered
 * without knowing an abort is what happened.
 */
function untilAborted<T>(
  signal: AbortSignal | undefined,
  work: Promise<T>,
): Promise<T> {
  if (!signal) return work;

  return Promise.race([
    work,
    new Promise<never>((_resolve, reject) => {
      if (signal.aborted) {
        reject(abortReason(signal));
        return;
      }
      signal.addEventListener('abort', () => reject(abortReason(signal)), {
        once: true,
      });
    }),
  ]);
}

/**
 * Read the Vault Blob Inventory and converge every Vault Blob Type it says
 * moved.
 *
 * Types are checked in the pinned order. A 401/403 — on the inventory or on
 * any one type — ends the pass immediately; see the module doc. Any other
 * per-type failure is recorded and the pass moves on: the next pass simply
 * asks again, since what makes a type worth checking is its Sync Bookmark and
 * the inventory, not anything this pass remembers.
 */
export async function checkVaultBlobsForUpdates(options: {
  api: VaultPullApi;
  handle: ConvergingVaultHandle;
  prompt: VaultBlobConvergePrompt;
  /**
   * The ETag a previous pass's inventory read answered with, sent as
   * `If-None-Match` so an unchanged server can answer 304 and this pass can
   * stop there.
   *
   * Pass one only from a pass that left nothing to do — every Vault Blob Type
   * answered, and none of them converged. A 304 says the server has not moved;
   * it says nothing about what this device did with the last answer, so an
   * ETag carried over from a pass that left a type unanswered — or converged
   * one without writing, as a refusal, a deferral and a locked Vault all do —
   * would skip that type for as long as the server stayed still.
   * `vaultPullTrigger.ts` is what decides that, in `leftNothingToDo`.
   */
  inventoryEtag?: string;
  /**
   * Ends this pass early — a newer pass superseding it, or its budget running
   * out. Reaches every read the pass makes and is checked before each Vault
   * Blob Type; see the module doc for what it does not reach.
   */
  signal?: AbortSignal;
}): Promise<VaultPullCheckResult> {
  const { api, handle, prompt, signal } = options;
  const result: VaultPullCheckResult = {
    checked: [],
    failed: [],
    stoppedUnauthenticated: false,
  };

  let serverEtags: Map<VaultBlobType, string>;

  try {
    const inventory = await untilAborted(
      signal,
      checkServerVaultBlobInventory(api, options.inventoryEtag, signal),
    );

    if (inventory.kind === 'not-modified') {
      // Nothing moved anywhere, so every type is answered and none is read.
      // This is the steady state: one request, and the pass ends here.
      result.inventoryEtag = options.inventoryEtag;
      for (const type of VAULT_BLOB_TYPES) {
        result.checked.push({ type, outcome: { kind: 'not-modified' } });
      }
      return result;
    }

    result.inventoryEtag = inventory.inventory.etag;
    serverEtags = new Map(
      inventory.inventory.blobs.map((entry) => [entry.type, entry.etag]),
    );
  } catch (error) {
    const status = getHttpStatus(error);
    if (status === 401 || status === 403) {
      // Exactly what a per-type 401/403 does: no type was reached, and
      // there is no Session left to reach one with.
      result.stoppedUnauthenticated = true;
      return result;
    }

    // No fallback. Every type is unanswered and the next pass retries.
    for (const type of VAULT_BLOB_TYPES) {
      result.failed.push({ type, error });
    }
    return result;
  }

  /** This pass's one observation of the server's Vault Meta. */
  const observeServerMeta = observeServerVaultMetaOnce(api, signal);

  for (const [index, type] of VAULT_BLOB_TYPES.entries()) {
    if (signal?.aborted) {
      // Read before the request rather than after it, so an abort that landed
      // between two types costs nothing at all. Every remaining type is
      // unanswered — including this one, which was never asked about.
      const reason = abortReason(signal);
      for (const unreached of VAULT_BLOB_TYPES.slice(index)) {
        result.failed.push({ type: unreached, error: reason });
      }
      break;
    }

    const serverEtag = serverEtags.get(type);

    if (serverEtag === undefined) {
      // The server holds no Ciphertext of this type — nothing to pull, and
      // nothing to write. Absence is never a deletion (ADR 0087, decision 5).
      result.checked.push({ type, outcome: { kind: 'absent' } });
      continue;
    }

    const ifNoneMatch = handle.lastPushedEtag(VAULT_BLOB_FIELDS[type]);

    if (ifNoneMatch === serverEtag) {
      // The inventory already answered "not modified" for this type, so the
      // conditional GET that would say the same is never made.
      result.checked.push({ type, outcome: { kind: 'not-modified' } });
      continue;
    }

    try {
      // `ifNoneMatch` still goes up. The inventory is what decided this type
      // is worth asking about; the conditional GET is what keeps the answer
      // honest if the server moved again in between.
      const check = await untilAborted(
        signal,
        checkServerVaultBlob(api, type, ifNoneMatch, signal),
      );

      if (check.kind !== 'changed') {
        result.checked.push({ type, outcome: check });
        continue;
      }

      // Never applied straight to the Local Vault — a remote change merges
      // by record against what this device already holds, so an unsent
      // local edit survives a pull that arrives before it is sent.
      //
      // Both waits end on an abort, convergence's included. Its own requests
      // are not cancelled with it, so a write already sent may still land —
      // which is the partly-applied pass decision 5 allows.
      const serverMeta = await untilAborted(signal, observeServerMeta());
      const outcome = await untilAborted(
        signal,
        convergeVaultBlob({
          api,
          handle,
          type,
          prompt,
          serverMeta,
          remote: check.blob,
        }),
      );
      result.checked.push({ type, outcome: { kind: 'converged', outcome } });
    } catch (error) {
      const status = getHttpStatus(error);
      if (status === 401 || status === 403) {
        result.stoppedUnauthenticated = true;
        break;
      }
      result.failed.push({ type, error });
    }
  }

  return result;
}
