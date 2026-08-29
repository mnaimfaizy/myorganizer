/**
 * The converge primitive — the single place a convergence decision is made.
 *
 * Given one Vault Blob Type, the Ciphertext this device holds for it, that
 * Ciphertext's Sync Bookmark, and the strategy pinned for the type, this
 * decides between sending, taking, merging, asking, and doing nothing.
 *
 * Vault Push, Vault Pull and Vault Reconcile are three entries into this
 * function, never three implementations of it: the Vault Handle's sync sink
 * (`vaultSyncQueue.ts`) drains through here, so does the pull check
 * (`vaultPullCheck.ts`, scheduled by `vaultPullTrigger.ts`), and so does the
 * sign-in pass (`vaultReconcile.ts`). Triplicating the decision is what
 * [#512](https://github.com/mnaimfaizy/myorganizer/issues/512) was: four
 * hand-written fan-outs that agreed about five Vault Blob Types and destroyed
 * the sixth. See [ADR 0054](../../../../../docs/adr/0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md).
 *
 * Note what this function is never handed: Vault Meta. Whether two sides may
 * be merged is answered by decrypting the server's copy and nothing else, so
 * meta equality cannot creep back in as a gate here — there is no meta to
 * compare. Changing a passphrase rewraps the same Master Key, which would make
 * such a gate fire a destructive prompt on the most routine security action
 * the product offers.
 */
import {
  EncryptedBlobV1,
  PutVaultBlobResponse,
  VaultApi,
  VaultBlobType,
} from '@myorganizer/app-api-client';
import {
  readDeletionLog,
  readVaultBlobRecords,
  type VaultBlobEnvelope,
} from '@myorganizer/core';

import { getHttpStatus } from '../http/getHttpStatus';

import type {
  EncryptedBlob,
  VaultRecordType,
  VaultStorageV1,
} from './localVaultStorage';
import { getServerVaultBlob, type ServerVaultBlob } from './serverVaultSync';
import {
  VAULT_BLOB_CONVERGE_STRATEGIES,
  VAULT_BLOB_FIELDS,
} from './vaultBlobFields';
import type { VaultHandle } from './vaultHandle';
import { serverEncryptedBlobToLocal, toEncryptedBlobV1 } from './vaultShapes';

/** The two Vault Blob endpoints convergence uses, and no others. */
type VaultBlobApi = Pick<VaultApi, 'getVaultBlob' | 'putVaultBlob'>;

/**
 * What converging needs from a Vault Handle, and nothing more.
 *
 * Named as a subset rather than taking the whole handle so the dependency is
 * readable: convergence reads Ciphertext, derives dirtiness, writes Ciphertext
 * back, and decrypts under the bound Master Key. It never unlocks, initializes,
 * claims, or removes a Vault.
 */
export type ConvergingVaultHandle = Pick<
  VaultHandle,
  | 'isUnlocked'
  | 'loadVault'
  | 'saveVault'
  | 'hasUnsentChanges'
  | 'lastPushedEtag'
  | 'recordPushSuccess'
  | 'saveEncryptedData'
  | 'decryptCiphertext'
>;

/**
 * What the User answered when convergence had to ask.
 *
 * `defer` is the answer given by a User who gave no answer — a dismissed
 * prompt. It writes nothing on either side, so the choice survives to be made
 * again (ADR 0033).
 */
export type VaultBlobConvergeDecision = 'keep-local' | 'keep-remote' | 'defer';

/** Why convergence had to ask instead of deciding. */
export type VaultBlobConvergeAskReason =
  /** This Vault Blob Type's pinned strategy is `promptOnConflict`. */
  | 'strategy'
  /**
   * The server's Ciphertext did not decrypt under the in-memory Master Key, so
   * the two sides are not the same Vault and no merge is possible. Degrading
   * to the prompt is the point: the alternative — assuming keep-local —
   * silently overwrites another Vault's data.
   */
  | 'undecryptable-remote'
  /**
   * This device's own Ciphertext did not decrypt under the Master Key bound to
   * it. Nothing can be merged into unreadable bytes, and the User is the only
   * one who can say whether to push them anyway or take the server's readable
   * copy. Asking beats throwing: a throw would leave the type stuck with no
   * way forward offered.
   */
  | 'undecryptable-local';

export type VaultBlobConvergePrompt = (params: {
  type: VaultBlobType;
  reason: VaultBlobConvergeAskReason;
  local: EncryptedBlobV1;
  remote: ServerVaultBlob;
}) => Promise<VaultBlobConvergeDecision> | VaultBlobConvergeDecision;

/** Why convergence wrote nothing. */
export type VaultBlobConvergeIdleReason =
  /** The Ciphertext matches its Sync Bookmark and the server holds the same. */
  | 'in-sync'
  /**
   * A conflict arrived while the Vault was locked. Merging needs the Master
   * Key and prompting a locked User to choose sides invites a destructive
   * answer, so nothing is written on either side and the type stays unsent —
   * to be retried after the next unlock.
   */
  | 'vault-locked'
  /**
   * This device holds no Local Vault for this owner at all. That is a first
   * download, not a convergence, and it needs Vault Meta this function is not
   * given.
   */
  | 'no-local-vault';

