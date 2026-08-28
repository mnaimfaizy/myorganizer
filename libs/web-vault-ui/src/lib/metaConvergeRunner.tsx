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
  VaultMetaChange,
  VaultMetaDecision,
} from '@myorganizer/web-vault';
import {
  convergeVaultMeta,
  createVaultApi,
  getHttpStatus,
} from '@myorganizer/web-vault';

import { useOptionalVaultSession } from './session';

const SESSION_FLAG_PREFIX = 'myorganizer_vault_meta_converge_ran_v1';

/**
 * Scoped per User: a second User signing into the same tab Session must
 * still converge their own Local Vault metadata against their server metadata,
 * even after the first User's converge already ran in this Session.
 */
function sessionFlagFor(owner: string): string {
  return `${SESSION_FLAG_PREFIX}:${owner}`;
}

type VaultMetaChangeCopy = {
  title: string;
  lead: string;
  adoptLabel: string;
  keepLabel: string;
  adoptExplainer: string;
  keepExplainer: string;
  securityLine: string;
  toastTitle: string;
  toastDescription: string;
  toastErrorTitle: string;
};

const VAULT_META_CHANGE_COPY = {
  passphrase: {
    title: 'Your passphrase was changed on another device',
    lead: 'Start using the new passphrase on this device?',
    adoptLabel: 'Use the new passphrase',
    keepLabel: 'Keep my current passphrase',
    adoptExplainer:
      'means you will unlock this device with the passphrase you set on your other device. Your data is unchanged either way.',
    keepExplainer: 'leaves this device unlocking the way it does now.',
    securityLine:
      'If you did not change your passphrase, someone else may have. Stop using the old one and review your account.',
    toastTitle: 'Passphrase updated',
    toastDescription:
      'This device now uses the passphrase set on your other device.',
    toastErrorTitle: 'Passphrase check failed',
  },
  'recovery-key': {
    title: 'Your recovery key was changed on another device',
    lead: 'Start using the new recovery key on this device?',
    adoptLabel: 'Use the new recovery key',
    keepLabel: 'Keep my current recovery key',
    adoptExplainer:
      'means you will recover this device with the recovery key you set on your other device. Your data is unchanged either way.',
    keepExplainer: 'leaves this device recovering the way it does now.',
    securityLine:
      'If you did not change your recovery key, someone else may have. Review your account.',
    toastTitle: 'Recovery key updated',
    toastDescription:
      'This device now uses the recovery key set on your other device.',
    toastErrorTitle: 'Recovery key check failed',
  },
} as const satisfies Record<VaultMetaChange, VaultMetaChangeCopy>;

type PendingVaultMetaPrompt = {
  change: VaultMetaChange;
  resolve: (decision: VaultMetaDecision) => void;
};

function getUserFacingErrorMessage(error: unknown): string {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) {
    return 'Please sign in and try again.';
  }
  if (status && status >= 500) {
    return 'Server error while checking your vault keys. Please try again later.';
  }
  if (status) {
    return `Vault key check failed (HTTP ${status}). Your local data is unchanged.`;
  }

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? error.message
      : undefined;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return 'Could not check your vault keys. Your local data is unchanged.';
}

export function VaultMetaConvergeRunner() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const pendingPromptRef = useRef<PendingVaultMetaPrompt | null>(null);
  const [pendingPrompt, setPendingPrompt] =
    useState<PendingVaultMetaPrompt | null>(null);

  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const owner = handle?.owner ?? null;
  // Mirrors toastRef: keeps the effect below keyed on `owner` alone so a
  // lock/unlock (which changes `handle`'s identity but not its owner) never
  // re-triggers a converge that's already in flight or already ran.
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

    convergeVaultMeta({
      api,
      localVault,
      prompt: async ({ change }) => {
        if (cancelled) return 'defer';

        return new Promise<VaultMetaDecision>((resolve) => {
          const nextPrompt = { change, resolve };
          pendingPromptRef.current = nextPrompt;
          setPendingPrompt(nextPrompt);
        });
      },
    })
      .then((result) => {
        if (cancelled) return;

        // A deferred change is unfinished business, not a completed
        // converge: leaving the flag unset is what brings the choice back
        // instead of stranding the User's divergence unresolved.
        if (
          result.kind !== 'skipped-not-authenticated' &&
          result.kind !== 'noop-deferred'
        ) {
          window.sessionStorage.setItem(sessionFlag, '1');
        }

        if (result.kind === 'adopted-remote') {
          currentHandle.saveVault(result.nextLocalVault);
          const copy = VAULT_META_CHANGE_COPY[result.change];
          toastRef.current({
            title: copy.toastTitle,
            description: copy.toastDescription,
          });
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        window.sessionStorage.setItem(sessionFlag, '1');

        const errorTitle = pendingPromptRef.current
          ? VAULT_META_CHANGE_COPY[pendingPromptRef.current.change]
              .toastErrorTitle
          : 'Vault key check failed';

        toastRef.current({
          title: errorTitle,
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

  function resolvePendingPrompt(decision: VaultMetaDecision) {
    const prompt = pendingPromptRef.current;
    if (!prompt) return;

    pendingPromptRef.current = null;
    setPendingPrompt(null);
    prompt.resolve(decision);
  }

  if (!pendingPrompt) {
    return null;
  }

  const copy = VAULT_META_CHANGE_COPY[pendingPrompt.change];

  return (
    <Dialog
      open={Boolean(pendingPrompt)}
      onOpenChange={(open) => {
        // Escape and overlay clicks land here. Dismissing is a deliberate
        // no-op — neither copy is touched — so it must never be read as
        // consent to overwrite the wrapping (ADR 0033).
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
            <p>
              <span className="font-medium">{copy.adoptLabel}</span>{' '}
              {copy.adoptExplainer}
            </p>
            <p className="mt-2">
              <span className="font-medium">{copy.keepLabel}</span>{' '}
              {copy.keepExplainer}
            </p>
          </div>
          <p>{copy.securityLine}</p>
          <p>
            Closing this dialog changes nothing on either side, and we will ask
            again.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => resolvePendingPrompt('keep-local')}
          >
            {copy.keepLabel}
          </Button>
          <Button
            type="button"
            onClick={() => resolvePendingPrompt('adopt-remote')}
          >
            {copy.adoptLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
