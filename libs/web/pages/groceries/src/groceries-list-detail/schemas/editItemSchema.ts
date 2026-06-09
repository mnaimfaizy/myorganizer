'use client';

import { GROCERY_PREDEFINED_CATEGORIES } from '@myorganizer/core';
import { z } from 'zod';

/**
 * Complete form schema for editing grocery items
 * Includes all fields: core (Issue #95), categories (Issue #96), and extended fields (Issue #97)
 */
export const editItemSchema = z.object({
  // Core fields (Issue #95)
  name: z
    .string()
    .trim()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be 200 characters or less'),
  checked: z.boolean(),

  // Category field (Issue #96)
  category: z.enum(GROCERY_PREDEFINED_CATEGORIES),

  // Extended fields (Issue #97)
  amount: z.string().max(50, 'Amount must be 50 characters or less'),

  price: z
    .string()
    .refine(
      (val) => val === '' || !isNaN(parseFloat(val)),
      'Price must be a valid number',
    )
    .refine((val) => {
      if (val === '') return true;
      const num = parseFloat(val);
      return num >= 0 && num < 100_000;
    }, 'Price must be between 0 and 99,999'),

  notes: z.string().max(1000, 'Notes must be 1000 characters or less'),

  imageUrl: z.string().url('Must be a valid URL').or(z.literal('')),

  links: z
    .array(z.string().url('Each link must be a valid URL'))
    .max(10, 'Maximum 10 links allowed'),
});

export type EditItemFormValues = z.infer<typeof editItemSchema>;
