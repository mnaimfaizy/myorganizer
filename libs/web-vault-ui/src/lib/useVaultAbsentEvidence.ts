'use client';

/**
 * Run Vault Absent Evidence for the signed-in User, once per owner, while
 * this device holds no Local Vault at all.
 *
 * Mirrors `useVaultClaimEvidence`'s shape and placement for the reasons that
 * hook already documents: called from `VaultSessionProvider` and nowhere
 * else, asked from an effect rather than behind a button, a postponement
 * deliberately never remembered — asked again at the next sign-in, when the
 * browser reports a connection, and when the tab regains focus — and an
 * answer about a previous owner never shown as this owner's. It moved with
 * the claim check rather than for a defect of its own: leaving it in the gate
 * would have ownership proof read from the session and server-holds-a-Vault
 * proof read from a local hook, with nothing to explain the split.
 *
 * Gated on `absent` internally so the check costs nothing for a User this
 * device already holds a Vault or an Unclaimed Local Vault for: reading
 * `vaultStatus()` is free, and only `absent` has a create offer that needs
 * withholding. The status is read at render, so the caller must re-render
 * when the Local Vault is replaced — the provider subscribes to the Local
 * Vault Revision for exactly that.
 */
import { useEffect, useState } from 'react';

import {
  checkVaultAbsentEvidence,
  createVaultApi,
  type VaultAbsentEvidence,
  type VaultHandle,
} from '@myorganizer/web-vault';

export type VaultAbsentEvidenceState =
  /** The question is out. Nothing is offered while it is. */
  { status: 'checking' } | { status: 'settled'; result: VaultAbsentEvidence };

/**
 * Exported as the answer for a reader outside a Vault Session, for the reason
 * `CLAIM_EVIDENCE_WITHOUT_OWNER` gives: no owner means no question, and the
 * gate's `absent` branch withholds the create offer on `checking`.
 */
export const ABSENT_EVIDENCE_WITHOUT_OWNER: VaultAbsentEvidenceState = {
  status: 'checking',
};
const CHECKING = ABSENT_EVIDENCE_WITHOUT_OWNER;

/** An answer, and the owner it is an answer about. */
type AnsweredFor = {
  owner: string | null;
  state: VaultAbsentEvidenceState;
};

export function useVaultAbsentEvidence(
  handle: VaultHandle | null,
): VaultAbsentEvidenceState {
  const owner = handle?.owner ?? null;
  const status = handle?.vaultStatus() ?? null;
  const [answered, setAnswered] = useState<AnsweredFor>({
    owner: null,
    state: CHECKING,
  });

  useEffect(() => {
    if (!owner || status !== 'absent') return;

    let cancelled = false;
    // Closure-local rather than a ref, exactly as `useVaultClaimEvidence`
    // keeps its own: it exists only to tell the `online` listener whether
    // there is a postponement to retry.
    let lastKind: VaultAbsentEvidence['kind'] | null = null;

    const record = (result: VaultAbsentEvidence) => {
      if (cancelled) return;
      lastKind = result.kind;
      setAnswered({ owner, state: { status: 'settled', result } });
    };

    const ask = () => {
      checkVaultAbsentEvidence({ api: createVaultApi() })
        .then(record)
        // A server that did not answer is already `postponed` by the time it
        // gets here, so anything thrown is a defect rather than a network
        // condition. It settles as a postponement all the same: that is the
        // outcome that offers nothing and asks again.
        .catch(() => record({ kind: 'postponed' }));
    };

    ask();

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
  }, [owner, status]);

  if (!owner || status !== 'absent') return CHECKING;

  // An answer about somebody else, or about a device that has since stopped
  // being absent, is not an answer about this render.
  return answered.owner === owner ? answered.state : CHECKING;
}
