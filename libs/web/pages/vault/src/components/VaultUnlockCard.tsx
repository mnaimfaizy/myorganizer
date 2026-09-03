'use client';

import { useCallback } from 'react';

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
} from '@myorganizer/web-ui';
import { currentPassphraseSchema } from '@myorganizer/web-vault';

import { useVaultUnlock, useVaultDisabledState } from '../hooks';

const vaultUnlockSchema = z.object({
  passphrase: currentPassphraseSchema,
});

type VaultUnlockInput = z.infer<typeof vaultUnlockSchema>;

export function VaultUnlockCard() {
  const { unlocking, unlock } = useVaultUnlock();
  const disabledState = useVaultDisabledState();

  const form = useForm<VaultUnlockInput>({
    resolver: zodResolver(vaultUnlockSchema),
    defaultValues: {
      passphrase: '',
    },
  });

  const onSubmit = useCallback(
    async (values: VaultUnlockInput) => {
      const result = await unlock(values.passphrase);

      if (result === 'ok') {
        form.reset();
      } else if (result === 'wrong-passphrase') {
        form.setError('passphrase', {
          message: 'That is not your current passphrase.',
        });
      }
      // On 'error', the hook already toasted, so leave the form as-is
    },
    [unlock, form],
  );

  // Only render if vault is locked
  if (disabledState !== 'locked') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unlock your vault</CardTitle>
        <CardDescription>
          Enter your passphrase to unlock your vault on this device for this
          session.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="passphrase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passphrase</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button
                type="submit"
                data-testid="vault-unlock-submit"
                disabled={unlocking}
              >
                {unlocking ? 'Unlocking…' : 'Unlock'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
