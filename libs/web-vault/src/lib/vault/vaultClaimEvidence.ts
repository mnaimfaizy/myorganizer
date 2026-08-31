/**
 * Vault Claim Evidence — what proves an Unclaimed Local Vault is the signed-in
 * User's, and the claim that follows when it does.
 *
 * The evidence in this module is the server's own Vault Meta. Only the
 * authenticated User can have written it, so a Vault Meta that points at the
 * Unclaimed Local Vault on this device says the Vault is theirs, and says it
 * without asking the User for anything. That is the strongest evidence there
 * is and the path most Users take
 * ([ADR 0061](../../../../../docs/adr/0061-vault-claim-is-proven-by-evidence-not-by-unwrap.md)).
 *
 * A passphrase unwrap is deliberately not consulted here. Key derivation uses
 * the Vault's own salt, so two people who share a passphrase string each
 * derive the same Master Key and each unwrap the other's Vault: an unwrap
 * proves knowledge of a string, never ownership of a Vault. Nothing in this
 * module takes a secret, and that is the point rather than an omission.
 *
 * Claiming is separate from unlocking, and this module only claims. Ownership
 * says whose Vault it is; unlocking says whether it can be read. Recording the
 * ownership the moment it is provable closes the window an Unclaimed Local
 * Vault is at risk in, and the User unlocks afterwards in the ordinary way.
 *
 * The fourth outcome is load-bearing. A server that cannot be reached has not
 * said "no Vault Meta" — it has said nothing, so the check postpones: nothing
 * offered, nothing written, and the question asked again with a connection.
 * Collapsing it into an absence would let anyone able to drop the network turn
 * the strong check off and fall through to a weaker one.
 */
import { VaultApi } from '@myorganizer/app-api-client';

import { getHttpStatus } from '../http/getHttpStatus';

import type { VaultStorageV1 } from './localVaultStorage';
import { getServerVaultMeta, type ServerVaultMeta } from './serverVaultSync';
import type { VaultHandle } from './vaultHandle';
import {
  describeVaultMetaDivergence,
  type VaultMetaChange,
} from './vaultMetaConverge';
import { localToServerMeta } from './vaultShapes';

/**
 * Whether a Vault Meta that diverges in this way is still the *same* Vault.
 *
 * This is the whole of the match test, and it is a narrower question than
 * "are these two Vault Metas equal". A passphrase or recovery key that moved
 * on another device rewraps the same Master Key and leaves the Vault the Vault
 * it always was — refusing there would deny a User their own Vault over a
 * rotation they performed themselves. A moved `kdf_salt` cannot be a rotation:
 * `changePassphrase` re-derives from the salt the Vault already has, and only
 * `initialize` mints a fresh one. So a salt that moved means the two sides
 * were initialized separately, and the server's Vault Meta is evidence about
 * some other Vault.
 *
 * A third table with the same answers as `VAULT_META_CHANGE_ADOPTABLE` and
 * `VAULT_META_CHANGE_PUSHABLE`, and separate for the reason those two are
 * separate from each other: they answer different questions that happen to
 * agree today. Adoptable asks whether this device may start using the server's
 * wrapping, pushable whether it may send its own over the server's, and this
 * asks only whether the two sides are the same Vault. Collapsing them would
 * mean a future member could not answer one way here and another way there.
 *
 * Pinned rather than inferred so a fourth Vault Meta Change fails to compile
 * until somebody says whether a Vault diverging that way is still the Vault
 * this device holds
 * ([ADR 0053](../../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
 */
export const VAULT_META_CHANGE_SAME_VAULT = {
  'different-vault': false,
  passphrase: true,
  'recovery-key': true,
} as const satisfies Record<VaultMetaChange, boolean>;

/**
 * What asking the server about an Unclaimed Local Vault established.
 *
 * Four outcomes, and no fewer. `no-evidence` and `postponed` are the pair that
 * must never be merged: the first is the server saying it holds no Vault Meta
 * for this User, the second is the server saying nothing at all.
 * `session-lost` is separated from both for the same reason Vault Meta
 * convergence separates it — a 401 or 403 is a Session that expired, and
 * reading it as "this User has no Vault Meta" would turn every expiry into a
 * decisive negative about somebody's Vault.
 */
export type VaultClaimEvidence =
  /**
   * The server holds this User's Vault Meta and it points at the Unclaimed
   * Local Vault on this device. Only the authenticated User could have written
   * it, so the Vault is theirs.
   */
  | { kind: 'server-meta-match'; serverMeta: ServerVaultMeta }
  /**
   * The server holds this User's Vault Meta and it points at a different
   * Vault. A decisive negative: the User owns a Vault, and it is not this one.
   */
  | { kind: 'server-meta-mismatch' }
  /**
   * The server holds no Vault Meta for this User, so it has nothing to say
   * about this Vault either way. A recovery key is the remaining proof.
   */
  | { kind: 'no-evidence' }
  /** No answer reached this device. Ask again with a connection. */
  | { kind: 'postponed' }
  /** The Session is gone. Not an absence, and not a negative. */
  | { kind: 'session-lost' };

