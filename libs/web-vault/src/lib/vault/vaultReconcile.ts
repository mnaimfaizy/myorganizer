/**
 * Vault Reconcile — the sign-in pass over one User's Vault.
 *
 * Reconcile decides nothing about a Vault Blob itself. Every Vault Blob Type
 * goes through `convergeVaultBlob`, the one place a convergence decision is
 * made ([ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)),
 * so this module is a loop and a pair of degenerate cases rather than a second
 * implementation of convergence. It used to be four hand-written directions —
 * download, upload, keep local, keep server — three of which carried their own
 * fan-out across the Vault Blob Types. That triplication *is*
 * [#512](https://github.com/mnaimfaizy/myorganizer/issues/512): Groceries was
 * present in some directions and missing from others, and a keep-server answer
 * destroyed a User's Ciphertext.
 *
 * The two directions that looked special are not. "No Local Vault" is every
 * type converging from an absent local side, once this device has a wrapping
 * to hold Ciphertext under; "no server Vault" is every type converging from an
 * absent remote side, once the server has a wrapping to hold it under. Both
 * reduce to the same loop, and the Vault Meta write is what makes them
 * degenerate rather than separate.
 *
 * What survives as whole-Vault is the one question that was never per-record:
 * the server's Ciphertext will not decrypt under this device's Master Key, so
 * the two sides are not the same Vault at all and no per-type answer means
 * anything. It is asked once and the answer is applied to every type that
 * raises it.
 *
 * Reconcile decides Vault Blobs and only Vault Blobs. Vault Meta converges
 * separately in `vaultMetaConverge.ts` ([ADR 0057](../../../../../docs/adr/0057-vault-meta-converges-separately-and-never-silently.md)),
 * and no answer given here moves a wrapping on either side — the one exception
 * being a server that holds no Vault Meta at all, where the first sync has
 * nothing to override.
 */
import { VaultApi, VaultBlobType } from '@myorganizer/app-api-client';

import { getHttpStatus } from '../http/getHttpStatus';

import {
  getServerVaultBlob,
  getServerVaultMeta,
  putServerVaultMetaEtagAware,
} from './serverVaultSync';
import { VAULT_BLOB_TYPES } from './vaultBlobFields';
import {
  convergeVaultBlob,
  type ConvergingVaultHandle,
  type VaultBlobConvergeDecision,
  type VaultBlobConvergeOutcome,
  type VaultBlobConvergePrompt,
} from './vaultConverge';
import { localToServerMeta, serverMetaToLocalVault } from './vaultShapes';

type VaultApiLike = Pick<
  VaultApi,
  'getVaultMeta' | 'putVaultMeta' | 'getVaultBlob' | 'putVaultBlob'
>;

/**
 * What the User answered when reconcile had to ask. The converge primitive's
 * vocabulary, unchanged: `defer` is the answer given by a User who gave no
 * answer, and it writes nothing on either side, so the choice survives to be
 * made again (ADR 0033).
 */
export type VaultReconcileDecision = VaultBlobConvergeDecision;

/**
 * A question reconcile could not answer on the User's behalf.
 *
 * `vault` is the whole-Vault question and the only one: the server's
 * Ciphertext did not decrypt under this device's Master Key, so this is not
 * one Vault seen from two devices and no per-record merge exists. It is asked
 * once per pass, however many types raise it.
 *
 * `blob` is one Vault Blob Type asking on its own terms — either its pinned
 * strategy is `promptOnConflict`, or this device's own Ciphertext for it is
 * unreadable. Neither says anything about the rest of the Vault.
 */
export type VaultReconcileAsk =
  | { kind: 'vault' }
  | {
      kind: 'blob';
      type: VaultBlobType;
      reason: 'strategy' | 'undecryptable-local';
    };

/**
 * Asks the User a question reconcile cannot answer.
 *
 * Deliberately carries no English: what a User is told is the caller's to
 * name, the same split `vaultSyncMessages.ts` keeps for the sync indicator.
 */
export type VaultReconcilePrompt = (
  ask: VaultReconcileAsk,
) => Promise<VaultReconcileDecision> | VaultReconcileDecision;

/** What this device and the server each held when the pass began. */
export type VaultReconcileStart =
  /** Both sides held a Vault. The ordinary case. */
  | 'both'
  /**
   * Only the server held one. This device was given the server's wrapping and
   * no Ciphertext, so every type converges from an absent local side.
   */
  | 'downloaded-server-wrapping'
  /**
   * Only this device held one. The server was given this device's wrapping and
   * no Ciphertext, so every type converges from an absent remote side.
   */
  | 'uploaded-local-wrapping';

/** One Vault Blob Type, and what converging it did. */
export type VaultReconcileConverged = {
  type: VaultBlobType;
  outcome: VaultBlobConvergeOutcome;
};

