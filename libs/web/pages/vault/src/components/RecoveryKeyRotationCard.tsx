'use client';

import { useCallback, useEffect, useState } from 'react';

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
  useToast,
} from '@myorganizer/web-ui';
import {
  currentPassphraseSchema,
  mintRecoveryKey,
  type MintedRecoveryKey,
} from '@myorganizer/web-vault';

import { downloadTextFile } from '../utils';
import { useRecoveryKeyRotation, useVaultDisabledState } from '../hooks';
import { RecoveryKeyMintedSection } from './RecoveryKeyMintedSection';

const rotationFormSchema = z.object({
  currentPassphrase: currentPassphraseSchema,
  confirmRecoveryKey: z.string(),
});

export type RotationFormInput = z.infer<typeof rotationFormSchema>;

export function RecoveryKeyRotationCard() {
  const { toast } = useToast();
  const { rotating, rotateRecoveryKey } = useRecoveryKeyRotation();
  const disabledState = useVaultDisabledState();

  const [mintedKey, setMintedKey] = useState<MintedRecoveryKey | null>(null);

  const form = useForm<RotationFormInput>({
    resolver: zodResolver(rotationFormSchema),
    defaultValues: {
      currentPassphrase: '',
      confirmRecoveryKey: '',
    },
  });

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

  const handleCopy = useCallback(async () => {
    if (!mintedKey) return;

    if (!navigator.clipboard) {
      toast({
        title: 'Copy not available',
        description:
          'Your browser does not support copy to clipboard. Use the Download button or select the key manually.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(mintedKey);
      toast({
        title: 'Copied',
        description: 'Recovery key copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description:
          'Could not copy recovery key to clipboard. Use the Download button or select it manually.',
        variant: 'destructive',
      });
    }
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

  // Only flag a mismatch once the User has entered at least as much as the
  // minted key — otherwise every keystroke of a correct paste-in-progress
  // would flash as an error before it's had a chance to match.
  useEffect(() => {
    if (
      mintedKey &&
      confirmRecoveryKey &&
      confirmRecoveryKey.length >= mintedKey.length &&
      confirmRecoveryKey !== mintedKey
    ) {
      form.setError('confirmRecoveryKey', {
        message:
          'Recovery key does not match. Check that you pasted it correctly.',
      });
    } else {
      form.clearErrors('confirmRecoveryKey');
    }
  }, [confirmRecoveryKey, mintedKey, form]);

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
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-col gap-3"
          >
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
              <RecoveryKeyMintedSection
                mintedKey={mintedKey}
                form={form}
                disabledState={disabledState}
                rotating={rotating}
                onDownload={handleDownload}
                onCopy={handleCopy}
                onCancel={handleCancel}
                onRotate={handleRotate}
              />
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
