'use client';

import { useCallback, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { UserDeletionBodyConfirmationEnum } from '@myorganizer/app-api-client';
import { clearAuthSession } from '@myorganizer/auth';
import {
  Button,
  DialogFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@myorganizer/web-ui';
import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { createUsersApi } from '../lib/apiClient';
import {
  userDeletionFormSchema,
  type UserDeletionFormValues,
} from '../schemas/userDeletion';

const GENERIC_DELETE_ERROR = 'Your account was not deleted. Try again.';

function getServerMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const data = error.response?.data;
  if (
    data &&
    typeof data === 'object' &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return data.message;
  }
  return undefined;
}

interface DeleteAccountConfirmFormProps {
  onBack: () => void;
}

export function DeleteAccountConfirmForm({
  onBack,
}: DeleteAccountConfirmFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<UserDeletionFormValues>({
    resolver: zodResolver(userDeletionFormSchema),
    defaultValues: { password: '', confirmation: '' },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = useCallback(
    async (values: UserDeletionFormValues) => {
      setFormError(null);
      try {
        await createUsersApi().deleteMe({
          userDeletionBody: {
            password: values.password,
            confirmation: UserDeletionBodyConfirmationEnum.Delete,
          },
        });
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 403) {
          form.setError('password', {
            message: getServerMessage(error) ?? 'Incorrect password.',
          });
          return;
        }
        setFormError(getServerMessage(error) ?? GENERIC_DELETE_ERROR);
        return;
      }

      // The account is gone, so logout() would only 401 and run the refresh
      // path. clearAuthSession does not emit sessionEnded, so the dashboard
      // guard will not race this navigation to /login.
      clearAuthSession();
      router.replace('/account-deleted');
    },
    [form, router],
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        data-testid="delete-account-form"
      >
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account password</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="current-password"
                  data-testid="delete-account-password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type DELETE to confirm</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="off"
                  data-testid="delete-account-confirmation"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError && (
          <p
            role="alert"
            data-testid="delete-account-error"
            className="text-sm text-destructive"
          >
            {formError}
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            type="submit"
            variant="destructive"
            data-testid="delete-account-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Deleting…' : 'Delete my account'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
