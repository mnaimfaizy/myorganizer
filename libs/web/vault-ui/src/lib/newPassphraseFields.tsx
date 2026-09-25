'use client';

import { type Control, type FieldValues, type Path } from 'react-hook-form';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@myorganizer/web-ui';
import { MIN_PASSPHRASE_LENGTH } from '@myorganizer/web-vault';

export type NewPassphraseFieldValues = {
  newPassphrase: string;
  newPassphraseConfirm: string;
};

export type NewPassphraseFieldsProps<
  TFieldValues extends FieldValues & NewPassphraseFieldValues,
> = {
  control: Control<TFieldValues>;
  disabled?: boolean;
};

/**
 * New passphrase + confirm fields. Shared by the Passphrase Reset Prompt
 * and the Vault card so the labels, min-length copy, and names cannot drift.
 */
export function NewPassphraseFields<
  TFieldValues extends FieldValues & NewPassphraseFieldValues,
>({ control, disabled = false }: NewPassphraseFieldsProps<TFieldValues>) {
  return (
    <>
      <FormField
        control={control}
        name={'newPassphrase' as Path<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>New passphrase</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="password"
                autoComplete="new-password"
                disabled={disabled}
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
        control={control}
        name={'newPassphraseConfirm' as Path<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm new passphrase</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="password"
                autoComplete="new-password"
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
