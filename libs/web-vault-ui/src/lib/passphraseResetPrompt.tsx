'use client';

import { useCallback, useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { newPassphraseSchema } from '@myorganizer/web-vault';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  useToast,
} from '@myorganizer/web-ui';

import { NewPassphraseFields } from './newPassphraseFields';
import { resetPassphraseAfterRecoveryAndAnnounce } from './recoveryPassphraseReset';
import { useVaultSession } from './session';
import { PASSPHRASE_REWRITE_FACTS } from './vaultMetaPushMessages';

type NewPassphraseInput = z.infer<typeof newPassphraseSchema>;

const SKIP_LABEL =
  'Skip for now. The forgotten passphrase stays the live one on every device.';

/**
 * The Passphrase Reset Prompt (ADR 0095).
 *
 * Shown once on the unlocked dashboard after a recovery-key Vault Unlock.
 * It performs the reset itself — the same
 * `resetPassphraseAfterRecoveryAndAnnounce` the Vault card uses — and an
 * explicit skip. Escape, the overlay, and the close button are not a skip:
 * declining has to be said. Nothing about the answer is written down.
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
        await resetPassphraseAfterRecoveryAndAnnounce({
          handle,
          newPassphrase: values.newPassphrase,
          toast,
          onComplete: () => {
            form.reset();
            completePassphraseResetPrompt();
          },
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
              {PASSPHRASE_REWRITE_FACTS.wrapping}
            </p>
            <p className="text-sm text-muted-foreground">
              {PASSPHRASE_REWRITE_FACTS.otherDevices}
            </p>

            <NewPassphraseFields control={form.control} disabled={submitting} />

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
