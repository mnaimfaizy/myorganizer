/**
 * What importing an Escape Copy changes about *opening* this Vault.
 *
 * Import replaces every Vault Blob and both Master Key wrappings, so the
 * confirmation owes the User an account of what it will destroy. A fixed
 * warning cannot give one: written for the worst case it cries wolf on the
 * common one, and restoring your own recent backup is the ordinary reason to
 * use this feature. A blanket credential warning trains people to click past
 * the sentence that matters (ADR 0068, decision point 5).
 *
 * An Escape Copy carries its own Vault Meta, so the answer is derivable at the
 * moment the dialog is shown rather than written once at authoring time. This
 * module derives it and nothing else: it takes two Vault Metas and returns
 * what moved. It reads no storage, writes none, and needs no Master Key —
 * the same property that lets a locked device keep converging lets a locked
 * device be told the truth here.
 */
import { VaultMetaV1 } from '@myorganizer/app-api-client';

import {
  describeVaultMetaDivergence,
  type VaultMetaChange,
} from './vaultMetaConverge';

/**
 * The wrapping moves that leave the Vault Identity intact — a credential
 * changed on this Vault, not a different Vault.
 *
 * Named as its own type rather than inlined so the middle outcome can say
 * *which* credential reverts. "Your passphrase reverts" is wrong when only the
 * Recovery Key wrapping moved, and a warning that names the wrong secret is
 * the same failure as one that cries wolf.
 */
export type VaultImportWrappingChange = Exclude<
  VaultMetaChange,
  'different-vault'
>;

/**
 * Which of three things importing this bundle will do to the User's
 * credentials.
 *
 * The middle member is the one to guard. A changed passphrase re-derives from
 * the salt the Vault already holds, so it reuses the Vault Identity and
 * identity alone cannot separate "same Vault, older wrapping" from "different
 * Vault". Collapsing the two is the easy implementation and recreates exactly
 * the cry-wolf warning this design exists to remove.
 */
export type VaultImportCredentialOutcome =
  /** The bundle's Vault Meta is this device's Vault Meta. Nothing about opening the Vault changes, and the User is told nothing about credentials. */
  | { kind: 'unchanged' }
  /** The same Vault, wrapped as it was when the backup was made. That wrapping starts working again and the current one stops. */
  | { kind: 'wrapping-reverts'; change: VaultImportWrappingChange }
  /** A different Vault. Its passphrase and Recovery Key replace this device's, and this device stops holding the Vault the server has. */
  | { kind: 'different-vault' };

/**
 * The outcome each Vault Meta Change produces on import, pinned per member
 * ([ADR 0053](../../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
 *
 * Pinned rather than inferred from `VAULT_META_CHANGE_ADOPTABLE`, even though
 * the two agree today, because they answer different questions: adoptability
 * asks whether this device may take the server's wrapping over its own
 * Ciphertext, and this asks what the User is about to be told. A fourth Vault
 * Meta Change fails to compile here until somebody says which of the three
 * sentences it earns — which is the whole point, since four card authors
 * already decided this kind of thing independently once.
 */
const OUTCOME_FOR_META_CHANGE = {
  'different-vault': { kind: 'different-vault' },
  passphrase: { kind: 'wrapping-reverts', change: 'passphrase' },
  'recovery-key': { kind: 'wrapping-reverts', change: 'recovery-key' },
} as const satisfies Record<VaultMetaChange, VaultImportCredentialOutcome>;

/**
 * Compare an Escape Copy's Vault Meta against this device's and name what
 * importing it does to the User's credentials.
 *
 * The Vault Identity classification is reused rather than written a second
 * time: `describeVaultMetaDivergence` already reads `different-vault` before
 * either wrapping and first match wins, so a bundle from a separately
 * initialized Vault can never be reported as a passphrase change here — the
 * misreading that #578 was.
 */
export function classifyVaultImportCredentialOutcome(options: {
  /** This device's current Vault Meta. */
  local: VaultMetaV1;
  /** The Vault Meta carried by the Escape Copy about to be imported. */
  bundle: VaultMetaV1;
}): VaultImportCredentialOutcome {
  const divergence = describeVaultMetaDivergence({
    local: options.local,
    remote: options.bundle,
  });

  return divergence.kind === 'none'
    ? { kind: 'unchanged' }
    : OUTCOME_FOR_META_CHANGE[divergence.change];
}
