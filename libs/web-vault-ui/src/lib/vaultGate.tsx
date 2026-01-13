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
import { useEffect, useMemo, useState } from 'react';

import {
  hasVault,
  initializeVault,
  setNewPassphrase,
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryKey,
} from '@myorganizer/web-vault';

import { useOptionalVaultSession } from './session';

type VaultGateProps = {
  title: string;
  children: (ctx: { masterKeyBytes: Uint8Array }) => React.ReactNode;
};

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function VaultGate(props: VaultGateProps) {
  const { toast } = useToast();

  const vaultSession = useOptionalVaultSession();

  const [vaultExists, setVaultExists] = useState<boolean>(false);
  const [localMasterKeyBytes, setLocalMasterKeyBytes] =
    useState<Uint8Array | null>(null);

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

  useEffect(() => {
    setVaultExists(hasVault());
  }, []);

  const isUnlocked = masterKeyBytes !== null;

  const title = useMemo(() => props.title, [props.title]);

  if (isUnlocked && masterKeyBytes) {
    return <>{props.children({ masterKeyBytes })}</>;
  }

  if (!vaultExists) {
    const canCreate =
      setupPassphrase.length >= 10 &&
      setupPassphrase === setupConfirm &&
      recoveryKey === null;

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
                Minimum 10 characters. This passphrase never leaves your device.
              </p>
            </div>

            <Button
              disabled={!canCreate}
              onClick={async () => {
                try {
                  const result = await initializeVault({
                    passphrase: setupPassphrase,
                  });
                  setRecoveryKey(result.recoveryKey);
                  toast({
                    title: 'Vault created',
                    description: 'Save your recovery key now.',
                  });
                } catch (e: any) {
                  toast({
                    title: 'Failed to create vault',
                    description: e?.message ?? String(e),
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
                        'myorganizer-recovery-key.txt',
                        `MyOrganizer Recovery Key\n\n${recoveryKey}\n\nKeep this safe. Anyone with it can decrypt your vault.`
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
                      setVaultExists(true);
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
                try {
                  const result = await unlockVaultWithRecoveryKey({
                    recoveryKey: recoveryInput.trim(),
                  });

                  setMasterKeyBytes(result.masterKeyBytes);
                  toast({
                    title: 'Recovered',
                    description: 'Vault unlocked with your recovery key.',
                  });
                } catch {
                  toast({
                    title: 'Recovery failed',
                    description: 'Invalid recovery key or corrupted vault.',
                    variant: 'destructive',
                  });
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
                newPassphrase.length < 10 ||
                newPassphrase !== newPassphraseConfirm
              }
              onClick={async () => {
                if (!masterKeyBytes) return;

                try {
                  await setNewPassphrase({
                    masterKeyBytes,
                    newPassphrase,
                  });
                  toast({
                    title: 'Updated',
                    description: 'Passphrase updated for this vault.',
                  });
                } catch (e: any) {
                  toast({
                    title: 'Failed',
                    description: e?.message ?? String(e),
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
              try {
                const result = await unlockVaultWithPassphrase({
                  passphrase,
                });
                setMasterKeyBytes(result.masterKeyBytes);
                toast({
                  title: 'Unlocked',
                  description: 'Vault unlocked for this session.',
                });
              } catch {
                toast({
                  title: 'Unlock failed',
                  description: 'Wrong passphrase or corrupted vault.',
                  variant: 'destructive',
                });
              }
            }}
          >
            Unlock
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
