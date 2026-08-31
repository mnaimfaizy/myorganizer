/**
 * Local Vault storage — one entry per User.
 *
 * The entry is keyed by user id and *also* carries the owner inside the
 * record. The key is the index and the field is the assertion: a record found
 * under one User's key that names somebody else is rejected rather than
 * trusted, so a mis-keyed or hand-edited entry is detectable instead of
 * silently adopted.
 *
 * The pre-existing unsuffixed slot is left where it is as an Unclaimed Local
 * Vault. It predates per-User scoping, so ownership cannot be read from it and
 * must be proven by Vault Claim Evidence — the server's own Vault Meta, or a
 * recovery key; never a passphrase unwrap, which establishes knowledge of a
 * string rather than ownership of a Vault. It is never resolved implicitly for
 * anybody: a read reports that it is here and hands back nothing, and it is
 * never removed on anyone's behalf.
 *
 * See ADR 0047, ADR 0061 and ADR 0033.
 */

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};

export type VaultRecordType =
  | 'addresses'
  | 'groceries'
  | 'mobileNumbers'
  | 'subscriptions'
  | 'tasks'
  | 'todos';

export type VaultStorageV1 = {
  version: 1;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  masterKeyWrappedWithPassphrase: EncryptedBlob;
  masterKeyWrappedWithRecoveryKey: EncryptedBlob;
  data: {
    addresses?: EncryptedBlob;
    groceries?: EncryptedBlob;
    mobileNumbers?: EncryptedBlob;
    subscriptions?: EncryptedBlob;
    tasks?: EncryptedBlob;
    todos?: EncryptedBlob;
  };
};

export type VaultUnlockResult = {
  masterKeyBytes: Uint8Array;
};

/**
 * The unsuffixed slot. Also the prefix every per-User key is composed from —
 * the platform storage interface stays key-addressed and unchanged; the
 * composition happens here, in the caller.
 */
export const VAULT_STORAGE_KEY = 'myorganizer_vault_v1';

/** Record version written for a Local Vault that has a recorded owner. */
export const LOCAL_VAULT_RECORD_VERSION = 2;

/** A Local Vault entry stored under one User's key, asserting its owner. */
export type LocalVaultRecord = {
  version: 2;
  owner: string;
  vault: VaultStorageV1;
};

/**
 * What a slot holds for a given reader.
 *
 * `owner-mismatch` is neither a Vault nor an absence: the entry exists and
 * names somebody else, so it is rejected rather than trusted, and rejected
 * rather than overwritten.
 *
 * `unclaimed` carries no Vault, and the omission is the point. This reader is
 * synchronous and Vault Claim Evidence needs the network, so a Vault handed
 * back here could only be guarded by discipline at every call site — and every
 * caller then becomes a place the guard can be forgotten. Reporting the status
 * without the Vault is what lets evidence-checked callers see that something
 * is here while leaving them no way to read it: the Unclaimed Local Vault is
 * reachable only through `readUnclaimed`, which the Vault Claim Evidence paths
 * in `vaultClaimEvidence.ts` are the callers of (ADR 0061).
 */
export type LocalVaultReadResult =
  | { status: 'owned'; vault: VaultStorageV1 }
  | { status: 'unclaimed' }
  | { status: 'owner-mismatch'; recordedOwner: string }
  | { status: 'absent' };

/** What a slot holds for a given reader, without the Vault itself. */
export type LocalVaultStatus = LocalVaultReadResult['status'];

/** A single addressable place a Local Vault can be read from and written to. */
export type LocalVaultSlot = {
  read(): LocalVaultReadResult;
  write(vault: VaultStorageV1): void;
  /**
   * Where a newly created Vault is written.
   *
   * The one write that does not follow the read. A User creating their own
   * Vault on a device that holds an Unclaimed Local Vault must leave that
   * Vault byte-identical (ADR 0033), so creation always lands in this slot's
   * own entry rather than in whatever the slot currently resolves.
   */
  createNew(vault: VaultStorageV1): void;
  /**
   * The Unclaimed Local Vault this device holds, or `null`. Independent of
   * what the slot resolves for its owner, and reading it is not claiming it.
   */
  readUnclaimed(): VaultStorageV1 | null;
  /**
   * Vault Claim, storage half: rewrite an Unclaimed Local Vault as a
   * current-version record owned by this slot's owner. A no-op for a slot with
   * no owner to claim for.
   */
  claim(vault: VaultStorageV1): void;
  /**
   * Explicit Local Vault removal (ADR 0033) — never automatic, never offered
   * for an Unclaimed Local Vault. A slot with no owner to remove for refuses.
   */
  remove(): void;
};

