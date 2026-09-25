'use client';

/**
 * Run Vault Claim Evidence for the signed-in User, once per owner.
 *
 * Called from `VaultSessionProvider` and nowhere else, so "once per owner" is
 * literal: the answer lives on the Vault Session and is read by `VaultGate`
 * and `VaultReconcileRunner` alike. It used to run inside every gate, which
 * asked the server once per page and — the reason it moved — left the
 * reconcile runner in the layout unable to see it at all. Reconcile read an
 * `unclaimed` device as absent and downloaded the server's wrapping ahead of
 * the claim this check was about to make
 * ([#673](https://github.com/mnaimfaizy/myorganizer/issues/673); ADR 0066's
 * amendment). Now it waits on this.
 *
 * The check asks the User for nothing, so it belongs in an effect rather than
 * behind a button: a device that can already prove the Unclaimed Local Vault
 * is theirs should claim it the moment it can, because the Vault is at risk
 * precisely while it is unclaimed.
 *
 * A postponement is deliberately never remembered. Nothing was written, so
 * there is nothing to be consistent with — the question is simply asked again
 * at the next sign-in, when the browser reports a connection, and when the
 * tab regains focus. Remembering it would be the bug the outcome exists to
 * prevent: a User who was offline once would stay unable to reach their own
 * Vault, and a User who could force the failure would have turned the strong
 * check off for good. Focus is the trigger `VaultMetaConvergeRunner` already
 * uses for a remote event with no local signal, and it is what re-asks a
 * postponement from a server error, where the connection never dropped;
 * there is no gate re-render in the session to do it. Only a postponement is
 * re-asked: every other outcome is an answer, and the recovery-key Claim
 * Offer is the way to change one. A lost Session is not re-asked at all — a
 * new sign-in is a new owner and a fresh question. Neither trigger is a
 * prompt, so nothing here is rationed (ADR 0066, decision point 1).
 *
 * Every answer is stored against the owner it was asked for, and "no answer
 * yet" is derived from that rather than written. A new User signing into the
 * same tab is therefore back to `checking` in the same render that changes the
 * handle, instead of one render where they are shown the previous User's
 * answer as their own.
 */
import { useEffect, useRef, useState } from 'react';

import {
  claimUnclaimedLocalVaultOnEvidence,
  createVaultApi,
  type VaultClaimOnEvidenceResult,
  type VaultHandle,
} from '@myorganizer/web-vault';

export type VaultClaimEvidenceState =
  /** The question is out. Nothing is offered while it is. */
  | { status: 'checking' }
  | { status: 'settled'; result: VaultClaimOnEvidenceResult };

const CHECKING: VaultClaimEvidenceState = { status: 'checking' };

/**
 * Nobody is signed in, so there is no owner to claim a Vault for.
 *
 * Exported so a reader outside a Vault Session — `VaultGate` rendered without
 * a provider — gives the same answer this hook gives for no owner, rather than
 * a second constant spelling the same fact.
 */
export const CLAIM_EVIDENCE_WITHOUT_OWNER: VaultClaimEvidenceState = {
  status: 'settled',
  result: { kind: 'skipped-nothing-to-claim' },
};

/** An answer, and the owner it is an answer about. */
type AnsweredFor = {
  owner: string | null;
  state: VaultClaimEvidenceState;
};

export function useVaultClaimEvidence(
  handle: VaultHandle | null,
): VaultClaimEvidenceState {
  const owner = handle?.owner ?? null;
  const [answered, setAnswered] = useState<AnsweredFor>({
    owner: null,
    state: CHECKING,
  });

  // Keeps the effect below keyed on the owner alone, so a lock or unlock —
  // which changes the handle's identity but not whose Vault it is — never
  // re-runs a check that already answered. Same pattern as
  // `metaConvergeRunner`.
  const handleRef = useRef(handle);
  useEffect(() => {
    handleRef.current = handle;
  }, [handle]);

  useEffect(() => {
    const currentHandle = handleRef.current;
    if (!owner || !currentHandle) return;

    let cancelled = false;
    // Closure-local rather than a ref: it exists only to tell the `online`
    // listener whether there is a postponement to retry, and it belongs to
    // this owner's run in the same way the listener does.
    let lastKind: VaultClaimOnEvidenceResult['kind'] | null = null;

    const record = (result: VaultClaimOnEvidenceResult) => {
      if (cancelled) return;
      lastKind = result.kind;
      setAnswered({ owner, state: { status: 'settled', result } });
    };

    const ask = () => {
      claimUnclaimedLocalVaultOnEvidence({
        api: createVaultApi(),
        handle: currentHandle,
      })
        .then(record)
        // A server that did not answer is already `postponed` by the time it
        // gets here, so anything thrown is a defect rather than a network
        // condition. It settles as a postponement all the same: that is the
        // outcome that offers nothing, writes nothing, and asks again.
        .catch(() => record({ kind: 'postponed' }));
    };

    ask();

    // A pending ask is never doubled: `lastKind` is cleared when one goes
    // out, so a focus event landing while the online retry is still in
    // flight finds nothing to retry.
    const retryIfPostponed = () => {
      if (cancelled || lastKind !== 'postponed') return;
      lastKind = null;
      setAnswered({ owner, state: CHECKING });
      ask();
    };

    window.addEventListener('online', retryIfPostponed);
    window.addEventListener('focus', retryIfPostponed);

    return () => {
      cancelled = true;
      window.removeEventListener('online', retryIfPostponed);
      window.removeEventListener('focus', retryIfPostponed);
    };
  }, [owner]);

  if (!owner) return CLAIM_EVIDENCE_WITHOUT_OWNER;

  // An answer about somebody else is not an answer about this User.
  return answered.owner === owner ? answered.state : CHECKING;
}
