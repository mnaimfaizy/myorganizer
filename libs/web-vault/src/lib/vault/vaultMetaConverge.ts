/**
 * Vault Meta convergence — decided on its own terms, never alongside the data.
 *
 * Vault Meta and Vault Blobs diverge for unrelated reasons, so they converge
 * by unrelated rules (see CONTEXT.md's "Vault Meta" entry and
 * [ADR 0057](../../../../../docs/adr/0057-vault-meta-converges-separately-and-never-silently.md)).
 * Changing a passphrase rewraps the *same* Master Key: the wrapping moves and
 * every Vault Blob stays byte-identical and fully readable. Deciding the two
 * together would turn an ordinary passphrase change into a whole-Vault
 * conflict, and answering "keep this device" would silently revert it.
 *
 * Adopting a remote wrapping is the one move that can brick a Local Vault. If
 * it wraps a different Master Key, every Vault Blob on this device is left
 * encrypted under a key nothing here can unwrap — and a wrapping cannot be
 * verified without the passphrase it was derived from, so there is no check to
 * run first. That is why nothing here happens without an explicit answer.
 *
 * This module structurally cannot write. It takes `getVaultMeta` and nothing
 * else, so no answer given to it can push a local wrapping over the server's
 * and undo a passphrase change made elsewhere. Adoption is returned as a next
 * Local Vault for the caller to save, exactly as Vault Reconcile returns one.
 */
import { VaultApi, VaultMetaV1 } from '@myorganizer/app-api-client';

import { getHttpStatus } from '../http/getHttpStatus';

import { VaultStorageV1 } from './localVaultStorage';
import { getServerVaultMeta, type ServerVaultMeta } from './serverVaultSync';
import { stableStringify } from './stableStringify';
import {
  adoptServerMetaIntoLocalVault,
  localToServerMeta,
  normalizeEncryptedBlobV1,
} from './vaultShapes';

/**
 * Which wrapping in a Vault Meta moved, in the order divergence is reported —
 * first match wins.
 *
 * `different-vault` comes first because it is the only one that is not a
 * change at all. A differing `kdf_salt` cannot be a rotated passphrase:
 * `changePassphrase` re-derives from the salt the vault already has and
 * replaces only the wrapping, while `initialize` mints a fresh salt beside a
 * fresh Master Key. So a salt that moved means the two sides were initialized
 * separately and hold different Master Keys — and every other difference in
 * the meta follows from that rather than standing on its own.
 *
 * Reading it as a passphrase change is what
 * [#578](https://github.com/mnaimfaizy/myorganizer/issues/578) was: the User
 * was told their passphrase had changed elsewhere and offered a button that
 * would adopt the other vault's wrapping over this device's Ciphertext,
 * leaving every Vault Blob here encrypted under a key nothing here can
 * unwrap.
 *
 * The passphrase comes next because it is the wrapping that can lock a User
 * out of their own device: a User whose passphrase changed elsewhere needs to
 * hear about the passphrase, not about a recovery key that also moved.
 *
 * This array is the only enumeration of the members; the tables below are
 * pinned against it ([ADR 0053](../../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)),
 * so a fourth member cannot be added without a facet to read it from and an
 * answer to whether it may be adopted.
 */
export const VAULT_META_CHANGES = [
  'different-vault',
  'passphrase',
  'recovery-key',
] as const;

export type VaultMetaChange = (typeof VAULT_META_CHANGES)[number];

/** The part of a Vault Meta one Vault Meta Change is read from. */
type VaultMetaFacet = (meta: VaultMetaV1) => object;

const VAULT_META_CHANGE_FACETS = {
  /**
   * The salt alone, and deliberately nothing else. It is the one field that
   * answers "is this the same vault?" without needing the passphrase it was
   * derived from — which ADR 0057 correctly says a wrapping cannot be
   * verified without, and which is why this evidence is worth reading before
   * anything else.
   */
  'different-vault': (meta) => ({ kdf_salt: meta.kdf_salt }),
  /**
   * The KDF parameters belong here and nowhere else: the recovery key wraps
   * the Master Key directly, without deriving anything, so a hash or
   * iteration move can only change what a passphrase produces. `version` is
   * here for the conservative reason — it decides how a wrapping is read at
   * all, and naming the passphrase is the safer answer when it moves. The
   * salt is not here; it is read above, where a difference in it means
   * something else entirely.
   */
  passphrase: (meta) => ({
    version: meta.version,
    kdf_name: meta.kdf_name,
    kdf_params: meta.kdf_params,
    wrapped: normalizeEncryptedBlobV1(meta.wrapped_mk_passphrase),
  }),
  'recovery-key': (meta) => ({
    wrapped: normalizeEncryptedBlobV1(meta.wrapped_mk_recovery),
  }),
} as const satisfies Record<VaultMetaChange, VaultMetaFacet>;

/**
 * Whether this device may start using the server's wrapping for a given Vault
 * Meta Change.
 *
 * Adoption carries the local Ciphertext across and replaces only the
 * wrapping, which is right exactly when both sides hold the same Master Key.
 * A rotated passphrase or recovery key does; two separately initialized
 * vaults do not, and adopting there destroys the data on this device.
 *
 * Pinned rather than inferred so the answer is decided per member: a fourth
 * Vault Meta Change fails to compile until somebody says whether adopting it
 * is a safe thing to offer.
 */