/**
 * An entry under one User's key is not that User's record. Either it names
 * somebody else, or it asserts no owner at all and so cannot be trusted to be
 * theirs. `recordedOwner` is the owner it does name, or `null` when it names
 * none.
 */
export class VaultOwnerMismatchError extends Error {
  public readonly code = 'vault-owner-mismatch';
  public readonly expectedOwner: string;
  public readonly recordedOwner: string | null;

  constructor(expectedOwner: string, recordedOwner: string | null) {
    super(
      'This Local Vault entry is not the record of the User it is keyed to',
    );
    this.name = 'VaultOwnerMismatchError';
    this.expectedOwner = expectedOwner;
    this.recordedOwner = recordedOwner;
    // Preserve prototype chain for instanceof checks across module boundaries.
    Object.setPrototypeOf(this, VaultOwnerMismatchError.prototype);
  }
}

export function assertVaultOwner(owner: string): void {
  if (typeof owner !== 'string' || owner.trim().length === 0) {
    throw new Error('A Local Vault cannot be resolved without an owner');
  }
}

/** The storage key one User's Local Vault lives under. */
export function localVaultStorageKey(owner: string): string {
  assertVaultOwner(owner);
  return `${VAULT_STORAGE_KEY}:${owner}`;
}

function readableStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function writableStorage(): Storage {
  const storage = readableStorage();
  if (!storage) {
    throw new Error('Local Vault storage is unavailable outside the browser');
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
 * The owner an entry asserts, or `null` when it asserts none. Read before the
 * record is validated so a mis-keyed entry is reported as a mismatch rather
 * than as unreadable.
 */
function recordedOwnerOf(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const owner = (parsed as { owner?: unknown }).owner;
  return typeof owner === 'string' && owner.length > 0 ? owner : null;
}

function isVaultStorageV1(value: unknown): value is VaultStorageV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1
  );
}

function asLocalVaultRecord(parsed: unknown): LocalVaultRecord | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<LocalVaultRecord>;
  if (candidate.version !== LOCAL_VAULT_RECORD_VERSION) return null;
  if (typeof candidate.owner !== 'string' || candidate.owner.length === 0) {
    return null;
  }
  if (!isVaultStorageV1(candidate.vault)) return null;
  return candidate as LocalVaultRecord;
}

/** Read the Unclaimed Local Vault, or `null` when the unsuffixed slot is empty. */
export function readUnclaimedLocalVault(): VaultStorageV1 | null {
  const storage = readableStorage();
  if (!storage) return null;

  const raw = storage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return null;

  const parsed = parseJson(raw);
  return isVaultStorageV1(parsed) ? parsed : null;
}

/**
 * Write the unsuffixed slot. Only the legacy shim path reaches this — an
 * owner-bound caller always writes its own entry. Removed with the shim.
 */
export function writeUnclaimedLocalVault(vault: VaultStorageV1): void {
  writableStorage().setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
}

/**
 * Resolve the Local Vault belonging to `owner`.
 *
 * Their own entry wins, and it is the only thing that ever yields a Vault. An
 * owner who holds none resolves to no Vault at all — `unclaimed` when the
 * unsuffixed slot is occupied, `absent` when it is not — because an unwrap
 * proves knowledge of a passphrase string rather than ownership of a Vault,
 * and two people who share a passphrase would otherwise each open the other's
 * (ADR 0061). Reaching an Unclaimed Local Vault is an explicit, asynchronous,
 * evidence-checked act; it is not something a storage read does.
 *
 * The two no-Vault answers stay distinct because the callers that establish
 * evidence need to know whether there is anything here to establish it about.
 */
export function resolveLocalVault(owner: string): LocalVaultReadResult {
  assertVaultOwner(owner);

  const storage = readableStorage();
  if (!storage) return { status: 'absent' };

  const raw = storage.getItem(localVaultStorageKey(owner));
  if (raw !== null) {
    const parsed = parseJson(raw);
    const recordedOwner = recordedOwnerOf(parsed);
    if (recordedOwner !== null && recordedOwner !== owner) {
      return { status: 'owner-mismatch', recordedOwner };
    }

    const record = asLocalVaultRecord(parsed);
    // An unreadable entry under this User's key still means they hold a Local
    // Vault, so the Unclaimed Local Vault is not offered to them.
    return record
      ? { status: 'owned', vault: record.vault }
      : { status: 'absent' };
  }

  return readUnclaimedLocalVault()
    ? { status: 'unclaimed' }
    : { status: 'absent' };
}

