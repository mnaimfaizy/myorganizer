'use client';

import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Input,
  Label,
  useToast,
} from '@myorganizer/web-ui';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  type LocalVaultStatus,
  type VaultHandle,
  MIN_PASSPHRASE_LENGTH,
  VaultSecretMismatchError,
  claimUnclaimedLocalVaultWithRecoveryKey,
  createDefaultAuditReporter,
  createVaultApi,
  exportVault,
  newPassphraseSchema,
  replaceOwnedLocalVaultOnEvidence,
  replaceOwnedLocalVaultWithRecoveryKey,
  resetPassphraseAfterRecovery,
} from '@myorganizer/web-vault';

import {
  RecoveryKeyClaimOffer,
  type RecoveryKeyClaimAnswer,
} from './RecoveryKeyClaimOffer';
import { useOptionalVaultSession } from './session';
import { useVaultClaimEvidence } from './useVaultClaimEvidence';
import { VAULT_CLAIM_EVIDENCE_GATE_VIEWS } from './vaultClaimEvidenceGateView';
import { VaultReplaceOffer } from './VaultReplaceOffer';

type VaultGateProps = {
  title: string;
  children: (ctx: { handle: VaultHandle | null }) => React.ReactNode;
};

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename: string, content: string) {
  downloadFile(filename, content, 'text/plain');
}

function downloadJsonFile(filename: string, content: string) {
  downloadFile(filename, content, 'application/json');
}

