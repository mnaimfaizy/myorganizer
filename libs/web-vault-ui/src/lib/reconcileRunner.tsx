'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@myorganizer/web-ui';
import { useEffect, useRef, useState } from 'react';

import type {
  VaultReconcileAsk,
  VaultReconcileDecision,
  VaultReconcileResult,
  VaultReconcileStart,
} from '@myorganizer/web-vault';
import {
  createVaultApi,
  getHttpStatus,
  reconcileVaultWithServer,
} from '@myorganizer/web-vault';

import { useOptionalVaultSession } from './session';
import { NO_REVISION } from './useLocalVaultRevision';
import { vaultBlobTypeLabel } from './vaultSyncMessages';

type PendingVaultConflictPrompt = {
  ask: VaultReconcileAsk;
  resolve: (decision: VaultReconcileDecision) => void;
};

/**
 * The two answers, worded the same however the question was raised.
 *
 * A User is choosing between the same two sides every time, so the buttons say
 * the same thing every time — only what is at stake changes.
 */
const KEEP_LOCAL_LABEL = "Keep this device's data";
const KEEP_REMOTE_LABEL = "Keep the server's data";

/**
 * What a User is told when reconcile has to ask.
 *
 * Written here rather than in `@myorganizer/web-vault` for the reason
 * `vaultSyncMessages.ts` gives, and beside its runner for the reason
 * `metaConvergeRunner.tsx` keeps its copy beside its own: the library that
 * decides what happened carries no English, and the component that shows a
 * User owns naming it.
 */
type VaultReconcilePromptCopy = {
  title: string;
  lead: string;
  body: string[];
};

/** Why one Vault Blob Type asked, read off the ask rather than listed again. */
type VaultReconcileBlobAskReason = Extract<
  VaultReconcileAsk,
  { kind: 'blob' }
>['reason'];

/**
 * How each per-type question is worded, keyed by why it was asked.
 *
 * `satisfies` is the guard: a third reason added to the primitive fails to
 * compile here until somebody decides what a User is told about it, rather
 * than silently inheriting whichever branch an `else` happened to be — the
 * shape ADR 0053 exists to keep out of fan-outs like this one.
 */
const VAULT_BLOB_ASK_COPY = {
  strategy: (name) => ({
    title: `Choose which ${name.toLowerCase()} to keep`,
    lead: `${name} changed on this device and on the server, and this data is not combined automatically.`,
    body: [
      `Keeping this device's data uploads the ${name.toLowerCase()} on this device over the copy on the server. Keeping the server's data replaces the copy on this device.`,
      'Nothing else in your vault is affected either way.',
    ],
  }),
  'undecryptable-local': (name) => ({
    title: `${name} cannot be read on this device`,
    lead: `The ${name.toLowerCase()} stored on this device cannot be opened, so they cannot be combined with the copy on the server.`,
    body: [
      `Keeping the server's data replaces the unreadable copy on this device. Keeping this device's data uploads it as it is, and it stays unreadable here.`,
      'Nothing else in your vault is affected either way.',
    ],
  }),
} as const satisfies Record<
  VaultReconcileBlobAskReason,
  (name: string) => VaultReconcilePromptCopy
>;

function describeAsk(ask: VaultReconcileAsk): VaultReconcilePromptCopy {
  if (ask.kind === 'vault') {
    return {
      title: 'This vault is not the one on the server',
      lead: "The encrypted data on the server cannot be opened with this device's vault, so the two cannot be combined.",
      body: [
        "Keeping this device's data replaces the copy on the server.",
        // Blunt on purpose. Taking the server's Ciphertext carries this
        // device's wrapping across unchanged (ADR 0057), so data encrypted
        // under another vault's Master Key lands here unreadable — and no
        // answer given to this dialog changes that.
        "Keeping the server's data replaces the copy on this device with data this device cannot open. Only choose it if you no longer need what is stored here.",
      ],
    };
  }

  return VAULT_BLOB_ASK_COPY[ask.reason](vaultBlobTypeLabel(ask.type));
}

type VaultReconcileToast = { title: string; description: string };

