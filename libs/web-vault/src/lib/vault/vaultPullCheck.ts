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
 *     six-way fan-out (decision 6) — a path that runs only when something is
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
  /** A type this pass could not check — a transport failure, not a 401/403. */
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
}): Promise<VaultPullCheckResult> {
  const { api, handle, prompt } = options;
  const result: VaultPullCheckResult = {
    checked: [],
    failed: [],
    stoppedUnauthenticated: false,
  };

  let serverEtags: Map<VaultBlobType, string>;

  try {
    const inventory = await checkServerVaultBlobInventory(
      api,
      options.inventoryEtag,
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
  const observeServerMeta = observeServerVaultMetaOnce(api);

  for (const type of VAULT_BLOB_TYPES) {
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
      const check = await checkServerVaultBlob(api, type, ifNoneMatch);

      if (check.kind !== 'changed') {
        result.checked.push({ type, outcome: check });
        continue;
      }

      // Never applied straight to the Local Vault — a remote change merges
      // by record against what this device already holds, so an unsent
      // local edit survives a pull that arrives before it is sent.
      const outcome = await convergeVaultBlob({
        api,
        handle,
        type,
        prompt,
        serverMeta: await observeServerMeta(),
        remote: check.blob,
      });
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
