import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password field is required'),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Token field is required'),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

export const updatePasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'Token field is required'),
    password: z.string().min(1, 'Password field is required'),
    confirm_password: z.string().min(1, 'Confirm password field is required'),
  })
  .superRefine((val, ctx) => {
    if (val.password !== val.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is not the same as confirm password',
        path: ['confirmPassword'],
      });
    }
  });