/** Whether the pass moved Ciphertext on either side. */
function reconcileChangedSomething(result: VaultReconcileResult): boolean {
  if (result.kind !== 'reconciled') return false;

  return result.converged.some(({ outcome }) => {
    switch (outcome.kind) {
      case 'nothing':
        return false;
      case 'asked':
        return outcome.decision !== 'defer';
      case 'sent':
      case 'took':
      case 'merged':
        return true;
    }
  });
}

/**
 * What a User is told a completed pass did, keyed by what the two sides held
 * when it began. Pinned for the same reason the ask copy above is.
 *
 * `both` is the only one that can be silent: a sign-in where nothing moved is
 * not news, and saying so would add chrome to every sign-in.
 */
const VAULT_RECONCILE_START_TOAST = {
  'downloaded-server-wrapping': () => ({
    title: 'Vault synced',
    description: 'Downloaded your server vault to this device.',
  }),
  'uploaded-local-wrapping': () => ({
    title: 'Vault synced',
    description: 'Your encrypted vault is now backed up to the server.',
  }),
  both: (result) =>
    reconcileChangedSomething(result)
      ? {
          title: 'Vault updated',
          description:
            'This device and the server now hold the same vault data.',
        }
      : null,
} as const satisfies Record<
  VaultReconcileStart,
  (result: VaultReconcileResult) => VaultReconcileToast | null
>;

function describeReconcileToast(
  result: VaultReconcileResult,
): VaultReconcileToast | null {
  if (result.kind !== 'reconciled') return null;

  return VAULT_RECONCILE_START_TOAST[result.start](result);
}

function getUserFacingErrorMessage(error: unknown): string {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) {
    return 'Please sign in and try again.';
  }
  if (status === 409) {
    return 'Your vault changed on another device. Reload and try again.';
  }
  if (status && status >= 500) {
    return 'Server error while syncing your vault. Please try again later.';
  }
  if (status) {
    return `Vault sync failed (HTTP ${status}). Your local data is unchanged.`;
  }

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? error.message
      : undefined;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return 'Could not sync your vault. Your local data is unchanged.';
}

/**
 * Runs Vault Reconcile: on mount, and again whenever the Local Vault Revision
 * moves above the revision the last pass settled at.
 *
 * The trigger is the revision rather than the removal that prompted it
 * ([#628](https://github.com/mnaimfaizy/myorganizer/issues/628)). A removal, an
 * import and a convergence-replacement all leave this device holding something
 * other than what it held a moment ago, all three already move the revision,
 * and a fourth door added later moves it without having to remember this runner
 * exists.
 *
 * It takes no focus trigger. What changed on the server for Vault Blobs is
 * `VaultPullRunner`'s question, and asking it a second time from a runner that
 * may raise a dialog is how a background pass starts interrupting people
 * ([ADR 0066](../../../../docs/adr/0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md),
 * decision point 2).
 */
