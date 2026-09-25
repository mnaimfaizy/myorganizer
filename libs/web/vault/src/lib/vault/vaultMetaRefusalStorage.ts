/**
 * Vault Meta Refusal storage — one record per User, per lifetime.
 *
 * A Vault Meta Refusal records the wrapping a User was offered and declined,
 * not the fact that a question was once asked. That distinction is the whole
 * point of the record: a boolean saying "this owner was asked something" cannot
 * tell one wrapping from another, so a second and genuinely different Vault
 * Meta change arriving afterwards is swallowed in silence
 * ([ADR 0066](../../../../../docs/adr/0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md)).
 * A hash of the refused Vault Meta can tell them apart, which is why what is
 * stored here is a hash and never a flag.
 *
 * **Beside the Sync Bookmark record, not inside it.** ADR 0066 leaves the
 * placement open and names the cost of putting it inside: that record's scope
 * sentence is "what this device owes the server", and a refusal is not owed. It
 * lives here instead for a second and more mechanical reason. A refusal has two
 * lifetimes — an answer of "keep my current passphrase" outlives the tab, a
 * dismissal does not — and the session-scoped half cannot live in a
 * `localStorage` record at all. Splitting the halves across two modules with
 * two shapes would leave one comparison reading two unrelated things; keeping
 * them here, one record shape over two backing `Storage`s, is what makes "one
 * comparison, two lifetimes" true of the code and not just of the prose.
 *
 * What it does share with a Sync Bookmark is its failure direction. Losing a
 * refusal, or failing to read one, costs at most a repeated question and never
 * a User's data — so a mis-keyed or corrupted entry is replaced rather than
 * refused, exactly as in `syncBookmarkStorage.ts`, and there is no write guard
 * here to mirror `writeOwnedLocalVault`'s. See ADR 0058 for that precedent.
 */

import { VAULT_META_CHANGES, type VaultMetaChange } from './vaultMetaConverge';

/**
 * How long a refusal holds.
 *
 * `durable` is an answer — the User said to keep this device's wrapping, and it
 * holds until the wrapping changes again. `session` is "not now" — the User
 * dismissed the dialog, and it holds until the tab closes. Both are read by the
 * same comparison; only the `Storage` they live in differs.
 */
export const VAULT_META_REFUSAL_LIFETIMES = ['durable', 'session'] as const;

export type VaultMetaRefusalLifetime =
  (typeof VAULT_META_REFUSAL_LIFETIMES)[number];

/** Where one lifetime's refusal is kept. */
type VaultMetaRefusalStore = () => Storage;

/**
 * Pinned rather than branched on, so a third lifetime cannot be added without
 * somebody saying where it is kept
 * ([ADR 0053](../../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
 *
 * Read through `readableStorage`, which checks for a `window` first — these are
 * only reached once there is one.
 */
const VAULT_META_REFUSAL_STORES = {
  durable: () => window.localStorage,
  session: () => window.sessionStorage,
} as const satisfies Record<VaultMetaRefusalLifetime, VaultMetaRefusalStore>;

/**
 * What a Vault Meta Refusal records: the hash of the Vault Meta that was
 * offered, and which wrapping in it the User was asked about.
 *
 * A hash for the same reasons a Vault Meta Bookmark is one — the meta itself
 * would put a second copy of wrapping material beside the Local Vault, and an
 * ETag says nothing about which wrapping it named. The hash is the same one the
 * bookmark holds (`hashVaultMeta`), so "the wrapping this device refused" and
 * "the wrapping this device agreed to" are comparable statements about the same
 * identity rather than two encodings that can drift apart.
 *
 * The Vault Meta Change is recorded beside it because the hash alone does not
 * identify the question. Divergence is reported as the first facet that differs
 * (`describeVaultMetaDivergence`), so the same unmoved server meta asks a
 * different question once this device's own wrapping moves: refuse a recovery
 * key change, then change the passphrase here and fail to push it, and what is
 * now divergent is the passphrase. Keyed on the hash alone, that second and
 * genuinely different question would be swallowed by the first refusal — the
 * exact defect this record replaces, one level in.
 */
export type VaultMetaRefusalEntry = {
  /** SHA-256 hex digest of the Vault Meta refused. */
  metaHash: string;
  /** Which wrapping in it the User was asked about, and declined. */
  change: VaultMetaChange;
};

/** The storage key prefix every per-User Vault Meta Refusal key is built from. */
export const VAULT_META_REFUSAL_STORAGE_KEY =
  'myorganizer_vault_meta_refusal_v1';

/** Record version written for a Vault Meta Refusal. */
export const VAULT_META_REFUSAL_RECORD_VERSION = 1;

/**
 * One User's Vault Meta Refusal for one lifetime.
 *
 * One refusal and not a list. The question being suppressed is "start using
 * *this* wrapping?", so what has to be remembered is the last wrapping the
 * answer was given about: a wrapping that is not it is a different question and
 * has to be asked. A list would remember answers about wrappings the server no
 * longer holds, and grow without anything ever pruning it.
 */
