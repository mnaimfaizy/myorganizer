'use client';

import { useCallback } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type Control,
  type FieldValues,
  type Path,
  useForm,
} from 'react-hook-form';
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
  newPassphraseSchema,
} from '@myorganizer/web-vault';
import {
  PASSPHRASE_REWRITE_FACTS,
  type VaultUnlockSecret,
} from '@myorganizer/web-vault-ui';

import { useChangePassphrase, useVaultOperationAvailability } from '../hooks';
import { VAULT_OPERATIONS } from '../policy';
import { VaultUnavailableNotice } from './VaultUnavailableNotice';

type NewPassphraseInput = z.infer<typeof newPassphraseSchema>;

type SharedNewPassphraseFields = Pick<
  NewPassphraseInput,
  'newPassphrase' | 'newPassphraseConfirm'
>;

interface ChangePassphraseSharedFieldsProps<
  TFieldValues extends FieldValues & SharedNewPassphraseFields,
> {
  control: Control<TFieldValues>;
  allowed: boolean;
  changing: boolean;
  submitLabel: string;
}

function ChangePassphraseSharedFields<
  TFieldValues extends FieldValues & SharedNewPassphraseFields,
>({
  control,
  allowed,
  changing,
  submitLabel,
}: ChangePassphraseSharedFieldsProps<TFieldValues>) {
  return (
    <>
      <FormField
        control={control}
        name={'newPassphrase' as Path<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>New passphrase</FormLabel>
            <FormControl>
              <Input {...field} type="password" disabled={!allowed} />
            </FormControl>
            <FormDescription>
              Minimum {MIN_PASSPHRASE_LENGTH} characters.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={'newPassphraseConfirm' as Path<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm new passphrase</FormLabel>
            <FormControl>
              <Input {...field} type="password" disabled={!allowed} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex gap-2">
        <Button
          type="submit"
          data-testid="change-passphrase-submit"
          disabled={changing || !allowed}
        >
          {changing ? 'Changing…' : submitLabel}
        </Button>
      </div>
    </>
  );
}

const CHANGE_PASSPHRASE_CARD_FOR_UNLOCK_SECRET = {
  passphrase: {
    title: 'Change passphrase',
    description:
      'Choose a new passphrase for unlocking your vault on this device.',
    submitLabel: 'Change passphrase',
  },
  'recovery-key': {
    title: 'Set new passphrase',
    description:
      'You unlocked with your recovery key. Choose a passphrase you will remember for unlocking your vault on this device.',
    submitLabel: 'Set new passphrase',
  },
} as const satisfies Record<
  VaultUnlockSecret,
  {
    title: string;
    description: string;
    submitLabel: string;
  }
>;

export function ChangePassphraseCard() {
  const { changing, unlockSecret, changePassphrase } = useChangePassphrase();
  const { allowed, unavailableReason } = useVaultOperationAvailability(
    VAULT_OPERATIONS.PassphraseChange,
  );

  const authorizedBy: VaultUnlockSecret = unlockSecret ?? 'passphrase';
  const mode = CHANGE_PASSPHRASE_CARD_FOR_UNLOCK_SECRET[authorizedBy];
  const isRecoveryReset = authorizedBy === 'recovery-key';

  const recoveryForm = useForm<NewPassphraseInput>({
    resolver: zodResolver(newPassphraseSchema),
    defaultValues: {
      newPassphrase: '',
      newPassphraseConfirm: '',
    },
  });

  const passphraseForm = useForm<ChangePassphraseInput>({
    resolver: zodResolver(changePassphraseSchema),
    defaultValues: {
      currentPassphrase: '',
      newPassphrase: '',
      newPassphraseConfirm: '',
    },
  });

  const onSubmitRecovery = useCallback(
    async (values: NewPassphraseInput) => {
      const result = await changePassphrase({
        currentPassphrase: '',
        newPassphrase: values.newPassphrase,
      });

      if (result === 'ok') {
        recoveryForm.reset();
      }
      // On 'error', the hook already toasted, so leave the form as-is
    },
    [changePassphrase, recoveryForm],
  );

  const onSubmitPassphrase = useCallback(
    async (values: ChangePassphraseInput) => {
      const result = await changePassphrase({
        currentPassphrase: values.currentPassphrase,
        newPassphrase: values.newPassphrase,
      });

      if (result === 'ok') {
        passphraseForm.reset();
      } else if (result === 'wrong-passphrase') {
        passphraseForm.setError('currentPassphrase', {
          message: 'That is not your current passphrase.',
        });
      }
      // On 'error', the hook already toasted, so leave the form as-is
    },
    [changePassphrase, passphraseForm],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode.title}</CardTitle>
        <CardDescription>{mode.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {PASSPHRASE_REWRITE_FACTS.wrapping}
        </p>
        <p className="text-sm text-muted-foreground">
          {PASSPHRASE_REWRITE_FACTS.otherDevices}
        </p>

        <VaultUnavailableNotice
          reason={unavailableReason}
          testId="change-passphrase-unavailable"
        />

        {isRecoveryReset ? (
          <Form {...recoveryForm}>
            <form
              onSubmit={recoveryForm.handleSubmit(onSubmitRecovery)}
              className="flex flex-col gap-3"
            >
              <ChangePassphraseSharedFields
                control={recoveryForm.control}
                allowed={allowed}
                changing={changing}
                submitLabel={mode.submitLabel}
              />
            </form>
          </Form>
        ) : (
          <Form {...passphraseForm}>
            <form
              onSubmit={passphraseForm.handleSubmit(onSubmitPassphrase)}
              className="flex flex-col gap-3"
            >
              <FormField
                control={passphraseForm.control}
                name="currentPassphrase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current passphrase</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" disabled={!allowed} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ChangePassphraseSharedFields
                control={passphraseForm.control}
                allowed={allowed}
                changing={changing}
                submitLabel={mode.submitLabel}
              />
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
