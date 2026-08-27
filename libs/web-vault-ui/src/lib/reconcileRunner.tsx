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

import type { ReconcileDecision } from '@myorganizer/web-vault';
import {
  createVaultApi,
  getHttpStatus,
  reconcileVaultWithServer,
} from '@myorganizer/web-vault';

import { useOptionalVaultSession } from './session';

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
  message: string;
  resolve: (decision: ReconcileDecision) => void;
};

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
    const localVault = currentHandle.loadVault();

    reconcileVaultWithServer({
      api,
      localVault,
      prompt: async ({ message }) => {
        if (cancelled) return 'keep-server';

        return new Promise<ReconcileDecision>((resolve) => {
          const nextPrompt = { message, resolve };
          pendingPromptRef.current = nextPrompt;
          setPendingPrompt(nextPrompt);
        });
      },
    })
      .then((result) => {
        if (cancelled) return;

        if (result.kind !== 'skipped-not-authenticated') {
          window.sessionStorage.setItem(sessionFlag, '1');
        }

        if (result.kind === 'downloaded-server-to-local') {
          currentHandle.saveVault(result.nextLocalVault);
          toastRef.current({
            title: 'Vault synced',
            description: 'Downloaded your server vault to this device.',
          });
        } else if (result.kind === 'uploaded-local-to-server') {
          toastRef.current({
            title: 'Vault synced',
            description: 'Your encrypted vault is now backed up to the server.',
          });
        } else if (result.kind === 'kept-server-overwrote-local') {
          currentHandle.saveVault(result.nextLocalVault);
          toastRef.current({
            title: 'Vault updated',
            description: 'Using the server vault on this device.',
          });
        } else if (result.kind === 'kept-local-overwrote-server') {
          toastRef.current({
            title: 'Vault updated',
            description:
              'Your local vault was kept and uploaded to the server.',
          });
        }
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
        pendingPromptRef.current.resolve('keep-server');
        pendingPromptRef.current = null;
      }
    };
  }, [owner]);

  function resolvePendingPrompt(decision: ReconcileDecision) {
    const prompt = pendingPromptRef.current;
    if (!prompt) return;

    pendingPromptRef.current = null;
    setPendingPrompt(null);
    prompt.resolve(decision);
  }

  return (
    <Dialog
      open={Boolean(pendingPrompt)}
      onOpenChange={(open) => {
        if (!open) resolvePendingPrompt('keep-server');
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Choose vault data to keep</DialogTitle>
          <DialogDescription>{pendingPrompt?.message}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Your data is different on this device and on the server.</p>
          <div className="rounded-md border bg-muted/30 p-3 text-foreground">
            <p>
              <span className="font-medium">OK</span> keeps the encrypted data
              on this device and replaces the copy on the server.
            </p>
            <p className="mt-2">
              <span className="font-medium">Cancel</span> keeps the encrypted
              data from the server and replaces the copy on this device.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => resolvePendingPrompt('keep-server')}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => resolvePendingPrompt('keep-local')}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
