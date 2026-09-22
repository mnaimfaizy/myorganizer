'use client';

import { useCallback, useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  createVaultApi,
  MIN_PASSPHRASE_LENGTH,
  newPassphraseSchema,
  resetPassphraseAfterRecovery,
} from '@myorganizer/web-vault';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  useToast,
} from '@myorganizer/web-ui';

import { passphraseChangeReading } from './vaultMetaPushMessages';
import { useVaultSession } from './session';

type NewPassphraseInput = z.infer<typeof newPassphraseSchema>;

const SKIP_LABEL =
  'Skip for now. The forgotten passphrase stays the live one on every device.';

function passphraseResetErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

/**
 * The Passphrase Reset Prompt (ADR 0095).
 *
 * Shown once on the unlocked dashboard after a recovery-key Vault Unlock.
 * It performs the reset itself — the same `resetPassphraseAfterRecovery`
 * the Vault card uses — and an explicit skip. Escape, the overlay, and the
 * close button are not a skip: declining has to be said. Nothing about the
 * answer is written down.
 */
export function PassphraseResetPrompt() {
  const {
    passphraseResetPromptOwed,
    skipPassphraseResetPrompt,
    completePassphraseResetPrompt,
    handle,
  } = useVaultSession();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<NewPassphraseInput>({
    resolver: zodResolver(newPassphraseSchema),
    defaultValues: {
      newPassphrase: '',
      newPassphraseConfirm: '',
    },
  });

  useEffect(() => {
    if (passphraseResetPromptOwed) {
      form.reset();
    }
  }, [passphraseResetPromptOwed, form]);

  const refuseImplicitDismiss = useCallback(() => {
    // Escape and overlay clicks are not a skip. ADR 0095 requires the
    // decline to be explicit, and closing here would leave the forgotten
    // passphrase live without saying so.
  }, []);

  const keepPromptOpen = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
    },
    [],
  );

  const onSubmit = useCallback(
    async (values: NewPassphraseInput) => {
      if (!handle) {
        toast({
          title: 'Cannot set passphrase',
          description: 'Unlock your vault first.',
          variant: 'destructive',
        });
        return;
      }

      setSubmitting(true);
      try {
        const result = await resetPassphraseAfterRecovery({
          api: createVaultApi(),
          handle,
          newPassphrase: values.newPassphrase,
        });
        const reading = passphraseChangeReading(result.push);
        toast({
          title: reading.title,
          description: reading.detail,
        });
        form.reset();
        completePassphraseResetPrompt();
      } catch (error) {
        toast({
          title: 'Passphrase change failed',
          description: passphraseResetErrorDetail(error),
          variant: 'destructive',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [completePassphraseResetPrompt, form, handle, toast],
  );

  if (!passphraseResetPromptOwed) {
    return null;
  }

  return (
    <Dialog open onOpenChange={refuseImplicitDismiss}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={keepPromptOpen}
        onPointerDownOutside={keepPromptOpen}
        onInteractOutside={keepPromptOpen}
      >
        <DialogHeader>
          <DialogTitle>Set a passphrase you know</DialogTitle>
          <DialogDescription>
            You unlocked with your recovery key. Choose a passphrase you will
            remember. You do not need the one you forgot.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <p className="text-sm text-muted-foreground">
              Your data is not re-encrypted and nothing is decrypted on the
              server — only what unlocks your vault changes. Your recovery key
              still works and does not need to be written down again.
            </p>
            <p className="text-sm text-muted-foreground">
              Your other devices keep using the old passphrase until you confirm
              the change on each of them; they will ask the next time they sync.
            </p>

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
                      autoComplete="new-password"
                      disabled={submitting}
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
                      autoComplete="new-password"
                      disabled={submitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="sm:flex-col sm:items-stretch">
              <Button
                type="button"
                variant="outline"
                className="h-auto whitespace-normal text-left"
                onClick={skipPassphraseResetPrompt}
                disabled={submitting}
              >
                {SKIP_LABEL}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Setting…' : 'Set new passphrase'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
