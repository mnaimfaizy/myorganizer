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
import { vaultBlobTypeLabel } from './vaultSyncMessages';

const SESSION_FLAG_PREFIX = 'myorganizer_vault_reconcile_ran_v1';

/**
 * Scoped per User: a second User signing into the same tab Session must
 * still reconcile their own Local Vault against their server Ciphertext,
 * even after the first User's reconcile already ran in this Session.
 */
function sessionFlagFor(owner: string): string {
  return `${SESSION_FLAG_PREFIX}:${owner}`;
}

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

export function VaultReconcileRunner() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const pendingPromptRef = useRef<PendingVaultConflictPrompt | null>(null);
  const [pendingPrompt, setPendingPrompt] =
    useState<PendingVaultConflictPrompt | null>(null);

  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const owner = handle?.owner ?? null;
  // Mirrors toastRef: keeps the effect below keyed on `owner` alone so a
  // lock/unlock (which changes `handle`'s identity but not its owner) never
  // re-triggers a reconcile that's already in flight or already ran.
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

    const currentHandle = handleRef.current;
    if (!currentHandle) return;

    const sessionFlag = sessionFlagFor(owner);
    if (window.sessionStorage.getItem(sessionFlag)) return;

    const api = createVaultApi();

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

        // A deferred prompt is unfinished business, not a completed
        // reconcile: leaving the flag unset is what brings the choice back
        // instead of stranding the User's divergence unresolved.
        const deferred = result.kind === 'reconciled' && result.deferred;
        if (result.kind !== 'skipped-not-authenticated' && !deferred) {
          window.sessionStorage.setItem(sessionFlag, '1');
        }

        const message = describeReconcileToast(result);
        if (message) toastRef.current(message);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        window.sessionStorage.setItem(sessionFlag, '1');

        toastRef.current({
          title: 'Vault sync failed',
          description: getUserFacingErrorMessage(e),
          variant: 'destructive',
        });
      });

    return () => {
      cancelled = true;
      if (pendingPromptRef.current) {
        pendingPromptRef.current.resolve('defer');
        pendingPromptRef.current = null;
      }
    };
  }, [owner]);

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
