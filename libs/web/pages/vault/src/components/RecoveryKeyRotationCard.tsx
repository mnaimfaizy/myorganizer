'use client';

import { useCallback, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  useToast,
} from '@myorganizer/web-ui';
import {
  mintRecoveryKey,
  type MintedRecoveryKey,
} from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';

import { downloadTextFile } from '../utils';
import { useRecoveryKeyRotation } from '../hooks';

const currentPassphraseSchema = z.object({
  currentPassphrase: z.string().min(1, 'Enter your current passphrase.'),
  confirmRecoveryKey: z.string(),
});

type CurrentPassphraseInput = z.infer<typeof currentPassphraseSchema>;

export function RecoveryKeyRotationCard() {
  const { toast } = useToast();
  const { rotating, rotateRecoveryKey } = useRecoveryKeyRotation();
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const masterKeyBytes = vaultSession?.masterKeyBytes ?? null;

  const [mintedKey, setMintedKey] = useState<MintedRecoveryKey | null>(null);

  const form = useForm<CurrentPassphraseInput>({
    resolver: zodResolver(currentPassphraseSchema),
    defaultValues: {
      currentPassphrase: '',
      confirmRecoveryKey: '',
    },
  });

  const isUnlocked = handle !== null && masterKeyBytes !== null;
  const isSignedOut = handle === null;
  const hasLocalVault = handle !== null && handle.loadVault() !== null;

  const disabledState = isSignedOut
    ? 'signed-out'
    : !hasLocalVault
      ? 'no-local-vault'
      : !isUnlocked
        ? 'locked'
        : 'enabled';

  const handleGenerateKey = useCallback(async () => {
    const valid = await form.trigger('currentPassphrase');
    if (!valid) return;
    const newKey = mintRecoveryKey();
    setMintedKey(newKey);
  }, [form]);

  const handleDownload = useCallback(() => {
    if (!mintedKey) return;
    downloadTextFile(
      'myorganiser-recovery-key.txt',
      `MyOrganizer Recovery Key\n\n${mintedKey}\n\nKeep this safe. Anyone with it can decrypt your vault.`,
    );
  }, [mintedKey]);

  const handleCopy = useCallback(() => {
    if (!mintedKey) return;
    navigator.clipboard.writeText(mintedKey);
    toast({
      title: 'Copied',
      description: 'Recovery key copied',
    });
  }, [mintedKey, toast]);

  const handleCancel = useCallback(() => {
    setMintedKey(null);
    form.resetField('confirmRecoveryKey');
  }, [form]);

  const handleRotate = useCallback(async () => {
    const valid = await form.trigger('currentPassphrase');
    if (!valid) return;
    const currentPassphrase = form.getValues('currentPassphrase');
    if (!mintedKey) return;

    const result = await rotateRecoveryKey({
      currentPassphrase,
      recoveryKey: mintedKey,
    });

    if (result === 'ok') {
      form.reset();
      setMintedKey(null);
    } else if (result === 'wrong-passphrase') {
      form.setError('currentPassphrase', {
        message: 'That is not your current passphrase.',
      });
    }
    // On 'error', the hook already toasted — leave everything as-is
  }, [form, mintedKey, rotateRecoveryKey]);

  const currentPassphrase = form.watch('currentPassphrase');
  const confirmRecoveryKey = form.watch('confirmRecoveryKey');
  const isPassphraseEmpty = !currentPassphrase?.trim();
  const isConfirmMatched = confirmRecoveryKey === mintedKey;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rotate recovery key</CardTitle>
        <CardDescription>
          Generate a new recovery key that can open your vault. Your old key
          stops working after you confirm the new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Generating a new recovery key does not change anything by itself —
          nothing is written until you confirm you have it.
        </p>
        <p className="text-sm text-muted-foreground">
          A Vault Export you saved before rotating still opens with your old
          recovery key — see "Export encrypted vault" below.
        </p>

        {disabledState === 'locked' && (
          <p className="text-sm text-muted-foreground">
            Unlock your vault to rotate its recovery key.
          </p>
        )}

        {disabledState === 'no-local-vault' && (
          <p className="text-sm text-muted-foreground">
            Set up a local vault on this device to rotate its recovery key.
          </p>
        )}

        {disabledState === 'signed-out' && (
          <p className="text-sm text-muted-foreground">
            Your vault is not available on this device right now.
          </p>
        )}

        <Form {...form}>
          <form className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="currentPassphrase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current passphrase</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      disabled={disabledState !== 'enabled'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              data-testid="recovery-key-rotation-mint"
              disabled={
                disabledState !== 'enabled' ||
                isPassphraseEmpty ||
                mintedKey !== null
              }
              onClick={handleGenerateKey}
            >
              Generate recovery key
            </Button>

            {mintedKey !== null && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="recovery-key-rotation-key-display">
                    Recovery key (save this)
                  </Label>
                  <Input
                    id="recovery-key-rotation-key-display"
                    readOnly
                    value={mintedKey}
                    data-testid="recovery-key-rotation-key"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      data-testid="recovery-key-rotation-download"
                      onClick={handleDownload}
                    >
                      Download
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid="recovery-key-rotation-copy"
                      onClick={handleCopy}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="confirmRecoveryKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm you have the recovery key</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          data-testid="recovery-key-rotation-confirm"
                          placeholder="Paste the recovery key shown above"
                          disabled={disabledState !== 'enabled'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="recovery-key-rotation-cancel"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    data-testid="recovery-key-rotation-submit"
                    disabled={
                      disabledState !== 'enabled' ||
                      !isConfirmMatched ||
                      rotating
                    }
                    onClick={handleRotate}
                  >
                    {rotating ? 'Rotating…' : 'Rotate recovery key'}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
