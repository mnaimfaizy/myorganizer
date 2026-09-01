'use client';

import { useCallback } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@myorganizer/web-ui';
import {
  changePassphraseSchema,
  ChangePassphraseInput,
  MIN_PASSPHRASE_LENGTH,
} from '@myorganizer/web-vault';

import { useChangePassphrase, useVaultDisabledState } from '../hooks';

export function ChangePassphraseCard() {
  const { changing, changePassphrase } = useChangePassphrase();
  const disabledState = useVaultDisabledState();

  const form = useForm<ChangePassphraseInput>({
    resolver: zodResolver(changePassphraseSchema),
    defaultValues: {
      currentPassphrase: '',
      newPassphrase: '',
      newPassphraseConfirm: '',
    },
  });

  const onSubmit = useCallback(
    async (values: ChangePassphraseInput) => {
      const result = await changePassphrase({
        currentPassphrase: values.currentPassphrase,
        newPassphrase: values.newPassphrase,
      });

      if (result === 'ok') {
        form.reset();
      } else if (result === 'wrong-passphrase') {
        form.setError('currentPassphrase', {
          message: 'That is not your current passphrase.',
        });
      }
      // On 'error', the hook already toasted, so leave the form as-is
    },
    [changePassphrase, form],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change passphrase</CardTitle>
        <CardDescription>
          Choose a new passphrase for unlocking your vault on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Your data is not re-encrypted and nothing is decrypted on the server —
          only what unlocks your vault changes. Your recovery key still works
          and does not need to be written down again.
        </p>
        <p className="text-sm text-muted-foreground">
          Your other devices keep using the old passphrase until you confirm the
          change on each of them; they will ask the next time they sync.
        </p>

        {disabledState === 'locked' && (
          <p className="text-sm text-muted-foreground">
            Unlock your vault to change its passphrase.
          </p>
        )}

        {disabledState === 'no-local-vault' && (
          <p className="text-sm text-muted-foreground">
            Set up a local vault on this device to change its passphrase.
          </p>
        )}

        {disabledState === 'signed-out' && (
          <p className="text-sm text-muted-foreground">
            Your vault is not available on this device right now.
          </p>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
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

            <FormField
              control={form.control}
              name="newPassphrase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New passphrase</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      disabled={disabledState !== 'enabled'}
                    />
                  </FormControl>
                  <FormDescription>
                    Minimum {MIN_PASSPHRASE_LENGTH} characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassphraseConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new passphrase</FormLabel>
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

            <div className="flex gap-2">
              <Button
                type="submit"
                data-testid="change-passphrase-submit"
                disabled={changing || disabledState !== 'enabled'}
              >
                {changing ? 'Changing…' : 'Change passphrase'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