export function VaultReconcileRunner() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const pendingPromptRef = useRef<PendingVaultConflictPrompt | null>(null);
  const [pendingPrompt, setPendingPrompt] =
    useState<PendingVaultConflictPrompt | null>(null);

  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const owner = handle?.owner ?? null;
  // Read as a store and not through `useLocalVaultRevision`, which is the hook
  // for a page that must re-render. This runner must not: a bump arriving mid
  // pass would re-run an effect keyed on the revision, and its cleanup would
  // cancel the very pass that caused the bump.
  const revision = vaultSession?.revision ?? null;
  // Mirrors toastRef: keeps the effect below off `handle`, so a lock/unlock —
  // which changes the handle's identity but not its owner — never tears down a
  // pass that is already in flight. Read per pass rather than captured once, so
  // a later pass is not still holding the handle that existed at mount.
  const handleRef = useRef(handle);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    handleRef.current = handle;
  }, [handle]);

  useEffect(() => {
    let cancelled = false;

    if (typeof window === 'undefined') return;
    if (!owner) return;

    const api = createVaultApi();

    /**
     * The Local Vault Revision this runner last settled at, and the whole of
     * why the revision trigger is not an infinite loop.
     *
     * Reconcile writes through `VaultHandle.saveVault` — taking the server's
     * Ciphertext does, and so does downloading the server's wrapping onto a
     * device holding no Local Vault — and every one of those writes bumps the
     * revision this runner listens to. Recorded when a pass *settles* rather
     * than when it starts, so those bumps are already in the number by the time
     * it is read: the question being answered is "has anything changed since I
     * finished", which is what the revision already answers. Tracking which
     * writes were this runner's own would answer a different question and would
     * go wrong the moment something else wrote during a pass.
     *
     * What that costs, said plainly: a write by something else that lands while
     * a pass is running is inside the number this reads, so it raises no pass of
     * its own and is picked up by the next replacement or the next mount. There
     * is no third option — telling that write apart from this runner's own is
     * the self-write tracking above, and re-running on it unconditionally is the
     * loop the watermark exists to stop.
     *
     * `null` until the first pass settles, so mount always runs one.
     */
    let settledAt: number | null = null;
    /** Passes are serialised: a second one would race the first over the same types. */
    let inFlight = false;

    const currentRevision = () => revision?.current() ?? NO_REVISION;

    const runPass = () => {
      const currentHandle = handleRef.current;
      if (!currentHandle) return;

      inFlight = true;

      reconcileVaultWithServer({
        api,
        // Convergence reads and writes the Local Vault itself, so the handle
        // goes in and no next Local Vault comes back out.
        handle: currentHandle,
        prompt: async (ask) => {
          if (cancelled) return 'defer';

          return new Promise<VaultReconcileDecision>((resolve) => {
            const nextPrompt = { ask, resolve };
            pendingPromptRef.current = nextPrompt;
            setPendingPrompt(nextPrompt);
          });
        },
      })
        .then((result) => {
          if (cancelled) return;

          const message = describeReconcileToast(result);
          if (message) toastRef.current(message);
        })
        .catch((e: unknown) => {
          if (cancelled) return;

          // ADR 0066's fifth decision silences a failed *background* pass,
          // because a server down for a minute would otherwise toast on every
          // focus event about a failure that is about to be retried. Nothing
          // here runs on a focus event or a timer: the triggers are a mount and
          // a replacement the User asked for, so a failure is still rare enough
          // that a word about it is honest. Give this runner an ambient trigger
          // and that stops being true — the toast goes with it.
          toastRef.current({
            title: 'Vault sync failed',
            description: getUserFacingErrorMessage(e),
            variant: 'destructive',
          });
        })
        .finally(() => {
          inFlight = false;
          // A failed pass settles too. Nothing has changed since it looked, and
          // the next replacement moves the revision past this and asks again —
          // where leaving the watermark behind would re-run the pass on the
          // partial convergence its own failure left, over and over.
          settledAt = currentRevision();
        });
    };

    const requestPass = () => {
      if (cancelled) return;
      if (inFlight) return;
      // A dismissed question is unfinished business, and it comes back the way
      // every other pass arrives: the next mount, or the next replacement. It
      // is not brought back by withholding the watermark, which would re-ask
      // the moment the same pass converged anything else.
      if (settledAt !== null && currentRevision() <= settledAt) return;

      runPass();
    };

    requestPass();
    const unsubscribe = revision?.subscribe(requestPass);

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (pendingPromptRef.current) {
        pendingPromptRef.current.resolve('defer');
        pendingPromptRef.current = null;
      }
    };
  }, [owner, revision]);

  function resolvePendingPrompt(decision: VaultReconcileDecision) {
    const prompt = pendingPromptRef.current;
    if (!prompt) return;

    pendingPromptRef.current = null;
    setPendingPrompt(null);
    prompt.resolve(decision);
  }

  if (!pendingPrompt) return null;

  const copy = describeAsk(pendingPrompt.ask);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Escape and overlay clicks land here. Dismissing is a deliberate
        // no-op — neither copy is touched — so it must never be read as
        // consent to overwrite one of them (ADR 0033).
        if (!open) resolvePendingPrompt('defer');
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.lead}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-md border bg-muted/30 p-3 text-foreground">
            {copy.body.map((line) => (
              <p key={line} className="first:mt-0 mt-2">
                {line}
              </p>
            ))}
          </div>
          <p>
            Closing this dialog changes nothing on either side, and we will ask
            again.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => resolvePendingPrompt('keep-remote')}
          >
            {KEEP_REMOTE_LABEL}
          </Button>
          <Button
            type="button"
            onClick={() => resolvePendingPrompt('keep-local')}
          >
            {KEEP_LOCAL_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
