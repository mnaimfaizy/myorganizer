/**
 * Vault Absent Evidence — what proves whether the server holds a Vault for
 * the signed-in User, when this device holds none of its own.
 *
 * An absent Local Vault has no Vault Meta to compare a server answer against
 * — there is nothing here evidence could be evidence *about* — so the
 * question this module answers is narrower than Vault Claim Evidence's: not
 * "is this the same Vault", only "does the server hold one at all". A
 * downloaded wrapping is Vault Reconcile's write, not this module's: this
 * module only tells `VaultGate` whether the create offer in front of the User
 * is a fresh Vault or a destructive one
 * ([ADR 0066](../../../../../docs/adr/0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md),
 * decision point 4).
 *
 * Structurally read-only, for the same reason `checkVaultClaimEvidence` is:
 * one method, so no answer given to it can write anything anywhere.
 */
import { VaultApi } from '@myorganizer/app-api-client';

import { getHttpStatus } from '../http/getHttpStatus';

import { getServerVaultMeta, type ServerVaultMeta } from './serverVaultSync';

/**
 * What asking the server established for a device holding no Local Vault.
 *
 * Four outcomes for the same reason `VaultClaimEvidence` has four: a server
 * that holds nothing and a server that could not be reached are not the same
 * answer — the first lets the User create freely, the second must not — and a
 * Session that is gone is neither of those.
 */
export type VaultAbsentEvidence =
  /**
   * The server holds this User's Vault. Not offered to overwrite: the create
   * offer stays withheld while Vault Reconcile brings it onto this device.
   */
  | { kind: 'server-holds-vault'; serverMeta: ServerVaultMeta }
  /** The server holds nothing for this User either. Creating here is safe. */
  | { kind: 'no-server-vault' }
  /** No answer reached this device. Ask again with a connection. */
  | { kind: 'postponed' }
  /** The Session is gone. Not an absence, and not a negative. */
  | { kind: 'session-lost' };

/**
 * Ask the server whether it holds a Vault for the signed-in User.
 *
 * Takes `getVaultMeta` and nothing else, exactly as `checkVaultClaimEvidence`
 * does, so no answer given to it can write anything anywhere — locally or on
 * the server. What follows a `server-holds-vault` answer is Vault Reconcile's
 * own download, not a write this function or its caller carries out.
 */
export async function checkVaultAbsentEvidence(options: {
  api: Pick<VaultApi, 'getVaultMeta'>;
}): Promise<VaultAbsentEvidence> {
  let serverMeta: ServerVaultMeta | null;
  try {
    serverMeta = await getServerVaultMeta(options.api);
  } catch (error) {
    const status = getHttpStatus(error);
    if (status === 401 || status === 403) {
      return { kind: 'session-lost' };
    }
    // Everything else — a network that dropped, a 500, a gateway that timed
    // out — is the server not answering. Never read as an absence: an
    // absence would hand the check's own off-switch to whoever can drop the
    // network, offering a fresh-Vault control over a Vault the server still
    // holds.
    return { kind: 'postponed' };
  }

  return serverMeta
    ? { kind: 'server-holds-vault', serverMeta }
    : { kind: 'no-server-vault' };
}