/**
 * What convergence did. One of the five things it can do.
 *
 * `merged` without an `etag` means the merge is saved locally but the server
 * moved again before the retry landed, so it is still unsent — the next
 * converge for this type picks it up. `asked` without an `etag` means the same
 * for a `keep-local` answer, or that the User deferred.
 */
export type VaultBlobConvergeOutcome =
  | { kind: 'nothing'; reason: VaultBlobConvergeIdleReason }
  | { kind: 'sent'; etag: string }
  | { kind: 'took'; etag: string }
  | { kind: 'merged'; etag?: string }
  | {
      kind: 'asked';
      reason: VaultBlobConvergeAskReason;
      decision: VaultBlobConvergeDecision;
      etag?: string;
    };

/**
 * One Vault Blob Type being converged, and everything needed to converge it.
 *
 * `type` and `field` are the same Vault Blob Type in the two vocabularies that
 * exist for it — the API contract's and the Local Vault's — and `field` is
 * always `VAULT_BLOB_FIELDS[type]`. They are derived once, here, so no step
 * below can pair the wrong two.
 */
type ConvergeContext = {
  api: VaultBlobApi;
  handle: ConvergingVaultHandle;
  type: VaultBlobType;
  field: VaultRecordType;
  prompt: VaultBlobConvergePrompt;
  /** The Local Vault as loaded at entry. Every write below goes back to it. */
  vault: VaultStorageV1;
};

/** Both halves of a decrypted payload, whichever shape it was written in. */
function toEnvelope(payload: unknown): VaultBlobEnvelope<unknown> {
  return {
    records: readVaultBlobRecords(payload),
    deletions: readDeletionLog(payload),
  };
}

function sameCiphertext(
  local: EncryptedBlob,
  remote: EncryptedBlobV1,
): boolean {
  return local.iv === remote.iv && local.ciphertext === remote.ciphertext;
}

function isConflict(error: unknown): boolean {
  return getHttpStatus(error) === 409;
}

/**
 * Converge one Vault Blob Type between this device and the server.
 *
 * `remote` is a copy the caller already fetched — Vault Pull has one in hand
 * and would otherwise ask for it twice. Omitting it is not a claim that the
 * server holds nothing; convergence goes and looks whenever the answer would
 * change what it does.
 *
 * Throws only on transport failures a caller has to see. Neither a conflict
 * nor unreadable Ciphertext on either side is one of them: both resolve to an
 * outcome.
 */
export async function convergeVaultBlob(options: {
  api: VaultBlobApi;
  handle: ConvergingVaultHandle;
  type: VaultBlobType;
  prompt: VaultBlobConvergePrompt;
  remote?: ServerVaultBlob | null;
}): Promise<VaultBlobConvergeOutcome> {
  const { api, handle, type, prompt } = options;
  const field = VAULT_BLOB_FIELDS[type];

  const vault = handle.loadVault();
  if (!vault) return { kind: 'nothing', reason: 'no-local-vault' };

  const context: ConvergeContext = { api, handle, type, field, prompt, vault };
  const local = vault.data[field];

  // Dirtiness is derived by hashing Ciphertext, so it is answerable while the
  // Vault is locked — moving bytes that are already encrypted needs no Master
  // Key.
  if (!(await handle.hasUnsentChanges(field))) {
    const remote = options.remote;
    if (!remote) return { kind: 'nothing', reason: 'in-sync' };
    if (local && sameCiphertext(local, remote.blob)) {
      return { kind: 'nothing', reason: 'in-sync' };
    }
    // Nothing local is unsent, so the server's copy supersedes this one
    // without anything being lost. This is the whole of a Vault Pull that
    // does not conflict.
    return { kind: 'took', etag: await takeRemote(context, remote) };
  }

  // `hasUnsentChanges` is false when there is no Ciphertext for this type, so
  // reaching here means there is some.
  const localBlob = local as EncryptedBlob;

  const ifMatch = handle.lastPushedEtag(field);
  if (!ifMatch) {
    // This device has never pushed this type, so it holds no evidence about
    // the server's copy. An unconditional push would overwrite whatever is
    // there, which is the failure the Sync Bookmark exists to prevent — so
    // look first, and converge against anything found.
    const seen = options.remote ?? (await getServerVaultBlob(api, type));
    if (seen) return decideConflict(context, localBlob, seen);
    return { kind: 'sent', etag: await send(context, localBlob) };
  }

  try {
    return { kind: 'sent', etag: await send(context, localBlob, ifMatch) };
  } catch (error) {
    if (!isConflict(error)) throw error;
  }

  // The push was refused, so the server holds Ciphertext this device has not
  // seen. Re-read it: the retry has to carry the ETag the server holds now,
  // not the one the Sync Bookmark remembers.
  const fresh = await getServerVaultBlob(api, type);
  if (!fresh) {
    // Refused against an ETag, then absent. There is nothing left to conflict
    // with, so the local Ciphertext goes up unconditionally.
    return { kind: 'sent', etag: await send(context, localBlob) };
  }

  return decideConflict(context, localBlob, fresh);
}

