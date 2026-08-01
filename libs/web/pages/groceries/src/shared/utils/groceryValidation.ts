import type { GroceryCategoryType } from '@myorganizer/core';
import { GROCERY_PREDEFINED_CATEGORIES } from '@myorganizer/core';
import { z } from 'zod';
import type { AddCatalogItemAndLineInput } from '../hooks/useGroceriesVault';

const quantityPattern = /^\d+(?:[.,]\d+)?(?:\s*[a-zA-Z]+(?:\s+[a-zA-Z]+)*)?$/;

export const addCatalogItemAndLineInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(GROCERY_PREDEFINED_CATEGORIES),
  price: z.number().finite().min(0).lt(100_000).optional(),
  notes: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  links: z.array(z.string().url()).max(10).optional(),
  amount: z
    .string()
    .max(50)
    .refine(
      (value) =>
        value.trim() === '' ||
        (quantityPattern.test(value.trim()) &&
          Number.isFinite(
            Number(
              value
                .trim()
                .match(/^\d+(?:[.,]\d+)?/)?.[0]
                .replace(',', '.'),
            ),
          )),
      'Quantity must be a valid non-negative number or a value such as 500g or 1 dozen',
    )
    .optional(),
  catalogItemId: z.string().min(1).optional(),
});

export function validateAddCatalogItemAndLineInput(
  input: AddCatalogItemAndLineInput,
): AddCatalogItemAndLineInput {
  const result = addCatalogItemAndLineInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Invalid grocery item');
  }

  return {
    ...input,
    name: input.name.trim(),
    category: input.category as GroceryCategoryType,
    amount: input.amount?.trim() || undefined,
  };
}
