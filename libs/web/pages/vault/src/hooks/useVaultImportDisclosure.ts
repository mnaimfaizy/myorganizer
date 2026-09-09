'use client';

import { useEffect, useState } from 'react';

import {
  classifyVaultImportCredentialOutcome,
  localToServerMeta,
  parseVaultExportEnvelope,
  type VaultImportCredentialOutcome,
} from '@myorganizer/web-vault';

import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';

export type VaultImportDisclosureState =
  /** The bundle has not been read yet. Nothing about credentials may be shown. */
  | { status: 'pending'; outcome: null }
  | { status: 'loaded'; outcome: VaultImportCredentialOutcome }
  /**
   * The file is not a readable Escape Copy, so what it changes cannot be
   * derived. Not an error path for the User to act on — `importVault` runs the
   * same parse and reports the real failure — but the confirmation must not
   * claim "nothing changes" about a bundle it could not read.
   */
  | { status: 'unreadable'; outcome: null };

const PENDING: VaultImportDisclosureState = {
  status: 'pending',
  outcome: null,
};
const UNREADABLE: VaultImportDisclosureState = {
  status: 'unreadable',
  outcome: null,
};

/**
 * Which of three things importing `file` will do to the User's credentials —
 * what the import confirmation says instead of one warning written for the
 * worst case (ADR 0068, decision point 5).
 *
 * Reading a bundle is asynchronous, so this returns `pending` first and the
 * dialog renders that rather than a guess: showing "nothing changes" for a
 * moment and then correcting it is the one failure worse than the fixed
 * warning, because it is the reassuring answer that flashes.
 *
 * Recomputed every time `active` becomes true (the confirmation dialog's own
 * `open` state) or the chosen file changes, so the answer belongs to the
 * bundle actually about to be imported. The comparison reads Vault Meta only
 * — key-derivation parameters and two wrappings — so it needs no Master Key
 * and is correct while the Vault is locked.
 */
export function useVaultImportDisclosure(
  file: File | null,
  active: boolean,
): VaultImportDisclosureState {
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;

  const [state, setState] = useState<VaultImportDisclosureState>(PENDING);

  useEffect(() => {
    if (!active || !handle || !file) {
      // Only update state if it would actually change — prevents cascading renders
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((prev) => (prev.status === 'pending' ? prev : PENDING));
      return;
    }

    let cancelled = false;
    setState(PENDING);

    void (async () => {
      try {
        const localVault = handle.loadVault();
        if (!localVault) {
          // No Local Vault means no credentials to replace: the replace
          // confirmation is not reached at all in that state, and if it ever
          // is, there is nothing to compare against.
          return cancelled ? undefined : setState(UNREADABLE);
        }

        const envelope = parseVaultExportEnvelope(await file.text());
        const outcome = classifyVaultImportCredentialOutcome({
          local: localToServerMeta(localVault),
          bundle: envelope.meta,
        });

        if (!cancelled) setState({ status: 'loaded', outcome });
      } catch {
        if (!cancelled) setState(UNREADABLE);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, file, handle]);

  return state;
}
