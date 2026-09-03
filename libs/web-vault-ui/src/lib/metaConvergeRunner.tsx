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
  VaultMetaRefusalLifetime,
} from '@myorganizer/web-vault';
import {
  createVaultApi,
  getHttpStatus,
  settleVaultMeta,
} from '@myorganizer/web-vault';

import { useOptionalVaultSession } from './session';

/**
 * What answering the dialog records, per answer.
 *
 * `keep-local` is an answer, so it holds until the wrapping changes again;
 * `defer` is "not now", so it holds until the tab closes; `adopt-remote`
 * refuses nothing and records nothing. Pinned rather than branched on, so a
 * fourth answer cannot be added without somebody saying what declining under it
 * would mean ([ADR 0053](../../../../../docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)).
 *
 * All three write nothing to the Vault: no wrapping is adopted and no
 * Ciphertext is touched by any of them (ADR 0057 and its amendment).
 */
const VAULT_META_REFUSAL_LIFETIME_BY_DECISION = {
  'adopt-remote': null,
  'keep-local': 'durable',
  defer: 'session',
} as const satisfies Record<VaultMetaDecision, VaultMetaRefusalLifetime | null>;

type VaultMetaChangeCopy = {
  title: string;
  lead: string;
  keepLabel: string;
  keepExplainer: string;
  securityLine: string;
  toastErrorTitle: string;
  /**
   * Present only where adopting the server's wrapping is a safe thing to
   * offer — which is where both sides hold the same Master Key. Null is not a
   * missing string: it is the statement that this dialog has one answer, and
   * it is why the primary button is absent rather than merely disabled.
   */
  adopt: {
    label: string;
    explainer: string;
    toastTitle: string;
    toastDescription: string;
  } | null;
};

const VAULT_META_CHANGE_COPY = {
  'different-vault': {
    title: 'This device holds a different vault',
    lead: 'The vault on the server was created separately from the one on this device.',
    keepLabel: 'Keep this device’s vault',
    keepExplainer:
      'leaves this device exactly as it is. Your data here stays readable, and nothing on the server changes.',
    securityLine:
      'The two vaults have different keys, so neither one can open the other’s data. This device cannot start using the server’s vault without losing what is stored here — to move to it deliberately, remove this vault from the Vault page first, then sign in with the passphrase that vault was created with.',
    toastErrorTitle: 'Vault check failed',
    adopt: null,
  },
  passphrase: {
    title: 'Your passphrase was changed on another device',
    lead: 'Start using the new passphrase on this device?',
    keepLabel: 'Keep my current passphrase',
    keepExplainer: 'leaves this device unlocking the way it does now.',
    securityLine:
      'If you did not change your passphrase, someone else may have. Stop using the old one and review your account.',
    toastErrorTitle: 'Passphrase check failed',
    adopt: {
      label: 'Use the new passphrase',
      explainer:
        'means you will unlock this device with the passphrase you set on your other device. Your data is unchanged either way.',
      toastTitle: 'Passphrase updated',
      toastDescription:
        'This device now uses the passphrase set on your other device.',
    },
  },
  'recovery-key': {
    title: 'Your recovery key was changed on another device',
    lead: 'Start using the new recovery key on this device?',
    keepLabel: 'Keep my current recovery key',
    keepExplainer: 'leaves this device recovering the way it does now.',
    securityLine:
      'If you did not change your recovery key, someone else may have. Review your account.',
    toastErrorTitle: 'Recovery key check failed',
    adopt: {
      label: 'Use the new recovery key',
      explainer:
        'means you will recover this device with the recovery key you set on your other device. Your data is unchanged either way.',
      toastTitle: 'Recovery key updated',
      toastDescription:
        'This device now uses the recovery key set on your other device.',
    },
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
  // re-triggers a converge that's already in flight.
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

    const api = createVaultApi();

    // Settle rather than converge: a wrapping this device changed and could
    // not push looks exactly like one changed elsewhere, so asking before
    // pushing would tell the User their own change came from another device
    // and offer them a button that reverts it. `settleVaultMeta` pushes what
    // this device owes first, and only then asks about what is left.
    settleVaultMeta({
      api,
      handle: currentHandle,
      prompt: async ({ change, remote }) => {
        if (cancelled) return 'defer';

        // What is rationed is interrupting the User, and it is rationed by the
        // wrapping asked about rather than by the fact that asking happened
        // (ADR 0066). A wrapping this device has already declined raises
        // nothing; a genuinely different one still asks, which a flag recording
        // that a question was once put could not tell apart.
        //
        // A refused wrapping settles as `defer` because that is the truthful
        // one of the three: nothing was written, on either side, and the
        // question is still open — it is only not being put again yet.
        if (
          await currentHandle.isVaultMetaRefused({ meta: remote.meta, change })
        ) {
          return 'defer';
        }

        const decision = await new Promise<VaultMetaDecision>((resolve) => {
          const nextPrompt = { change, resolve };
          pendingPromptRef.current = nextPrompt;
          setPendingPrompt(nextPrompt);
        });

        // Unmounting resolves a pending prompt with `defer` so the pass can
        // settle. That is this component going away, not a User declining, and
        // recording it would silence a question nobody was ever answered.
        if (cancelled) return 'defer';

        const lifetime = VAULT_META_REFUSAL_LIFETIME_BY_DECISION[decision];
        if (lifetime) {
          await currentHandle.recordVaultMetaRefusal({
            meta: remote.meta,
            change,
            lifetime,
          });
        }

        return decision;
      },
    })
      .then((result) => {
        if (cancelled) return;

        const converged = result.kind === 'converged' ? result.result : null;

        if (converged?.kind === 'adopted-remote') {
          currentHandle.saveVault(converged.nextLocalVault);
          const adopted = VAULT_META_CHANGE_COPY[converged.change].adopt;
          // A change with no adopt copy is one the library refuses to adopt,
          // so reaching here with none would mean the dialog offered an
          // action the library would not carry out.
          if (adopted) {
            toastRef.current({
              title: adopted.toastTitle,
              description: adopted.toastDescription,
            });
          }
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;

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
        // consent to overwrite the wrapping (ADR 0033). It records a
        // session-scoped Vault Meta Refusal above, which is bookkeeping about
        // the question and not a write to either side.
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
            {copy.adopt && (
              <p>
                <span className="font-medium">{copy.adopt.label}</span>{' '}
                {copy.adopt.explainer}
              </p>
            )}
            <p className={copy.adopt ? 'mt-2' : undefined}>
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
            // The only answer for a change that cannot be adopted, so it
            // stops being the secondary one.
            variant={copy.adopt ? 'outline' : 'default'}
            onClick={() => resolvePendingPrompt('keep-local')}
          >
            {copy.keepLabel}
          </Button>
          {copy.adopt && (
            <Button
              type="button"
              onClick={() => resolvePendingPrompt('adopt-remote')}
            >
              {copy.adopt.label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
