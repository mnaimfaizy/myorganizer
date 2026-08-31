/**
 * What the Vault Gate shows once Vault Claim Evidence has settled.
 *
 * Two of the outcomes resolve to an ordinary vault status and the gate carries
 * on as it always did — a claimed Vault is a Vault the User unlocks, and a
 * Vault nothing proved theirs is, to them, a device that holds no Vault
 * (CONTEXT.md, "Unclaimed Local Vault"). The third is the one that has no
 * ordinary status to fall back to: when no answer arrived, the gate must offer
 * nothing at all rather than pick whichever status looks harmless, because
 * both of them are wrong. Sending the User to the unlock screen would offer a
 * Vault that is not theirs; sending them to the setup screen would invite them
 * to create a Vault of their own over a dropped connection, and their own
 * entry then wins forever after.
 *
 * Pinned rather than switched on, so a new Vault Claim Evidence outcome fails
 * to compile until somebody says what the User sees for it
 * ([ADR 0053](../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
 */
import type { VaultClaimOnEvidenceResult } from '@myorganizer/web-vault';

export type VaultClaimEvidenceGateView =
  /** Carry on as this vault status. */
  | { kind: 'vault-status'; status: 'owned' | 'absent' }
  /**
   * No answer about this device's Vault. Nothing is offered and nothing is
   * written — the Unclaimed Local Vault stays exactly where it is.
   */
  | { kind: 'cannot-check'; title: string; description: string };

export const VAULT_CLAIM_EVIDENCE_GATE_VIEWS = {
  /**
   * Ownership was recorded and the Vault is still locked, so the User meets
   * the ordinary unlock screen. Claiming is not unlocking.
   */
  claimed: { kind: 'vault-status', status: 'owned' },
  /**
   * They already had a Vault of their own here; nothing changed. The gate does
   * not reach this view in practice — it consults the table only while the
   * status is `unclaimed`, which is exactly when this outcome cannot happen —
   * but the answer is still stated rather than left out, because a table with
   * a hole in it is a table that stops failing to compile when a hole matters.
   */
  'skipped-already-owned': { kind: 'vault-status', status: 'owned' },
  /**
   * The server named a different Vault. A decisive negative, and nothing is
   * offered on the strength of it: the Vault on this device is not offered,
   * not unlockable, and not guessable at.
   */
  'refused-not-this-vault': { kind: 'vault-status', status: 'absent' },
  /**
   * The server holds no Vault Meta for this User, so it proved nothing. A
   * recovery key is the remaining proof, and until that path exists this is a
   * device that holds no Vault for them: "a User who cannot produce evidence
   * for it sees a device that holds no Vault" (CONTEXT.md, "Unclaimed Local
   * Vault").
   *
   * A User who then creates a Vault of their own has not lost the Unclaimed
   * Local Vault — creation lands in their own entry and leaves the unsuffixed
   * slot byte-identical (ADR 0033). What it does mean is that claiming it
   * afterwards would replace a Vault they own, so it stops being something
   * evidence alone carries out and becomes the explicit, acknowledged act
   * CONTEXT.md's "Vault Claim" describes.
   */
  'no-evidence': { kind: 'vault-status', status: 'absent' },
  /** Nothing here to claim for this User in the first place. */
  'skipped-nothing-to-claim': { kind: 'vault-status', status: 'absent' },
  // The copy below deliberately says nothing about what this device holds.
  // Setting up your vault needs the server either way, so a User whose device
  // holds an Unclaimed Local Vault reads the same words as one whose device
  // holds nothing — the Claim Offer discloses nothing about what is here
  // (CONTEXT.md, "Claim Offer"). Naming the vault we were checking would
  // announce its presence to whoever is signed in.
  postponed: {
    kind: 'cannot-check',
    title: 'We could not reach the server',
    description:
      'Setting up your vault on this device needs the server, and we could not reach it. Nothing here was changed, and we will try again when you are back online.',
  },
  'session-lost': {
    kind: 'cannot-check',
    title: 'Please sign in again',
    description:
      'Your session ended before we could finish setting up your vault on this device. Nothing here was changed.',
  },
} as const satisfies Record<
  VaultClaimOnEvidenceResult['kind'],
  VaultClaimEvidenceGateView
>;
