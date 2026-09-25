/**
 * Owner-bound access to Vault Meta Refusals — the comparison that decides
 * whether a divergence is one this device has already refused.
 *
 * Derived, never flagged. The answer is produced by hashing the Vault Meta
 * being offered and comparing that hash to what this owner refused, in exactly
 * the way `SyncBookmarkAccess` derives dirtiness rather than reading a stored
 * boolean (ADR 0058, restated over prompts in
 * [ADR 0066](../../../../../docs/adr/0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md)).
 * A boolean here is the defect this module exists to close: it records that a
 * User was asked *something*, so a second and genuinely different wrapping
 * change never gets asked about at all.
 */

import type { VaultMetaV1 } from '@myorganizer/app-api-client';

import { hashVaultMeta } from './syncBookmarkAccess';
import type { VaultMetaChange } from './vaultMetaConverge';
import {
  VAULT_META_REFUSAL_LIFETIMES,
  readVaultMetaRefusal,
  removeVaultMetaRefusals,
  writeVaultMetaRefusal,
  type VaultMetaRefusalLifetime,
} from './vaultMetaRefusalStorage';

export type { VaultMetaRefusalLifetime };

/**
 * One question about a Vault Meta: which wrapping was offered, and which change
 * in it the User was asked about.
 *
 * Both halves are needed to tell one question from another. The meta alone
 * cannot: an unmoved server asks a different question once this device's own
 * wrapping moves, because divergence is named by the first facet that differs.
 */
export type VaultMetaQuestion = {
  meta: VaultMetaV1;
  change: VaultMetaChange;
};

export type VaultMetaRefusalAccess = {
  /**
   * Whether this owner has already declined this question, under either
   * lifetime — answered by what was asked rather than by whether asking
   * happened.
   *
   * `false` whenever nothing readable says otherwise, including when storage
   * itself refuses to answer. That is what makes a lost or unreadable refusal
   * cost a repeated question and nothing else.
   */
  isRefused(question: VaultMetaQuestion): Promise<boolean>;
  /**
   * Record that this owner declined this question.
   *
   * `durable` for an answer — "keep my current passphrase" holds until the
   * wrapping changes again. `session` for a dismissal — "not now" holds until
   * the tab closes. Neither writes anything to the Vault: both sides are left
   * exactly as they were (ADR 0057, and its amendment on why a dismissal now
   * records anything at all).
   */
  record(
    options: VaultMetaQuestion & { lifetime: VaultMetaRefusalLifetime },
  ): Promise<void>;
  /** Forget every refusal this owner holds, of either lifetime. */
  removeRefusals(): void;
};

/**
 * Let a refusal that storage will not deal with go, rather than surfacing it.
 *
 * The caller is a User who has just been asked, or just answered, a dialog. The
 * worst a refusal this device cannot read or write can do is ask them again,
 * while an exception raised out of the prompt fails the whole convergence pass
 * and toasts an error about bookkeeping. Storage throws for real reasons a User
 * cannot act on — a full quota, a browser refusing `localStorage` outright — so
 * this is not a hypothetical branch.
 *
 * `fallback` is what a refusal nobody could consult amounts to: not refused,
 * therefore ask.
 */
function ignoringStorageFailure<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/** Vault Meta Refusal access bound to one owner. */
export function createVaultMetaRefusalAccess(
  owner: string,
): VaultMetaRefusalAccess {
  return {
    async isRefused({ meta, change }) {
      const offeredHash = await hashVaultMeta(meta);

      return VAULT_META_REFUSAL_LIFETIMES.some((lifetime) => {
        const refusal = ignoringStorageFailure(
          () => readVaultMetaRefusal({ owner, lifetime }),
          undefined,
        );

        return refusal?.metaHash === offeredHash && refusal.change === change;
      });
    },

    async record({ meta, change, lifetime }) {
      const entry = { metaHash: await hashVaultMeta(meta), change };
      ignoringStorageFailure(
        () => writeVaultMetaRefusal({ owner, lifetime, entry }),
        undefined,
      );
    },

    removeRefusals() {
      ignoringStorageFailure(() => removeVaultMetaRefusals(owner), undefined);
    },
  };
}
