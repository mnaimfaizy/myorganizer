/**
 * Classifying what a transport failure out of `convergeVaultBlob` means for
 * the Vault Sync Queue and Vault Pull — see the table in PRD #544 and the
 * acceptance criteria of #553.
 *
 * A 409 never reaches here: `convergeVaultBlob` resolves a conflict into an
 * outcome itself and only ever throws once that is exhausted (a fresh 409
 * with nothing left to merge is `send`'s own retry, not a caller-visible
 * throw). What a caller does see are three kinds, and they are not
 * interchangeable:
 *
 *   - `session-ended` (401/403) — this device can no longer speak for the
 *     User. Retrying repeats the same answer at their expense, so draining
 *     stops rather than working through the remaining Vault Blob Types.
 *   - `rejected` (422) — the server looked at this Ciphertext specifically
 *     and refused it. It will refuse it again, byte for byte, so retrying is
 *     not "not yet" — it is a stall dressed up as one. Terminal, and named.
 *   - `transient` (network failure, 5xx, or anything else unclassified) —
 *     nothing about this Ciphertext was rejected; the attempt just did not
 *     land. Retrying later is the correct response, so this is the only kind
 *     that keeps a type queued for automatic retry.
 */
import { getHttpStatus } from '../http/getHttpStatus';

export type VaultSyncFailureClass = 'transient' | 'session-ended' | 'rejected';

/**
 * Classify a transport failure caught from `convergeVaultBlob`.
 *
 * Unrecognised statuses — and no status at all, which is what a network
 * failure looks like — fall back to `transient`. Treating the unknown case as
 * retryable rather than terminal is the safer default: a wrongly-transient
 * classification costs a wasted retry, while a wrongly-terminal one silently
 * stops synchronising Ciphertext the server never actually rejected.
 */
export function classifyVaultSyncFailure(
  error: unknown,
): VaultSyncFailureClass {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) return 'session-ended';
  if (status === 422) return 'rejected';
  return 'transient';
}
