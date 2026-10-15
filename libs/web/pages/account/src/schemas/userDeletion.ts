import { UserDeletionBodyConfirmationEnum } from '@myorganiser/app-api-client';
import { z } from 'zod';

// Mirrors UserDeletionSchema in apps/backend/src/schemas/auth.schema.ts.
// Confirmation is a plain string here so the form can start empty. The
// explicit `: boolean` stops TypeScript inferring a `"DELETE"` type
// predicate, which would narrow the output type to the literal.
export const userDeletionFormSchema = z.object({
  password: z.string().min(1, 'Enter your password.'),
  confirmation: z
    .string()
    .refine(
      (value): boolean => value === UserDeletionBodyConfirmationEnum.Delete,
      { message: 'Type DELETE to confirm.' },
    ),
});

export type UserDeletionFormValues = z.infer<typeof userDeletionFormSchema>;