export const VAULT_META_CHANGE_ADOPTABLE = {
  'different-vault': false,
  passphrase: true,
  'recovery-key': true,
} as const satisfies Record<VaultMetaChange, boolean>;

export type VaultMetaDivergence =
  | { kind: 'none' }
  | { kind: 'diverged'; change: VaultMetaChange };

/**
 * Compare two Vault Metas and name what moved.
 *
 * Naming matters more than the boolean: the answer is what the User is asked
 * about, and "your vault differs" is not something a User can act on, while
 * "your passphrase was changed on another device" is.
 */
export function describeVaultMetaDivergence(options: {
  local: VaultMetaV1;
  remote: VaultMetaV1;
}): VaultMetaDivergence {
  for (const change of VAULT_META_CHANGES) {
    const read = VAULT_META_CHANGE_FACETS[change];
    if (
      stableStringify(read(options.local)) !==
      stableStringify(read(options.remote))
    ) {
      return { kind: 'diverged', change };
    }
  }

  return { kind: 'none' };
}

/**
 * The three answers to "start using the new wrapping here?".
 *
 * `defer` is the answer given by a User who gave no answer — a dismissed
 * prompt. It writes nothing and is not remembered, so the question comes back
 * (ADR 0033). `keep-local` is a given answer that also writes nothing: this
 * device carries on unlocking the way it already does, and the server keeps
 * the wrapping the other device put there.
 */
export type VaultMetaDecision = 'adopt-remote' | 'keep-local' | 'defer';

export type VaultMetaConvergePrompt = (params: {
  change: VaultMetaChange;
  remote: ServerVaultMeta;
}) => Promise<VaultMetaDecision> | VaultMetaDecision;

export type VaultMetaConvergeResult =
  /** No Local Vault on this device — there is no wrapping to replace. */
  | { kind: 'skipped-no-local-vault' }
  | { kind: 'skipped-not-authenticated' }
  /** The server holds no Vault Meta yet. First sync is Vault Reconcile's job. */
  | { kind: 'skipped-no-server-meta' }
  | { kind: 'noop-already-in-sync' }
  /** The User answered, and the answer was to leave this device alone. */
  | { kind: 'noop-declined'; change: VaultMetaChange }
  /** The User gave no answer. Nothing was written; ask again later. */
  | { kind: 'noop-deferred'; change: VaultMetaChange }
  /**
   * The User answered `adopt-remote` for a change that cannot be adopted.
   * Reported rather than silently treated as `keep-local`: an answer that
   * cannot be carried out is something the caller has to know it gave, and a
   * silent downgrade would hide a UI offering an action the library refuses.
   */
  | { kind: 'refused-not-adoptable'; change: VaultMetaChange }
  | {
      kind: 'adopted-remote';
      change: VaultMetaChange;
      /** The Local Vault to save: the remote wrapping over local Ciphertext. */
      nextLocalVault: VaultStorageV1;
    };

/**
 * Converge one User's Vault Meta with the server's, asking before replacing.
 *
 * Runs independently of Vault Blob convergence and cannot gate it: a Vault
 * Meta that diverges — or a check that fails outright — leaves every Vault
 * Blob exactly as mergeable as it was.
 */
export async function convergeVaultMeta(options: {
  // Deliberately narrower than the Vault Reconcile surface: one method, and
  // no way to write. See the module doc.
  api: Pick<VaultApi, 'getVaultMeta'>;
  localVault: VaultStorageV1 | null;
  prompt: VaultMetaConvergePrompt;
}): Promise<VaultMetaConvergeResult> {
  const { localVault } = options;
  if (!localVault) {
    return { kind: 'skipped-no-local-vault' };
  }

  let serverMeta: ServerVaultMeta | null;
  try {
    serverMeta = await getServerVaultMeta(options.api);
  } catch (error) {
    const status = getHttpStatus(error);
    if (status === 401 || status === 403) {
      return { kind: 'skipped-not-authenticated' };
    }
    throw error;
  }

  if (!serverMeta) {
    return { kind: 'skipped-no-server-meta' };
  }

  const divergence = describeVaultMetaDivergence({
    local: localToServerMeta(localVault),
    remote: serverMeta.meta,
  });

  if (divergence.kind === 'none') {
    return { kind: 'noop-already-in-sync' };
  }

  const decision = await options.prompt({
    change: divergence.change,
    remote: serverMeta,
  });

  if (decision === 'defer') {
    return { kind: 'noop-deferred', change: divergence.change };
  }

  if (decision === 'keep-local') {
    return { kind: 'noop-declined', change: divergence.change };
  }

  if (!VAULT_META_CHANGE_ADOPTABLE[divergence.change]) {
    // The wrapping on the server belongs to a different Master Key, so there
    // is no Ciphertext here it can open. Abandoning this device's Vault for
    // another is an explicit removal (ADR 0033), never a wrapping quietly
    // swapped in underneath the data it cannot decrypt.
    return { kind: 'refused-not-adoptable', change: divergence.change };
  }

  return {
    kind: 'adopted-remote',
    change: divergence.change,
    nextLocalVault: adoptServerMetaIntoLocalVault({
      localVault,
      meta: serverMeta.meta,
    }),
  };
}