/**
 * Push Ciphertext and advance the Sync Bookmark to what the server gave back.
 * Returns that ETag.
 *
 * Touches no plaintext and needs no Master Key, which is why an unconflicted
 * send works while the Vault is locked.
 */
async function send(
  context: ConvergeContext,
  blob: EncryptedBlob,
  ifMatch?: string,
): Promise<string> {
  const response = await context.api.putVaultBlob({
    type: context.type,
    putVaultBlobRequest: {
      type: context.type,
      blob: toEncryptedBlobV1(blob),
    },
    ifMatch,
  });

  const { etag } = response.data as PutVaultBlobResponse;
  await context.handle.recordPushSuccess({ type: context.field, etag });
  return etag;
}

/**
 * Adopt the server's Ciphertext for this type. Returns the ETag it holds.
 *
 * The Sync Bookmark advances with it. A bookmark records the Ciphertext this
 * device and the server last agreed on, and after a take they agree on the
 * remote copy under its ETag — leaving the bookmark behind would make the
 * freshly taken blob read as unsent and push it straight back.
 *
 * Writes Ciphertext only, so it works while the Vault is locked.
 */
async function takeRemote(
  context: ConvergeContext,
  remote: ServerVaultBlob,
): Promise<string> {
  context.vault.data[context.field] = serverEncryptedBlobToLocal(remote.blob);
  context.handle.saveVault(context.vault);
  await context.handle.recordPushSuccess({
    type: context.field,
    etag: remote.etag,
  });

  return remote.etag;
}

/**
 * Decide a conflict between local Ciphertext and the server's copy.
 *
 * The order of the guards is the decision. Locked first, because a locked
 * Vault can neither merge nor be asked to choose safely. Decryptability next,
 * established by trying it — Vault Meta equality answers a different question
 * and would fire this prompt on every passphrase change. Only then does the
 * pinned strategy get a say.
 */
async function decideConflict(
  context: ConvergeContext,
  localBlob: EncryptedBlob,
  remote: ServerVaultBlob,
): Promise<VaultBlobConvergeOutcome> {
  const { handle, type } = context;

  if (!handle.isUnlocked) return { kind: 'nothing', reason: 'vault-locked' };

  const ask = (reason: VaultBlobConvergeAskReason) =>
    askUser(context, localBlob, remote, reason);

  let remotePayload: unknown;
  try {
    remotePayload = await handle.decryptCiphertext({
      blob: serverEncryptedBlobToLocal(remote.blob),
    });
  } catch {
    // A failed decryption means a genuinely different Master Key — the Vault
    // was re-initialized elsewhere. It is never evidence that the local copy
    // is the right one to keep.
    return ask('undecryptable-remote');
  }

  const strategy = VAULT_BLOB_CONVERGE_STRATEGIES[type];
  if (strategy.strategy === 'promptOnConflict') return ask('strategy');

  let localPayload: unknown;
  try {
    localPayload = await handle.decryptCiphertext({ blob: localBlob });
  } catch {
    // The readable side is the server's. Merging into bytes this device
    // cannot read is impossible, and quietly preferring either side would
    // destroy one of them.
    return ask('undecryptable-local');
  }

  const merged = strategy.merge(
    toEnvelope(localPayload),
    toEnvelope(remotePayload),
  );

  // Save before sending. The merge is the converged truth whether or not the
  // push lands, and a merge kept only in memory is a merge lost to a refresh.
  await handle.saveEncryptedData({ type: context.field, value: merged });
  const mergedBlob = handle.loadVault()?.data[context.field];
  if (!mergedBlob) {
    throw new Error(`Merged Ciphertext for "${context.field}" was not saved`);
  }

  try {
    return {
      kind: 'merged',
      etag: await send(context, mergedBlob, remote.etag),
    };
  } catch (error) {
    if (!isConflict(error)) throw error;
    // The server moved again while this merge was being computed. The merged
    // Ciphertext is saved and reads as unsent, so the next converge for this
    // type merges the newer remote into it.
    return { kind: 'merged' };
  }
}

/** Ask the User which side to keep, and carry out the answer. */
async function askUser(
  context: ConvergeContext,
  localBlob: EncryptedBlob,
  remote: ServerVaultBlob,
  reason: VaultBlobConvergeAskReason,
): Promise<VaultBlobConvergeOutcome> {
  const decision = await context.prompt({
    type: context.type,
    reason,
    local: toEncryptedBlobV1(localBlob),
    remote,
  });

  if (decision === 'defer') return { kind: 'asked', reason, decision };

  if (decision === 'keep-remote') {
    return {
      kind: 'asked',
      reason,
      decision,
      etag: await takeRemote(context, remote),
    };
  }

  try {
    return {
      kind: 'asked',
      reason,
      decision,
      etag: await send(context, localBlob, remote.etag),
    };
  } catch (error) {
    if (!isConflict(error)) throw error;
    // The server moved again between the prompt and the answer. Nothing local
    // changed, so the type stays unsent and the next converge asks again
    // against what the server holds then.
    return { kind: 'asked', reason, decision };
  }
}
