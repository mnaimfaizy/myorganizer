/**
 * Owner-bound access to a pending Recovery Key Acknowledgment — the comparison
 * that decides whether this device's current recovery wrapping is one nobody
 * is known to hold.
 *
 * Derived, never flagged. The answer is produced by hashing the current
 * `masterKeyWrappedWithRecoveryKey` and comparing that hash to what this owner
 * recorded as unacknowledged, in exactly the way `createVaultMetaRefusalAccess`
 * derives a refusal rather than reading a stored boolean
 * ([ADR 0066](../../../../../docs/adr/0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md),
 * restated over minting in
 * [ADR 0069](../../../../../docs/adr/0069-a-recovery-key-is-acknowledged-and-only-the-acknowledgment-is-stored.md)).
 * A boolean here is the defect this module exists to close: it records that a
 * User was shown *something*, so a wrapping this device no longer holds still
 * accuses the Vault it now holds.
 */

import type { EncryptedBlob } from './localVaultStorage';
import { hashCiphertext } from './syncBookmarkAccess';
import {
  readRecoveryKeyAcknowledgment,
  removeRecoveryKeyAcknowledgment,
  writeRecoveryKeyAcknowledgment,
} from './recoveryKeyAcknowledgmentStorage';

export type RecoveryKeyAcknowledgmentAccess = {
  /**
   * Whether this owner still owes an Acknowledgment for `wrapping` — answered
   * by which wrapping was minted rather than by whether minting happened.
   *
   * `false` whenever nothing readable says otherwise, including when storage
   * itself refuses to answer, and including when a record exists for a
   * wrapping that is not this one. That is what makes a lost record, or a
   * wrapping that has since moved, cost a reminder that is not shown and
   * nothing else.
   */
  isUnacknowledged(wrapping: EncryptedBlob): Promise<boolean>;
  /**
   * Record that this owner minted `wrapping` and has not acknowledged it.
   *
   * Writes the fingerprint of the wrapping and never the Recovery Key. A
   * remount can therefore know an Acknowledgment is owed and cannot re-show
   * the key (CONTEXT.md, "Recovery Key Acknowledgment").
   */
  record(wrapping: EncryptedBlob): Promise<void>;
  /**
   * The User states they have recorded the Recovery Key. Clears the pending
   * record. The product cannot verify that claim, which is why the UI that
   * calls this after a remount confirms first.
   */
  acknowledge(): void;
  /**
   * Forget the pending Acknowledgment this owner holds. Same write as
   * `acknowledge`, called from Explicit Local Vault removal rather than from
   * a User's confirmation — a record about a Vault this device no longer
   * holds is stale by construction.
   */
  remove(): void;
};

/**
 * Let a record that storage will not deal with go, rather than surfacing it.
 *
 * The caller is a User who has just created a Vault, or just remounted one.
 * The worst a record this device cannot read or write can do is skip a
 * reminder, while an exception raised out of create or unlock fails the whole
 * flow. Storage throws for real reasons a User cannot act on — a full quota,
 * a browser refusing `localStorage` outright — so this is not a hypothetical
 * branch.
 *
 * `fallback` is what a record nobody could consult amounts to: not owed,
 * therefore do not remind.
 */
function ignoringStorageFailure<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/** Recovery Key Acknowledgment access bound to one owner. */
export function createRecoveryKeyAcknowledgmentAccess(
  owner: string,
): RecoveryKeyAcknowledgmentAccess {
  return {
    async isUnacknowledged(wrapping) {
      try {
        const offeredHash = await hashCiphertext(wrapping);
        const record = ignoringStorageFailure(
          () => readRecoveryKeyAcknowledgment(owner),
          undefined,
        );

        return record?.wrappingHash === offeredHash;
      } catch {
        return false;
      }
    },

    async record(wrapping) {
      try {
        const wrappingHash = await hashCiphertext(wrapping);
        ignoringStorageFailure(
          () => writeRecoveryKeyAcknowledgment({ owner, wrappingHash }),
          undefined,
        );
      } catch {
        // Hashing or storage failed: skip the reminder rather than fail
        // minting. Losing a record costs a reminder that is not shown, never
        // a Vault that will not unlock (ADR 0069).
      }
    },

    acknowledge() {
      ignoringStorageFailure(
        () => removeRecoveryKeyAcknowledgment(owner),
        undefined,
      );
    },

    remove() {
      ignoringStorageFailure(
        () => removeRecoveryKeyAcknowledgment(owner),
        undefined,
      );
    },
  };
}
