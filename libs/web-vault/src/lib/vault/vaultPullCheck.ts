/**
 * The pull check — asking the server, for every Vault Blob Type, whether its
 * Ciphertext moved since this device's Sync Bookmark, and converging the
 * types that did.
 *
 * This is Vault Pull's decision loop, expressed as repeated entries into
 * `convergeVaultBlob` rather than a second convergence — see
 * [ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)
 * and the note at the top of `vaultConverge.ts`. A conditional GET is the
 * whole of the "did anything change" question: the Sync Bookmark's ETag goes
 * up as `If-None-Match`, and a 304 answers it for free — no body, no local
 * write, nothing for convergence to do.
 *
 * Session loss is not a retryable failure here. A 401 or 403 means this
 * device can no longer speak for the User, so the pass stops rather than
 * working through the remaining Vault Blob Types against a Session that is
 * already gone.
 */
import { VaultApi, VaultBlobType } from '@myorganizer/app-api-client';

import { getHttpStatus } from '../http/getHttpStatus';

import {
  checkServerVaultBlob,
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
   * Set when a check found the Session gone. The remaining Vault Blob Types
   * were never reached — there is no Session left to check them against.
   */
  stoppedUnauthenticated: boolean;
};

/** The two Vault Blob endpoints this check uses, and no others. */
type VaultPullApi = Pick<VaultApi, 'getVaultBlob' | 'putVaultBlob'>;

/**
 * Check every Vault Blob Type against the server and converge the ones that
 * moved.
 *
 * Types are checked in order. A 401/403 on any one of them ends the pass
 * immediately — see the module doc. Any other per-type failure is recorded
 * and the pass moves on: the next pass simply asks again, since what makes a
 * type worth checking is its Sync Bookmark, not anything this pass remembers.
 */
export async function checkVaultBlobsForUpdates(options: {
  api: VaultPullApi;
  handle: ConvergingVaultHandle;
  prompt: VaultBlobConvergePrompt;
}): Promise<VaultPullCheckResult> {
  const { api, handle, prompt } = options;
  const result: VaultPullCheckResult = {
    checked: [],
    failed: [],
    stoppedUnauthenticated: false,
  };

  for (const type of VAULT_BLOB_TYPES) {
    const ifNoneMatch = handle.lastPushedEtag(VAULT_BLOB_FIELDS[type]);

    try {
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
