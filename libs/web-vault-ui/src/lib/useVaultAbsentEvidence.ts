'use client';

/**
 * Run Vault Absent Evidence for the signed-in User, once per owner, while
 * this device holds no Local Vault at all.
 *
 * Mirrors `useVaultClaimEvidence`'s shape for the reasons that hook already
 * documents: the question is asked from an effect rather than behind a
 * button, a postponement is deliberately never remembered — asked again on
 * the next mount and immediately when the browser reports a connection — and
 * an answer about a previous owner is never shown as this owner's.
 *
 * Gated on `absent` internally so the check costs nothing for a User this
 * device already holds a Vault or an Unclaimed Local Vault for: reading
 * `vaultStatus()` is free, and only `absent` has a create offer that needs
 * withholding.
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

const CHECKING: VaultAbsentEvidenceState = { status: 'checking' };

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
  }, [owner, status]);

  if (!owner || status !== 'absent') return CHECKING;

  // An answer about somebody else, or about a device that has since stopped
  // being absent, is not an answer about this render.
  return answered.owner === owner ? answered.state : CHECKING;
}