export type VaultMetaRefusalRecord = {
  version: 1;
  owner: string;
  refusal: VaultMetaRefusalEntry;
};

function assertOwner(owner: string): void {
  if (typeof owner !== 'string' || owner.trim().length === 0) {
    throw new Error('A Vault Meta Refusal cannot be resolved without an owner');
  }
}

/** The storage key one User's Vault Meta Refusal lives under. */
export function vaultMetaRefusalStorageKey(owner: string): string {
  assertOwner(owner);
  return `${VAULT_META_REFUSAL_STORAGE_KEY}:${owner}`;
}

function readableStorage(lifetime: VaultMetaRefusalLifetime): Storage | null {
  if (typeof window === 'undefined') return null;
  return VAULT_META_REFUSAL_STORES[lifetime]();
}

function writableStorage(lifetime: VaultMetaRefusalLifetime): Storage {
  const storage = readableStorage(lifetime);
  if (!storage) {
    throw new Error(
      'Vault Meta Refusal storage is unavailable outside the browser',
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

function isVaultMetaRefusalEntry(
  value: unknown,
): value is VaultMetaRefusalEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<VaultMetaRefusalEntry>;

  return (
    typeof candidate.metaHash === 'string' &&
    // Read against the enum's own list rather than a string check: a stored
    // change this build no longer knows is not a refusal it can compare, and
    // treating it as one would suppress a question on evidence nothing here
    // understands.
    VAULT_META_CHANGES.includes(candidate.change as VaultMetaChange)
  );
}

/**
 * A validated record for `owner`, or `null` when the stored JSON does not parse
 * as a current-version record naming this owner. An entry naming somebody else
 * is rejected rather than trusted, so one User's refusal is unreadable by
 * another signed in on the same device.
 */
function asVaultMetaRefusalRecord(
  parsed: unknown,
  owner: string,
): VaultMetaRefusalRecord | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<VaultMetaRefusalRecord>;
  if (candidate.version !== VAULT_META_REFUSAL_RECORD_VERSION) return null;
  if (candidate.owner !== owner) return null;
  if (!isVaultMetaRefusalEntry(candidate.refusal)) return null;

  return {
    version: VAULT_META_REFUSAL_RECORD_VERSION,
    owner,
    refusal: candidate.refusal,
  };
}

/**
 * Read the wrapping `owner` refused under `lifetime`, or `undefined` when they
 * have refused none — or when storage is unavailable, or the entry under this
 * key does not validate as this owner's record.
 *
 * `undefined` is the safe answer in every one of those cases: it costs the
 * question being asked again, which is the direction this record is allowed to
 * be wrong in.
 */
export function readVaultMetaRefusal(options: {
  owner: string;
  lifetime: VaultMetaRefusalLifetime;
}): VaultMetaRefusalEntry | undefined {
  assertOwner(options.owner);

  const storage = readableStorage(options.lifetime);
  if (!storage) return undefined;

  const raw = storage.getItem(vaultMetaRefusalStorageKey(options.owner));
  if (raw === null) return undefined;

  return (
    asVaultMetaRefusalRecord(parseJson(raw), options.owner)?.refusal ??
    undefined
  );
}

/**
 * Record that `owner` declined `entry`'s wrapping, for `lifetime`.
 *
 * Replaces whatever that lifetime held: the previous refusal was an answer
 * about a wrapping that is no longer the one being offered, so keeping it would
 * only suppress a question nobody is asking. Touches only the key `owner` is
 * stored under, so it can never write another User's refusal, and overwrites a
 * mis-keyed or corrupted entry rather than refusing it — losing a refusal costs
 * a repeated question, while refusing to write one costs the same question
 * asked on every pass.
 */
export function writeVaultMetaRefusal(options: {
  owner: string;
  lifetime: VaultMetaRefusalLifetime;
  entry: VaultMetaRefusalEntry;
}): void {
  assertOwner(options.owner);

  const record: VaultMetaRefusalRecord = {
    version: VAULT_META_REFUSAL_RECORD_VERSION,
    owner: options.owner,
    refusal: options.entry,
  };

  writableStorage(options.lifetime).setItem(
    vaultMetaRefusalStorageKey(options.owner),
    JSON.stringify(record),
  );
}

/**
 * Remove every Vault Meta Refusal `owner` holds, of either lifetime — the
 * refusal half of Explicit Local Vault removal (ADR 0033), alongside the Local
 * Vault, the Sync Bookmarks and the Vault Meta Bookmark it already clears.
 *
 * A refusal about a Vault this device no longer holds is meaningless, for the
 * reason ADR 0058 gives about a stale bookmark. Touches only the key `owner` is
 * stored under, so it can never remove another User's refusal.
 */
export function removeVaultMetaRefusals(owner: string): void {
  assertOwner(owner);
  const key = vaultMetaRefusalStorageKey(owner);
  for (const lifetime of VAULT_META_REFUSAL_LIFETIMES) {
    writableStorage(lifetime).removeItem(key);
  }
}
