/**
 * Recovery Key Acknowledgment storage — one durable record per User.
 *
 * What is stored is the absence of an Acknowledgment: a fingerprint of the
 * recovery wrapping that was minted and never confirmed, and never the Recovery
 * Key itself (CONTEXT.md, "Recovery Key Acknowledgment"). The key is shown
 * once, kept by the User, and stored nowhere the product can reach. A remount
 * therefore knows an Acknowledgment is owed and cannot re-show the key.
 *
 * **Keyed by owner in the storage key, wrapping fingerprint in the value.**
 * The localStorage key is `myorganizer_recovery_key_acknowledgment_v1:<owner>`.
 * What it holds is a SHA-256 of `masterKeyWrappedWithRecoveryKey`, not a
 * boolean. A boolean per User would still be true after a claim, an import, a
 * replacement or a rotation moved the wrapping, and would need a hand-maintained
 * list of clear-points that rot. Hashing the wrapping is the same move a Vault
 * Meta Refusal makes with `{ metaHash, change }`
 * ([ADR 0066](../../../../../docs/adr/0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md)):
 * a wrapping this device no longer holds is not an answer about the Vault it
 * now holds, so staleness is structurally impossible.
 *
 * Failure direction matches its neighbours. Losing a record, or failing to
 * read one, costs a reminder that is not shown — never a User's data and never
 * a Vault that will not unlock — so a mis-keyed or corrupted entry is treated
 * as no record, exactly as in `vaultMetaRefusalStorage.ts` and
 * `syncBookmarkStorage.ts`. See ADR 0058 for that precedent.
 *
 * One lifetime, `localStorage` only. There is no "not now" dismissal of an
 * owed Acknowledgment, so there is no `sessionStorage` half to keep in step.
 */

/** The storage key prefix every per-User Recovery Key Acknowledgment key is built from. */
export const RECOVERY_KEY_ACKNOWLEDGMENT_STORAGE_KEY =
  'myorganizer_recovery_key_acknowledgment_v1';

/** Record version written for a pending Recovery Key Acknowledgment. */
export const RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION = 1;

/**
 * One User's pending Recovery Key Acknowledgment.
 *
 * One wrapping hash and not a list. The question being remembered is "does
 * anyone hold the Recovery Key for *this* wrapping?", so what has to be
 * remembered is the wrapping that was minted and never acknowledged. A wrapping
 * that is not it is a different Vault (or a rotated one) and is not owed.
 */
export type RecoveryKeyAcknowledgmentRecord = {
  version: 1;
  owner: string;
  /** SHA-256 hex digest of `masterKeyWrappedWithRecoveryKey`. */
  wrappingHash: string;
};

function assertOwner(owner: string): void {
  if (typeof owner !== 'string' || owner.trim().length === 0) {
    throw new Error(
      'A Recovery Key Acknowledgment cannot be resolved without an owner',
    );
  }
}

/** The storage key one User's pending Recovery Key Acknowledgment lives under. */
export function recoveryKeyAcknowledgmentStorageKey(owner: string): string {
  assertOwner(owner);
  return `${RECOVERY_KEY_ACKNOWLEDGMENT_STORAGE_KEY}:${owner}`;
}

function readableStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function writableStorage(): Storage {
  const storage = readableStorage();
  if (!storage) {
    throw new Error(
      'Recovery Key Acknowledgment storage is unavailable outside the browser',
    );
  }
  return storage;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * A validated record for `owner`, or `null` when the stored JSON does not parse
 * as a current-version record naming this owner. An entry naming somebody else
 * is rejected rather than trusted, so one User's pending Acknowledgment is
 * unreadable by another signed in on the same device.
 */
function asRecoveryKeyAcknowledgmentRecord(
  parsed: unknown,
  owner: string,
): RecoveryKeyAcknowledgmentRecord | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<RecoveryKeyAcknowledgmentRecord>;
  if (candidate.version !== RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION) {
    return null;
  }
  if (candidate.owner !== owner) return null;
  if (typeof candidate.wrappingHash !== 'string') return null;
  if (candidate.wrappingHash.length === 0) return null;

  return {
    version: RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
    owner,
    wrappingHash: candidate.wrappingHash,
  };
}

/**
 * Read the wrapping hash `owner` still owes an Acknowledgment for, or
 * `undefined` when they owe none — or when storage is unavailable, or the
 * entry under this key does not validate as this owner's record.
 *
 * `undefined` is the safe answer in every one of those cases: it costs the
 * reminder not being shown, which is the direction this record is allowed to
 * be wrong in.
 */
export function readRecoveryKeyAcknowledgment(
  owner: string,
): RecoveryKeyAcknowledgmentRecord | undefined {
  assertOwner(owner);

  const storage = readableStorage();
  if (!storage) return undefined;

  const raw = storage.getItem(recoveryKeyAcknowledgmentStorageKey(owner));
  if (raw === null) return undefined;

  return asRecoveryKeyAcknowledgmentRecord(parseJson(raw), owner) ?? undefined;
}

/**
 * Record that `owner` minted `wrapping` and has not acknowledged it.
 *
 * Replaces whatever this owner held: the previous record was about a wrapping
 * that is no longer the one just minted, so keeping it would only accuse a
 * Vault nobody is asking about. Touches only the key `owner` is stored under,
 * so it can never write another User's record, and overwrites a mis-keyed or
 * corrupted entry rather than refusing it.
 */
export function writeRecoveryKeyAcknowledgment(options: {
  owner: string;
  wrappingHash: string;
}): void {
  assertOwner(options.owner);

  const record: RecoveryKeyAcknowledgmentRecord = {
    version: RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
    owner: options.owner,
    wrappingHash: options.wrappingHash,
  };

  writableStorage().setItem(
    recoveryKeyAcknowledgmentStorageKey(options.owner),
    JSON.stringify(record),
  );
}

/**
 * Remove the pending Recovery Key Acknowledgment `owner` holds — given as an
 * Acknowledgment, or as the belt-and-braces half of Explicit Local Vault
 * removal (ADR 0033), alongside the Local Vault, the Sync Bookmarks and the
 * Vault Meta Refusals already cleared there.
 *
 * An Acknowledgment owed about a Vault this device no longer holds is
 * meaningless, for the reason ADR 0058 gives about a stale bookmark. Touches
 * only the key `owner` is stored under, so it can never remove another User's
 * record.
 */
export function removeRecoveryKeyAcknowledgment(owner: string): void {
  assertOwner(owner);
  writableStorage().removeItem(recoveryKeyAcknowledgmentStorageKey(owner));
}
