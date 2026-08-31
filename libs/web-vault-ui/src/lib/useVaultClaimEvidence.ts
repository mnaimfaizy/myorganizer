'use client';

/**
 * Run Vault Claim Evidence for the signed-in User, once per owner.
 *
 * The check asks the User for nothing, so it belongs in an effect rather than
 * behind a button: a device that can already prove the Unclaimed Local Vault
 * is theirs should claim it the moment it can, because the Vault is at risk
 * precisely while it is unclaimed.
 *
 * A postponement is deliberately never remembered. Nothing was written, so
 * there is nothing to be consistent with — the question is simply asked again
 * on the next mount, and immediately when the browser reports a connection.
 * Remembering it would be the bug the outcome exists to prevent: a User who
 * was offline once would stay unable to reach their own Vault, and a User who
 * could force the failure would have turned the strong check off for good.
 * The `online` listener is the fast path rather than the only one, which is
 * why a postponement from a server error — where the connection never
 * dropped — is still re-asked the next time the gate renders.
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

/** Nobody is signed in, so there is no owner to claim a Vault for. */
const NOTHING_TO_CLAIM: VaultClaimEvidenceState = {
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

    const retryWhenOnline = () => {
      if (cancelled || lastKind !== 'postponed') return;
      lastKind = null;
      setAnswered({ owner, state: CHECKING });
      ask();
    };

    window.addEventListener('online', retryWhenOnline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', retryWhenOnline);
    };
  }, [owner]);

  if (!owner) return NOTHING_TO_CLAIM;

  // An answer about somebody else is not an answer about this User.
  return answered.owner === owner ? answered.state : CHECKING;
}
