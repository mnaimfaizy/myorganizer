'use client';

import { GROCERY_PREDEFINED_CATEGORIES } from '@myorganizer/core';
import { z } from 'zod';

export const addItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be 200 characters or less'),
  category: z.enum(GROCERY_PREDEFINED_CATEGORIES),
  amount: z
    .string()
    .max(50, 'Amount must be 50 characters or less')
    .refine((value) => {
      if (value === '') return true;
      const trimmed = value.trim();
      const numericPart = trimmed.match(/^\d+(?:[.,]\d+)?/)?.[0];
      return (
        /^\d+(?:[.,]\d+)?(?:\s*[a-zA-Z]+(?:\s+[a-zA-Z]+)*)?$/.test(trimmed) &&
        numericPart !== undefined &&
        Number.isFinite(Number(numericPart.replace(',', '.'))) &&
        Number(numericPart.replace(',', '.')) >= 0
      );
    }, 'Quantity must be a valid non-negative number or a value such as 500g or 1 dozen'),
  price: z
    .string()
    .refine(
      (value) =>
        value === '' ||
        (/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) &&
          Number.isFinite(Number(value)) &&
          Number(value) >= 0),
      'Price must be a valid number',
    )
    .refine(
      (value) =>
        value === '' || (Number(value) >= 0 && Number(value) < 100_000),
      'Price must be between 0 and 99,999',
    ),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less'),
  imageUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  links: z
    .array(z.string().url('Each link must be a valid URL'))
    .max(10, 'Maximum 10 links allowed'),
});

export type AddItemFormValues = z.infer<typeof addItemSchema>;