/**
 * Write `owner`'s Local Vault as a current-version record.
 *
 * Refuses to overwrite anything that is not already this owner's record. A
 * mis-keyed entry is not trusted, and neither it nor an unreadable one is
 * destroyed to make room — a Local Vault is never silently destroyed
 * (ADR 0033), so the refusal is loud and the bytes stay put.
 */
export function writeOwnedLocalVault(options: {
  owner: string;
  vault: VaultStorageV1;
}): void {
  assertVaultOwner(options.owner);

  const storage = writableStorage();
  const key = localVaultStorageKey(options.owner);

  const existing = storage.getItem(key);
  if (existing !== null) {
    const parsed = parseJson(existing);
    const record = asLocalVaultRecord(parsed);
    if (!record || record.owner !== options.owner) {
      throw new VaultOwnerMismatchError(options.owner, recordedOwnerOf(parsed));
    }
  }

  const record: LocalVaultRecord = {
    version: LOCAL_VAULT_RECORD_VERSION,
    owner: options.owner,
    vault: options.vault,
  };
  storage.setItem(key, JSON.stringify(record));
}

/**
 * Remove `owner`'s Local Vault entry — explicit Local Vault removal (ADR 0033).
 *
 * Touches only the key `owner` is stored under, so it can never remove another
 * User's entry and can never remove the unsuffixed Unclaimed Local Vault slot:
 * an owner who currently resolves to `unclaimed` has nothing at their own key
 * yet, so this is a no-op for them by construction, not by a separate guard.
 */
export function removeOwnedLocalVault(owner: string): void {
  assertVaultOwner(owner);
  writableStorage().removeItem(localVaultStorageKey(owner));
}

/**
 * The slot holding one User's Local Vault.
 *
 * A write follows the read. While the only Vault this User can resolve is the
 * Unclaimed Local Vault, that slot is still where their Vault lives, so a write
 * goes back to it. Promoting it to an owned record is a Vault Claim, and a
 * claim is only ever the consequence of Vault Claim Evidence (ADR 0061) —
 * which is why `claim` is a separate method, and why the paths that establish
 * that evidence are the only ones that call it.
 */
export function ownedLocalVaultSlot(owner: string): LocalVaultSlot {
  assertVaultOwner(owner);

  const claim = (vault: VaultStorageV1) =>
    writeOwnedLocalVault({ owner, vault });

  return {
    read: () => resolveLocalVault(owner),

    // Always this owner's own entry. The branch that used to send a write to
    // the unsuffixed slot — when this owner resolved the Unclaimed Local Vault
    // implicitly, so that editing it was not the same as claiming it — went
    // with the resolution it existed for. Leaving it would be worse than dead
    // code: an owner who resolves `unclaimed` now holds no Vault at all, so
    // the branch's only remaining effect would be to write their data into
    // somebody else's Unclaimed Local Vault.
    write: claim,

    // Creating a Vault is not editing the one this User can currently resolve.
    // A User who declines an Unclaimed Local Vault and makes their own gets
    // their own entry, and the declined Vault is left exactly where it was.
    createNew: claim,

    readUnclaimed: readUnclaimedLocalVault,

    // The claim rewrites the Unclaimed Local Vault into a current-version
    // record under the claiming User's key. The unsuffixed slot is left
    // byte-identical — a Local Vault is never removed on anyone's behalf.
    claim,

    remove: () => removeOwnedLocalVault(owner),
  };
}

/**
 * The unsuffixed slot addressed directly, with no owner to assert. Reachable
 * only from the shim, for a caller with no signed-in User. Removed with it.
 */
export function unclaimedLocalVaultSlot(): LocalVaultSlot {
  return {
    read: () => {
      const vault = readUnclaimedLocalVault();
      return vault ? { status: 'unclaimed', vault } : { status: 'absent' };
    },
    write: writeUnclaimedLocalVault,
    createNew: writeUnclaimedLocalVault,
    readUnclaimed: readUnclaimedLocalVault,
    claim: () => {
      /* Nothing to claim for: this slot has no owner. */
    },
    remove: () => {
      // An Unclaimed Local Vault is never removed on anyone's behalf
      // (ADR 0033) — there is no owner here to authorise it.
      throw new Error('An Unclaimed Local Vault cannot be removed');
    },
  };
}