export function VaultGate(props: VaultGateProps) {
  const { toast } = useToast();

  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;

  const [vaultStatus, setVaultStatus] = useState<LocalVaultStatus>(
    () => handle?.vaultStatus() ?? 'absent',
  );

  // Vault Claim Evidence runs for every signed-in User and costs nothing for
  // the ones it does not apply to — a User who already holds their own Local
  // Vault is answered without the server being asked at all.
  const claimEvidence = useVaultClaimEvidence(handle);

  const handleRef = useRef(handle);

  // Render-phase reset: if handle identity changes, re-read status from storage
  let currentVaultStatus = vaultStatus;
  if (handleRef.current !== handle) {
    handleRef.current = handle;
    currentVaultStatus = handle?.vaultStatus() ?? 'absent';
    setVaultStatus(currentVaultStatus);
  }
  const [localMasterKeyBytes, setLocalMasterKeyBytes] =
    useState<Uint8Array | null>(null);

  type PendingReplace =
    | { source: 'server-meta' }
    | { source: 'recovery-key'; recoveryKey: string };

  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(
    null,
  );
  const [dismissedServerMetaOffer, setDismissedServerMetaOffer] =
    useState(false);

  const masterKeyBytes = vaultSession?.masterKeyBytes ?? localMasterKeyBytes;
  const setMasterKeyBytes =
    vaultSession?.setMasterKeyBytes ?? setLocalMasterKeyBytes;

  const [setupPassphrase, setSetupPassphrase] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  const [passphrase, setPassphrase] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');

  const [newPassphrase, setNewPassphraseState] = useState('');
  const [newPassphraseConfirm, setNewPassphraseConfirm] = useState('');

  const isUnlocked = masterKeyBytes !== null;

  // The automatic (server-meta) replace offer has no explicit `pendingReplace`
  // of its own — `useVaultClaimEvidence` settling to `replace-offer` *is* the
  // offer, with nothing for the User to have supplied first. `pendingReplace`
  // only ever holds the recovery-key source, whose secret has to be carried
  // from the moment it was typed through to the confirm step. Deriving the
  // automatic source here, rather than writing it into `pendingReplace` via an
  // effect, keeps a `replace-offer` answer that arrives mid-render authoritative
  // without a render where the callbacks and the screen briefly disagree about
  // what is on offer.
  const autoOfferActive =
    currentVaultStatus === 'owned' &&
    !pendingReplace &&
    claimEvidence.status === 'settled' &&
    claimEvidence.result.kind === 'replace-offer' &&
    !dismissedServerMetaOffer;

  const effectivePendingReplace: PendingReplace | null = useMemo(
    () =>
      pendingReplace ?? (autoOfferActive ? { source: 'server-meta' } : null),
    [pendingReplace, autoOfferActive],
  );

  /**
   * The deliberate half of Vault Claim Evidence: the User says they hold a
   * recovery key for a Vault here, and supplies one.
   *
   * Every answer other than a claim is folded into one, including there being
   * no signed-in User to claim for. The offer is rendered whether or not this
   * device holds an Unclaimed Local Vault, so an answer a User could tell
   * apart from "nothing here" would disclose the one bit the offer exists to
   * withhold (CONTEXT.md, "Claim Offer").
   */
  const claimWithRecoveryKey = async (
    key: string,
  ): Promise<RecoveryKeyClaimAnswer> => {
    // Answered without the library, and so without the decoy unwrap it would
    // have paid for. That asymmetry is timeable and deliberately left: the
    // only thing it tells whoever measured it is that they are not signed in,
    // which they knew before they typed. It says nothing about this device.
    if (!handle) return 'no-match';

    const result = await claimUnclaimedLocalVaultWithRecoveryKey({
      handle,
      recoveryKey: key,
    });

    if (result.kind === 'replace-offer') {
      // Evidence proved this Unclaimed Local Vault is also the signed-in User's,
      // but they already hold a Vault of their own here. Offer the explicit replace.
      setPendingReplace({ source: 'recovery-key', recoveryKey: key });
      return 'replace-offer';
    }

    if (result.kind !== 'claimed') return 'no-match';

    // Claimed and unlocked in one step: the evidence was the key, so there is
    // nothing further to ask for. The status is advanced too, so that locking
    // later lands on this User's own unlock screen rather than back on setup.
    setVaultStatus('owned');
    setMasterKeyBytes(result.masterKeyBytes);
    toast({
      title: 'Vault claimed',
      description: 'This vault is yours and is unlocked on this device.',
    });
    return 'claimed';
  };

  const exportVaultAboutToBeReplaced = useCallback(async (): Promise<void> => {
    if (!handle) return;
    const localVault = handle.loadVault();
    if (!localVault) return;
    const { text } = await exportVault({
      localVault,
      source: 'local-file',
      auditReporter: createDefaultAuditReporter(undefined, { strict: true }),
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJsonFile(
      `myorganizer-vault-about-to-be-replaced-${stamp}.json`,
      text,
    );
  }, [handle]);

  const confirmReplace = useCallback(async (): Promise<void> => {
    if (!handle || !effectivePendingReplace) return;

    const isRecoveryKeySource =
      effectivePendingReplace.source === 'recovery-key';

    if (isRecoveryKeySource) {
      const result = await replaceOwnedLocalVaultWithRecoveryKey({
        handle,
        recoveryKey: effectivePendingReplace.recoveryKey,
      });
      if (result.kind !== 'replaced') {
        toast({
          title: 'Replace failed',
          description:
            'That recovery key no longer matches. Nothing was changed.',
          variant: 'destructive',
        });
        setPendingReplace(null);
        return;
      }
      setMasterKeyBytes(result.masterKeyBytes);
    } else {
      const result = replaceOwnedLocalVaultOnEvidence({ handle });
      if (result.kind !== 'replaced') {
        toast({
          title: 'Replace failed',
          description: 'Nothing was changed.',
          variant: 'destructive',
        });
        setPendingReplace(null);
        return;
      }
    }

    setVaultStatus('owned');
    setPendingReplace(null);

    // Only mark the server-meta offer as dismissed if it was actually used
    if (!isRecoveryKeySource) {
      setDismissedServerMetaOffer(true);
    }

    toast({
      title: 'Vault replaced',
      description: 'This device now uses the other vault that was also yours.',
    });
  }, [handle, effectivePendingReplace, setMasterKeyBytes, toast]);

  const declineReplace = useCallback((): void => {
    if (pendingReplace) {
      // Decline the recovery-key offer; don't touch the server-meta dismissal state
      setPendingReplace(null);
    } else {
      // Decline the server-meta offer
      setDismissedServerMetaOffer(true);
    }
  }, [pendingReplace]);

  const title = useMemo(() => props.title, [props.title]);

  if (isUnlocked && masterKeyBytes) {
    return (
      <>
        {props.children({
          handle: vaultSession?.handle ?? null,
        })}
      </>
    );
  }

  if (currentVaultStatus === 'owned') {
    if (effectivePendingReplace) {
      return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Card className="p-4">
            <CardTitle className="text-lg">
              {title}: Replace this device's vault?
            </CardTitle>
            <CardContent className="mt-4 space-y-4">
              <VaultReplaceOffer
                onExport={exportVaultAboutToBeReplaced}
                onConfirm={confirmReplace}
                onDecline={declineReplace}
              />
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // An Unclaimed Local Vault is never offered without proof it is the
  // signed-in User's (ADR 0061). Nothing about it is rendered until Vault
  // Claim Evidence has answered, and what the answer resolves to is pinned
  // rather than decided here.
  let effectiveVaultStatus = currentVaultStatus;
  if (currentVaultStatus === 'unclaimed') {
    if (claimEvidence.status === 'checking') {
      return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Card className="p-4">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardContent className="mt-4 space-y-4">
              {/* Says nothing about what this device holds — see the copy
                  note in `vaultClaimEvidenceGateView.ts`. */}
              <p className="text-sm text-muted-foreground">
                Setting up your vault on this device…
              </p>
              {/* The check that is still out is the server one, and a recovery
                  key needs no server — so the offer is available here for the
                  same reason it is on every other screen, and withholding it
                  until the check settles would time the offer's appearance to
                  whether this device holds a Vault. */}
              <RecoveryKeyClaimOffer onClaim={claimWithRecoveryKey} />
            </CardContent>
          </Card>
        </div>
      );
    }

    const view = VAULT_CLAIM_EVIDENCE_GATE_VIEWS[claimEvidence.result.kind];

    if (view.kind === 'cannot-check') {
      return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Card className="p-4">
            <CardTitle className="text-lg">{view.title}</CardTitle>
            <CardContent className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {view.description}
              </p>
              {/* A recovery key claim needs nothing from the server, so it stays
                  available on the one screen a User reaches because the server
                  could not be reached. Leaving it off here would make the
                  action's own availability a presence tell. */}
              <RecoveryKeyClaimOffer onClaim={claimWithRecoveryKey} />
            </CardContent>
          </Card>
        </div>
      );
    }

    if (view.kind === 'vault-status') {
      effectiveVaultStatus = view.status;
    }
  }

  if (effectiveVaultStatus !== 'owned') {
    const canCreate =
      newPassphraseSchema.safeParse({
        newPassphrase: setupPassphrase,
        newPassphraseConfirm: setupConfirm,
      }).success && recoveryKey === null;

    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card className="p-4">
          <CardTitle className="text-lg">
            {title}: Set encryption passphrase
          </CardTitle>
          <CardContent className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setup-passphrase">Encryption passphrase</Label>
              <Input
                id="setup-passphrase"
                type="password"
                value={setupPassphrase}
                onChange={(e) => setSetupPassphrase(e.target.value)}
                placeholder="Choose a strong passphrase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-confirm">Confirm passphrase</Label>
              <Input
                id="setup-confirm"
                type="password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                placeholder="Re-enter passphrase"
              />
              <p className="text-sm text-muted-foreground">
                Minimum {MIN_PASSPHRASE_LENGTH} characters. This passphrase
                never leaves your device.
              </p>
            </div>

            <Button
              disabled={!canCreate}
              onClick={async () => {
                if (!handle) {
                  toast({
                    title: 'Failed to create vault',
                    description: 'Sign in to create a vault.',
                    variant: 'destructive',
                  });
                  return;
                }
                try {
                  const result = await handle.initialize({
                    passphrase: setupPassphrase,
                  });
                  setRecoveryKey(result.recoveryKey);
                  toast({
                    title: 'Vault created',
                    description: 'Save your recovery key now.',
                  });
                } catch (e: unknown) {
                  toast({
                    title: 'Failed to create vault',
                    description: e instanceof Error ? e.message : String(e),
                    variant: 'destructive',
                  });
                }
              }}
            >
              Create encrypted vault
            </Button>

            {recoveryKey && (
              <div className="space-y-2">
                <Label>Recovery key (save this)</Label>
                <Input readOnly value={recoveryKey} />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      downloadTextFile(
                        'myorganiser-recovery-key.txt',
                        `MyOrganiser Recovery Key\n\n${recoveryKey}\n\nKeep this safe. Anyone with it can decrypt your vault.`,
                      );
                    }}
                  >
                    Download recovery key
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(recoveryKey);
                      toast({
                        title: 'Copied',
                        description: 'Recovery key copied',
                      });
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setVaultStatus('owned');
                      toast({
                        title: 'Next step',
                        description: 'Unlock your vault with your passphrase.',
                      });
                    }}
                  >
                    I saved it
                  </Button>
                </div>
              </div>
            )}

            {recoveryKey && (
              <p className="text-sm text-muted-foreground">
                Next time, unlock with your passphrase. If you forget it, you
                can recover with the recovery key.
              </p>
            )}

            {/* This screen is what a User sees both when this device holds
                nothing and when it holds an Unclaimed Local Vault nothing has
                proved theirs, so the offer sits here precisely because the two
                are the same screen. */}
            <RecoveryKeyClaimOffer onClaim={claimWithRecoveryKey} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (useRecovery) {
    const canRecover = recoveryInput.trim().length > 0;

    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card className="p-4">
          <CardTitle className="text-lg">{title}: Recover</CardTitle>
          <CardContent className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setUseRecovery(false)}
              >
                Use passphrase
              </Button>
              <Button type="button" variant="default">
                Forgot passphrase
              </Button>
            </div>

            {/* A User who is already `owned` here may also hold a recovery key
                for a second, unclaimed Vault on this device, and this is where
                they say so. */}
            <RecoveryKeyClaimOffer onClaim={claimWithRecoveryKey} />

            <div className="space-y-2">
              <Label htmlFor="recovery-key">Recovery key</Label>
              <Input
                id="recovery-key"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder="Paste your recovery key"
              />
            </div>

            <Button
              disabled={!canRecover}
              onClick={async () => {
                if (!handle) {
                  toast({
                    title: 'Recovery failed',
                    description: 'Sign in to recover a vault.',
                    variant: 'destructive',
                  });
                  return;
                }
                try {
                  const result = await handle.unlockWithRecoveryKey({
                    recoveryKey: recoveryInput.trim(),
                  });

                  setMasterKeyBytes(result.masterKeyBytes);
                  toast({
                    title: 'Recovered',
                    description: 'Vault unlocked with your recovery key.',
                  });
                } catch (e: unknown) {
                  if (e instanceof VaultSecretMismatchError) {
                    toast({
                      title: "That recovery key didn't unlock this vault",
                      description:
                        'The recovery key does not match this vault. Nothing was changed.',
                      variant: 'destructive',
                    });
                  } else {
                    toast({
                      title: 'Recovery failed',
                      description:
                        'Something went wrong. Nothing on this device was changed.',
                      variant: 'destructive',
                    });
                  }
                }
              }}
            >
              Unlock with recovery key
            </Button>

            <div className="space-y-2">
              <Label htmlFor="new-passphrase">Set a new passphrase</Label>
              <Input
                id="new-passphrase"
                type="password"
                value={newPassphrase}
                onChange={(e) => setNewPassphraseState(e.target.value)}
                placeholder="New passphrase"
              />
              <Input
                id="new-passphrase-confirm"
                type="password"
                value={newPassphraseConfirm}
                onChange={(e) => setNewPassphraseConfirm(e.target.value)}
                placeholder="Confirm new passphrase"
              />
            </div>

            <Button
              type="button"
              disabled={
                !masterKeyBytes ||
                !newPassphraseSchema.safeParse({
                  newPassphrase,
                  newPassphraseConfirm,
                }).success
              }
              onClick={async () => {
                if (!masterKeyBytes || !handle) return;

                try {
                  const result = await resetPassphraseAfterRecovery({
                    api: createVaultApi(),
                    handle,
                    newPassphrase,
                  });

                  // The local change has landed either way, so the User is
                  // let in either way. What differs is whether their other
                  // devices know — and a User who has just recovered from a
                  // passphrase they could not remember needs to hear that the
                  // old one still unlocks those devices. That is the reason
                  // they were rotating, not a sync detail.
                  // `noop-already-in-sync` is a success too: the server holds
                  // this wrapping, which is all the copy below claims.
                  const reachedServer =
                    result.push.kind === 'pushed' ||
                    result.push.kind === 'noop-already-in-sync';

                  toast(
                    reachedServer
                      ? {
                          title: 'Passphrase updated',
                          description:
                            'Your other devices will offer you the new passphrase next time you use them.',
                        }
                      : {
                          title: 'Passphrase updated on this device',
                          description:
                            'Your other devices still unlock with the old passphrase. This device will keep trying to tell them.',
                        },
                  );
                } catch (e: unknown) {
                  toast({
                    title: 'Failed',
                    description: e instanceof Error ? e.message : String(e),
                    variant: 'destructive',
                  });
                }
              }}
            >
              Set new passphrase
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card className="p-4">
        <CardTitle className="text-lg">{title}: Unlock</CardTitle>
        <CardContent className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={useRecovery ? 'secondary' : 'default'}
              onClick={() => setUseRecovery(false)}
            >
              Use passphrase
            </Button>
            <Button
              type="button"
              variant={useRecovery ? 'default' : 'secondary'}
              onClick={() => setUseRecovery(true)}
            >
              Forgot passphrase
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unlock-passphrase">Encryption passphrase</Label>
            <Input
              id="unlock-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>

          <Button
            onClick={async () => {
              if (!handle) {
                toast({
                  title: 'Unlock failed',
                  description: 'Sign in to unlock a vault.',
                  variant: 'destructive',
                });
                return;
              }
              try {
                const result = await handle.unlockWithPassphrase({
                  passphrase,
                });
                setMasterKeyBytes(result.masterKeyBytes);
                toast({
                  title: 'Unlocked',
                  description: 'Vault unlocked for this session.',
                });
              } catch (e: unknown) {
                if (e instanceof VaultSecretMismatchError) {
                  toast({
                    title: "That passphrase didn't unlock this vault",
                    description:
                      'The passphrase does not match this vault. Nothing was changed.',
                    variant: 'destructive',
                  });
                } else {
                  toast({
                    title: 'Unlock failed',
                    description:
                      'Something went wrong. Nothing on this device was changed.',
                    variant: 'destructive',
                  });
                }
              }
            }}
          >
            Unlock
          </Button>

          {/* A User who is already `owned` here may also hold a recovery key
              for a second, unclaimed Vault on this device, and this is where
              they say so. */}
          <RecoveryKeyClaimOffer onClaim={claimWithRecoveryKey} />
        </CardContent>
      </Card>
    </div>
  );
}
