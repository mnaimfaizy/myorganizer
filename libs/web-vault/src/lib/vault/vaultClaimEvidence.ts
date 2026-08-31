/**
 * Vault Claim Evidence — what proves an Unclaimed Local Vault is the signed-in
 * User's, and the claim that follows when it does.
 *
 * Two kinds of evidence live here, and the order they appear in is the order
 * they are reached in. The first is the server's own Vault Meta: only the
 * authenticated User can have written it, so a Vault Meta that points at the
 * Unclaimed Local Vault on this device says the Vault is theirs, and says it
 * without asking the User for anything. That is the strongest evidence there
 * is and the path most Users take
 * ([ADR 0061](../../../../../docs/adr/0061-vault-claim-is-proven-by-evidence-not-by-unwrap.md)).
 *
 * The second is a recovery key, and it is what a User falls back to when the
 * server holds no Vault Meta to compare against. It is minted per Vault as
 * random bytes rather than chosen, so it cannot collide across Users the way a
 * passphrase can, and holding one is proof of ownership rather than proof of
 * knowing a string. Unlike the Vault Meta check it needs the User to act, so
 * it is a function they reach through a deliberate action rather than
 * something that runs on their behalf.
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

import {
  aesGcmDecrypt,
  base64ToBytes,
  importAesGcmKey,
  randomBytes,
} from './crypto';
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
   * This User already holds a Local Vault of their own on this device, and
   * this device holds no Unclaimed Local Vault at all. There is nothing to
   * check and nothing to offer, so the server is not even asked.
   */
  | { kind: 'skipped-already-owned' }
  /**
   * This User already holds a Local Vault of their own, *and* the server's
   * Vault Meta proves a separate Unclaimed Local Vault on this device is also
   * theirs. Claiming it would replace the Vault they already have, so nothing
   * is written here — replacing is an explicit, acknowledged act rather than
   * something evidence alone carries out (CONTEXT.md, "Vault Claim"). What
   * evidence established is offered to the User instead, through
   * `replaceOwnedLocalVaultOnEvidence`.
   */
  | { kind: 'replace-offer' }
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

  // Already owned is not automatically nothing to do: this device may
  // separately hold an Unclaimed Local Vault, and evidence can prove that one
  // is this User's too. It is checked here rather than skipped so the offer
  // to replace can be made — but only when there is something to check.
  // Reading it first, rather than asking the server unconditionally, is what
  // keeps this free for the ordinary owned User the hook's own docstring
  // promises it is: no server round trip for a device holding nothing else.
  if (status === 'owned') {
    const unclaimedVault = handle.loadUnclaimedVault();
    if (!unclaimedVault) {
      return { kind: 'skipped-already-owned' };
    }

    const evidence = await checkVaultClaimEvidence({
      api: options.api,
      unclaimedVault,
    });

    switch (evidence.kind) {
      case 'server-meta-match':
        // Evidence, not an instruction. Overwriting a Vault this User already
        // owns is never carried out on the strength of a server answer alone
        // — see `replaceOwnedLocalVaultOnEvidence`.
        return { kind: 'replace-offer' };
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

  // Anything else that is not `unclaimed` — no entry at all, or an entry under
  // this User's key naming somebody else — leaves this owner with nothing this
  // function could claim for them.
  if (status !== 'unclaimed') {
    return { kind: 'skipped-nothing-to-claim' };
  }

  // Read explicitly. `unclaimed` says the unsuffixed slot is occupied and
  // nothing more — this owner resolves no Vault at all until evidence says
  // otherwise, so there is no longer an implicit route to the one held here.
  const unclaimedVault = handle.loadUnclaimedVault();
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

/**
 * What replacing an owned Local Vault with the Unclaimed Local Vault did, or
 * why it did nothing.
 */
export type VaultClaimReplaceResult =
  /**
   * This owner's Local Vault is now the (formerly) Unclaimed Local Vault's
   * content, and locked — the server's Vault Meta proved ownership without
   * ever holding a secret, so there is nothing here to unlock with. The
   * Unclaimed Local Vault slot is left byte-identical (ADR 0033); the claim
   * copies rather than moves it.
   */
  | { kind: 'replaced' }
  /**
   * There is nothing here for this call to have replaced — this owner holds
   * no Local Vault, or this device holds no Unclaimed Local Vault to replace
   * it with. Nothing was written.
   */
  | { kind: 'skipped-nothing-to-replace' };

/**
 * Carry out a Vault Claim that replaces a Local Vault this owner already
 * holds, on the evidence `claimUnclaimedLocalVaultOnEvidence` already found.
 *
 * The explicit, acknowledged act CONTEXT.md's "Vault Claim" describes: this
 * function performs no evidence check of its own and asks the User nothing —
 * both already happened before a caller reaches it, the check by
 * `claimUnclaimedLocalVaultOnEvidence` returning `replace-offer` and the
 * acknowledgement by whatever the caller showed the User for it. Calling this
 * without either is a caller bug, not a case this function guards against
 * beyond refusing to write when there is nothing to replace.
 */
export function replaceOwnedLocalVaultOnEvidence(options: {
  handle: VaultHandle;
}): VaultClaimReplaceResult {
  const { handle } = options;

  if (handle.vaultStatus() !== 'owned' || !handle.loadUnclaimedVault()) {
    return { kind: 'skipped-nothing-to-replace' };
  }

  handle.replaceOwnedLocalVaultWithUnclaimedLocked();
  return { kind: 'replaced' };
}

/**
 * The IV and wrapped-Master-Key sizes a recovery key unwrap works over.
 *
 * Read off `initialize`, which wraps 32 Master Key bytes under a 12-byte IV;
 * AES-GCM appends its 16-byte authentication tag, so the wrapped blob is 48
 * bytes. They are named here because the decoy below has to be the same shape
 * as the real thing to cost the same as it.
 */
const RECOVERY_UNWRAP_IV_BYTES = 12;
const RECOVERY_UNWRAP_CIPHERTEXT_BYTES = 48;

/**
 * Do a recovery key unwrap's work against bytes that belong to no Vault.
 *
 * Named for what it costs rather than what it achieves, because it achieves
 * nothing on purpose and a reader who takes it for a no-op will delete it. It
 * is what makes "your key matched nothing here" cost what "there is nothing
 * here" costs: the import and the AES-GCM decrypt both happen, over an IV and
 * a wrapped blob of the sizes a real one has, and the failure is discarded.
 * Returning early instead would make a device holding an Unclaimed Local Vault
 * answer measurably slower than a device holding nothing, which is the single
 * bit this path exists to withhold.
 *
 * It equalises the crypto, which is the expensive half and the half a caller
 * can time. It does not claim constant time in the strict sense, and the
 * remaining difference is bounded by ADR 0061's scope boundary: anyone able to
 * measure a `JSON.parse` inside this browser can already read the Local Vault
 * out of storage directly, which that ADR puts out of scope for Vault Claim.
 *
 * Everything is swallowed, including a recovery key that is not decodable
 * base64 at all — the real path throws `VaultSecretMismatchError` for exactly
 * that input, so a caller that saw this one throw would have learnt something.
 */
/**
 * Whether `recoveryKey` unwraps `vault`'s recovery-wrapped Master Key.
 *
 * A pure check: it reads nothing beyond the `vault` it is given and writes
 * nothing regardless of the answer. Kept apart from
 * `handle.unlockWithRecoveryKey`, which unwraps-then-claims whatever the
 * slot resolves — that is never the Unclaimed Local Vault once this owner is
 * `owned`, so establishing evidence against it here needs its own unwrap
 * rather than that one's.
 */
async function recoveryKeyMatchesVault(options: {
  vault: VaultStorageV1;
  recoveryKey: string;
}): Promise<boolean> {
  try {
    const wrappingKey = await importAesGcmKey(
      base64ToBytes(options.recoveryKey),
    );
    await aesGcmDecrypt({
      key: wrappingKey,
      iv: base64ToBytes(options.vault.masterKeyWrappedWithRecoveryKey.iv),
      ciphertext: base64ToBytes(
        options.vault.masterKeyWrappedWithRecoveryKey.ciphertext,
      ),
    });
    return true;
  } catch {
    return false;
  }
}

async function decoyRecoveryUnwrap(recoveryKey: string): Promise<void> {
  try {
    const wrappingKey = await importAesGcmKey(base64ToBytes(recoveryKey));
    await aesGcmDecrypt({
      key: wrappingKey,
      iv: randomBytes(RECOVERY_UNWRAP_IV_BYTES),
      ciphertext: randomBytes(RECOVERY_UNWRAP_CIPHERTEXT_BYTES),
    });
  } catch {
    // Always, and deliberately. There is no Master Key here to recover; the
    // work is the point and the answer is discarded.
  }
}

/**
 * What claiming on a recovery key did.
 *
 * Three outcomes, and the missing fourth is the point. There is no outcome for
 * "wrong key" separate from "nothing here to claim": those two are one answer,
 * because a `no-match` a User can tell apart from an empty device is a "a
 * Vault is here" disclosure with extra steps.
 */
export type VaultClaimByRecoveryKeyResult =
  /**
   * The Unclaimed Local Vault is now this User's owned record, and unlocked.
   *
   * Unlocked because the evidence *is* the key: the Master Key was unwrapped
   * to establish the proof, so binding it asks the User for nothing further.
   * The Vault Meta path claims locked for the opposite reason — it proves
   * ownership without ever holding a secret, so there is nothing there to
   * unlock with.
   */
  | { kind: 'claimed'; masterKeyBytes: Uint8Array }
  /**
   * The recovery key opened nothing on this device. Says nothing about whether
   * there was anything here for it to open, and nothing was written either
   * way.
   */
  | { kind: 'no-match' }
  /**
   * This User already holds a Local Vault of their own here, and this device
   * holds no Unclaimed Local Vault at all — there is nothing the key could
   * have opened. Distinguishable from `no-match`, and allowed to be: it
   * discloses a Vault the User signed in to and already knows about, never
   * the Unclaimed Local Vault this path is blind about.
   */
  | { kind: 'skipped-already-owned' }
  /**
   * This User already holds a Local Vault of their own, *and* the key just
   * supplied opens the Unclaimed Local Vault on this device — proof it is
   * theirs too. Claiming it would replace the Vault they already have, so
   * nothing is written here: what the key proved is offered to the User
   * instead, through `replaceOwnedLocalVaultWithRecoveryKey`. Distinguishable
   * from `no-match` for the same reason `skipped-already-owned` is: this only
   * tells the signed-in User something about a Vault they already know they
   * hold, never about the Unclaimed Local Vault to anyone who is not.
   */
  | { kind: 'replace-offer' };

/**
 * Claim the Unclaimed Local Vault on this device for `handle`'s owner, on the
 * strength of a recovery key.
 *
 * The deliberate half of Vault Claim Evidence.
 * `claimUnclaimedLocalVaultOnEvidence` runs on the User's behalf and needs
 * nothing from them, so it can be asked on every mount; this one takes a
 * secret only the Vault's owner has, so it is reached when a User says they
 * hold one. A caller offers it whether or not there is anything here to claim
 * — asking first would answer the question this function refuses to.
 *
 * It takes a recovery key and no passphrase, and there is deliberately no
 * variant that takes one. A passphrase unwrap establishes knowledge of a
 * string rather than ownership of a Vault (ADR 0061); a recovery key is minted
 * per Vault and cannot collide, which is the whole reason one is proof and the
 * other is not.
 *
 * Every failure is one answer. A wrong key, an unreadable key, a device
 * holding nothing, storage that would not answer — all `no-match`, all leaving
 * this device byte-identical. Distinguishing them would hand back exactly the
 * bit that must not be handed back, and there is nothing a caller could do
 * with the difference that is worth that.
 */
export async function claimUnclaimedLocalVaultWithRecoveryKey(options: {
  handle: VaultHandle;
  recoveryKey: string;
}): Promise<VaultClaimByRecoveryKeyResult> {
  const { handle, recoveryKey } = options;

  const status = handle.vaultStatus();
  if (status === 'owned') {
    const unclaimedVault = handle.loadUnclaimedVault();
    if (!unclaimedVault) {
      // Nothing here for the key to open. Still pays the decoy's cost: the
      // signed-in User's own owned/unclaimed status is allowed to leak (see
      // the type's doc comment above), but whether this device separately
      // holds an Unclaimed Local Vault for somebody else is not, and skipping
      // the decoy here would make that device answer measurably faster.
      await decoyRecoveryUnwrap(recoveryKey);
      return { kind: 'skipped-already-owned' };
    }

    const matches = await recoveryKeyMatchesVault({
      vault: unclaimedVault,
      recoveryKey,
    });
    return matches ? { kind: 'replace-offer' } : { kind: 'no-match' };
  }

  if (status !== 'unclaimed') {
    // Nothing here to claim — an empty slot, or an entry naming somebody else.
    // Both halves of what the claim below would do still happen: the same reads
    // it makes, and an unwrap that runs against nothing. The reads are here
    // rather than omitted because `claimUnclaimedLocalVaultByRecoveryKey` reads
    // both slots before it unwraps, and an answer that skipped them would come
    // back sooner on a device holding nothing than on one holding a Vault.
    handle.loadVault();
    handle.loadUnclaimedVault();
    await decoyRecoveryUnwrap(recoveryKey);
    return { kind: 'no-match' };
  }

  try {
    // `claimUnclaimedLocalVaultByRecoveryKey` is the claim: it reads the
    // Unclaimed Local Vault explicitly, unwraps, and writes only after that
    // succeeds, so a wrong key leaves it byte-identical. It replaces the old
    // route through `unlockWithRecoveryKey`, which claimed as a side effect of
    // unlocking whatever the storage read happened to resolve — the implicit
    // resolution this design exists to delete. Unlocking can no longer reach an
    // Unclaimed Local Vault at all.
    const { masterKeyBytes } =
      await handle.claimUnclaimedLocalVaultByRecoveryKey({ recoveryKey });
    return { kind: 'claimed', masterKeyBytes };
  } catch {
    return { kind: 'no-match' };
  }
}

/**
 * What replacing an owned Local Vault with the Unclaimed Local Vault, by
 * recovery key, did.
 *
 * The recovery-key counterpart to `VaultClaimReplaceResult`. Two outcomes
 * rather than three for the same reason `VaultClaimByRecoveryKeyResult` has
 * two: a wrong key and nothing to replace with are both `no-match`, because
 * whether this device holds an Unclaimed Local Vault for somebody else is not
 * this caller's to learn from the difference.
 */
export type VaultClaimReplaceByRecoveryKeyResult =
  /**
   * This owner's Local Vault is now the (formerly) Unclaimed Local Vault's
   * content, and unlocked — the key that proved ownership unwrapped the
   * Master Key to do it, so there is nothing further to ask the User for.
   */
  | { kind: 'replaced'; masterKeyBytes: Uint8Array }
  /** Nothing was replaced. Nothing was written. */
  | { kind: 'no-match' };

/**
 * Carry out a Vault Claim by recovery key that replaces a Local Vault this
 * owner already holds, on the evidence `claimUnclaimedLocalVaultWithRecoveryKey`
 * already found.
 *
 * The recovery-key counterpart to `replaceOwnedLocalVaultOnEvidence`: this
 * function asks the User for nothing beyond the acknowledgement a caller
 * already obtained for the `replace-offer` it is reached after, and it
 * re-verifies the key rather than trusting a match established earlier —
 * `handle.replaceOwnedLocalVaultWithUnclaimedByRecoveryKey` unwraps before it
 * writes, so a key that stops matching between the offer and this call (or
 * one this function is called with when it should not have been) still
 * leaves both Vaults byte-identical.
 */
export async function replaceOwnedLocalVaultWithRecoveryKey(options: {
  handle: VaultHandle;
  recoveryKey: string;
}): Promise<VaultClaimReplaceByRecoveryKeyResult> {
  const { handle, recoveryKey } = options;

  if (handle.vaultStatus() !== 'owned' || !handle.loadUnclaimedVault()) {
    return { kind: 'no-match' };
  }

  try {
    const { masterKeyBytes } =
      await handle.replaceOwnedLocalVaultWithUnclaimedByRecoveryKey({
        recoveryKey,
      });
    return { kind: 'replaced', masterKeyBytes };
  } catch {
    return { kind: 'no-match' };
  }
}