/**
 * Ask the server whether its Vault Meta for the signed-in User points at this
 * Unclaimed Local Vault.
 *
 * Structurally read-only: it takes `getVaultMeta` and nothing else, so no
 * answer given to it can write anything anywhere — locally or on the server.
 * The claim that follows a match is `claimUnclaimedLocalVaultOnEvidence`,
 * above the primitive rather than inside it, exactly as `settleVaultMeta`
 * composes `convergeVaultMeta`.
 */
export async function checkVaultClaimEvidence(options: {
  api: Pick<VaultApi, 'getVaultMeta'>;
  unclaimedVault: VaultStorageV1;
}): Promise<VaultClaimEvidence> {
  let serverMeta: ServerVaultMeta | null;
  try {
    serverMeta = await getServerVaultMeta(options.api);
  } catch (error) {
    const status = getHttpStatus(error);
    if (status === 401 || status === 403) {
      return { kind: 'session-lost' };
    }
    // Everything else — a network that dropped, a 500, a gateway that timed
    // out — is the server not answering. It is never rethrown and never read
    // as an absence: an exception escaping here would land on a caller with no
    // way to tell "nothing was written" from "something was", and an absence
    // would hand the check's own off-switch to whoever can drop the network.
    return { kind: 'postponed' };
  }

  if (!serverMeta) {
    return { kind: 'no-evidence' };
  }

  let divergence: ReturnType<typeof describeVaultMetaDivergence>;
  try {
    divergence = describeVaultMetaDivergence({
      local: localToServerMeta(options.unclaimedVault),
      remote: serverMeta.meta,
    });
  } catch {
    // A Vault Meta this device cannot read — a wrapping at a version it does
    // not know — is an answer it did not get, not an answer that said no. It
    // postpones for the same reason a dropped connection does.
    return { kind: 'postponed' };
  }

  const pointsAtThisVault =
    divergence.kind === 'none' ||
    VAULT_META_CHANGE_SAME_VAULT[divergence.change];

  return pointsAtThisVault
    ? { kind: 'server-meta-match', serverMeta }
    : { kind: 'server-meta-mismatch' };
}

/**
 * What claiming on evidence did, or why it did nothing.
 *
 * Every kind other than `claimed` left this device byte-identical. That is a
 * property of the whole union rather than of the outcomes that mention it: the
 * single write in this module happens after a match and nowhere else.
 */
export type VaultClaimOnEvidenceResult =
  /**
   * The Unclaimed Local Vault is now this User's owned record. It is still
   * locked and no Master Key is bound — ownership was recorded, not unlocked.
   */
  | { kind: 'claimed' }
  /**
   * The server's Vault Meta named a different Vault. Nothing was written and
   * nothing is offered to the User on the strength of it.
   */
  | { kind: 'refused-not-this-vault' }
  /** The server holds no Vault Meta, so it proved nothing either way. */
  | { kind: 'no-evidence' }
  /** No answer from the server. Nothing written; ask again with a connection. */
  | { kind: 'postponed' }
  | { kind: 'session-lost' }
  /**
   * This User already holds a Local Vault of their own on this device.
   * Claiming would replace it, and a replacement is an explicit, acknowledged
   * act rather than something evidence alone carries out (CONTEXT.md, "Vault
   * Claim"). The server is not even asked: there is no answer it could give
   * that would make this the moment to overwrite a User's Vault.
   */
  | { kind: 'skipped-already-owned' }
  /** This User has no Unclaimed Local Vault to claim on this device. */
  | { kind: 'skipped-nothing-to-claim' };

/**
 * Claim the Unclaimed Local Vault on this device for `handle`'s owner, if the
 * server's Vault Meta proves it is theirs.
 *
 * Asks the User for nothing and leaves the Vault locked. The Master Key is not
 * bound, not derived, and not needed: recording who a Vault belongs to is a
 * different act from being able to read it, and the User unlocks afterwards in
 * the ordinary way.
 */
export async function claimUnclaimedLocalVaultOnEvidence(options: {
  // One method, and no way to write. See `checkVaultClaimEvidence`.
  api: Pick<VaultApi, 'getVaultMeta'>;
  handle: VaultHandle;
}): Promise<VaultClaimOnEvidenceResult> {
  const { handle } = options;

  const status = handle.vaultStatus();
  if (status === 'owned') {
    return { kind: 'skipped-already-owned' };
  }
  // Anything else that is not `unclaimed` — no entry at all, or an entry under
  // this User's key naming somebody else — leaves this owner with nothing this
  // function could claim for them.
  if (status !== 'unclaimed') {
    return { kind: 'skipped-nothing-to-claim' };
  }

  // `unclaimed` is exactly the state in which the Local Vault this owner
  // resolves *is* the Unclaimed Local Vault: their own entry wins whenever
  // they have one, and they do not.
  const unclaimedVault = handle.loadVault();
  if (!unclaimedVault) {
    return { kind: 'skipped-nothing-to-claim' };
  }

  const evidence = await checkVaultClaimEvidence({
    api: options.api,
    unclaimedVault,
  });

  switch (evidence.kind) {
    case 'server-meta-match':
      handle.claimUnclaimedLocalVaultLocked();
      return { kind: 'claimed' };
    case 'server-meta-mismatch':
      return { kind: 'refused-not-this-vault' };
    case 'no-evidence':
      return { kind: 'no-evidence' };
    case 'postponed':
      return { kind: 'postponed' };
    case 'session-lost':
      return { kind: 'session-lost' };
  }
}