export type VaultReconcileResult =
  /** Neither this User's device nor the server holds a Vault yet. */
  | { kind: 'noop-nothing-to-reconcile' }
  /**
   * The Session is gone. Types already converged in this pass stand; the rest
   * were never reached, and there is no Session left to reach them with.
   */
  | { kind: 'skipped-not-authenticated' }
  | {
      kind: 'reconciled';
      start: VaultReconcileStart;
      /** Every Vault Blob Type, in `VAULT_BLOB_TYPES` order. */
      converged: VaultReconcileConverged[];
      /**
       * Whether any type was left unresolved by a dismissed prompt. A deferred
       * pass is unfinished business: nothing was written for that type, and the
       * caller is expected to let the question come back.
       */
      deferred: boolean;
    };

function isSessionGone(error: unknown): boolean {
  const status = getHttpStatus(error);
  return status === 401 || status === 403;
}

function wasDeferred(outcome: VaultBlobConvergeOutcome): boolean {
  return outcome.kind === 'asked' && outcome.decision === 'defer';
}

/**
 * Reconcile one User's Local Vault with their server Ciphertext.
 *
 * When a pass runs is the caller's question and never this function's, which is
 * why nothing here is written as a sign-in step (ADR 0066).
 *
 * This is not a migration: a User whose server Vault does not exist yet is
 * having an ordinary first sync, and a User with no Vault anywhere has nothing
 * to reconcile. Non-conflicting divergence converges without asking anything —
 * that is the whole point of going through the primitive. What still asks is
 * what the pinned strategy table says asks, plus the two unreadable-Ciphertext
 * cases, and no prompt is ever resolved on the User's behalf.
 *
 * Throws on transport failures other than a lost Session, exactly as the
 * primitive does. Types converged before the failure stand; the next pull or
 * push picks up the rest.
 */
export async function reconcileVaultWithServer(options: {
  api: VaultApiLike;
  handle: ConvergingVaultHandle;
  prompt: VaultReconcilePrompt;
}): Promise<VaultReconcileResult> {
  const { api, handle } = options;

  const localVault = handle.loadVault();

  let serverMeta;
  try {
    serverMeta = await getServerVaultMeta(api);
  } catch (error) {
    if (isSessionGone(error)) return { kind: 'skipped-not-authenticated' };
    throw error;
  }

  let start: VaultReconcileStart;

  if (!localVault) {
    if (!serverMeta) return { kind: 'noop-nothing-to-reconcile' };

    // The server's wrapping, and no Ciphertext. Every Vault Blob Type then
    // arrives through the primitive as an ordinary take — including its Sync
    // Bookmark, which the old hand-written download never recorded.
    handle.saveVault(
      serverMetaToLocalVault({ meta: serverMeta.meta, blobs: {} }),
    );
    start = 'downloaded-server-wrapping';
  } else if (!serverMeta) {
    // The only Vault Meta write left in reconcile, and the only safe one: the
    // server holds no wrapping at all, so there is nothing here to override
    // and no other device whose passphrase change could be reverted.
    await putServerVaultMetaEtagAware({
      api,
      meta: localToServerMeta(localVault),
      // Reachable only as a race: the server held no Vault Meta at the read
      // above and holds one by the time of this write, so another device
      // created the Vault in between. Keeping theirs is the safe answer —
      // overwriting it would replace a wrapping this pass never saw, which is
      // exactly what reconcile is not allowed to do (ADR 0057, ADR 0060).
      onConflict: () => 'keep-remote',
    });
    start = 'uploaded-local-wrapping';
  } else {
    start = 'both';
  }

  // Asked at most once per pass. A second type finding the same unreadable
  // remote is the same fact about the same Vault, not a second question.
  let wholeVaultDecision: VaultReconcileDecision | null = null;

  const prompt: VaultBlobConvergePrompt = async ({ type, reason }) => {
    if (reason !== 'undecryptable-remote') {
      return options.prompt({ kind: 'blob', type, reason });
    }

    wholeVaultDecision ??= await options.prompt({ kind: 'vault' });
    return wholeVaultDecision;
  };

  const converged: VaultReconcileConverged[] = [];

  for (const type of VAULT_BLOB_TYPES) {
    let remote;
    try {
      // Reconcile always looks. The primitive skips the read when this
      // device's Sync Bookmark already answers the question, and at sign-in
      // there may be no bookmark to answer it with.
      remote = await getServerVaultBlob(api, type);

      converged.push({
        type,
        outcome: await convergeVaultBlob({ api, handle, type, prompt, remote }),
      });
    } catch (error) {
      if (isSessionGone(error)) return { kind: 'skipped-not-authenticated' };
      throw error;
    }
  }

  return {
    kind: 'reconciled',
    start,
    converged,
    deferred: converged.some((entry) => wasDeferred(entry.outcome)),
  };
}
