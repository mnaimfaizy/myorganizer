'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { GroceryCategoryType } from '@myorganizer/core';
import { GROCERY_PREDEFINED_CATEGORIES } from '@myorganizer/core';
import {
  Button,
  Dialog,
  DialogContent,
  Input,
  Label,
  cn,
} from '@myorganizer/web-ui';
import { Info, Lock } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../../shared/constants/categories';
import { LinksInput } from './LinksInput';

const addItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be 200 characters or less'),
  category: z.enum(GROCERY_PREDEFINED_CATEGORIES),
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

type AddItemFormValues = z.infer<typeof addItemSchema>;

export interface AddItemFormResult {
  name: string;
  category: GroceryCategoryType;
  amount?: string;
  price?: number;
  notes?: string;
  imageUrl?: string;
  links?: string[];
}

interface AddItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (values: AddItemFormResult) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Rich "Add New Item" dialog matching the Secure Modernism design.
 * Fields: name (required), category (icon grid), amount, price, notes.
 */
export function AddItemDialog({
  isOpen,
  onClose,
  onAdd,
  isLoading = false,
}: AddItemDialogProps) {
  const form = useForm<AddItemFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addItemSchema, undefined, { mode: 'sync' }) as any,
    mode: 'onChange',
    defaultValues: {
      name: '',
      category: 'other',
      amount: '',
      price: '',
      notes: '',
      imageUrl: '',
      links: [],
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onAdd({
        name: values.name,
        category: values.category,
        amount: values.amount || undefined,
        price: values.price ? parseFloat(values.price) : undefined,
        notes: values.notes || undefined,
        imageUrl: values.imageUrl || undefined,
        links: values.links?.length ? values.links : undefined,
      });
      form.reset();
      onClose();
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      onClose();
    }
  };

  const selectedCategory = form.watch('category');
  const watchImageUrl = form.watch('imageUrl');
  const isValidImageUrl = watchImageUrl && watchImageUrl.startsWith('http');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl p-0 gap-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-5 border-b border-border-muted">
            <div className="flex items-start gap-3 mb-1">
              <h2 className="text-xl font-semibold text-primary">
                Add New Item
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-container text-action-cyan rounded-full border border-action-cyan/20 text-[10px] font-bold tracking-wider uppercase shrink-0 mt-0.5">
                <Lock className="w-3 h-3" />
                Encrypted Data
              </span>
            </div>
            <p className="text-sm text-on-surface-variant">
              Stored securely in your private vault.
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Item Name */}
            <div className="space-y-1.5">
              <Label
                htmlFor="add-item-name"
                className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
              >
                Item Name <span className="text-error">*</span>
              </Label>
              <Input
                id="add-item-name"
                placeholder="e.g. Organic Almond Milk"
                {...form.register('name')}
                disabled={isLoading}
                maxLength={200}
                autoFocus
                className="text-base md:text-sm"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-error">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                Category
              </Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORY_ORDER.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => field.onChange(cat)}
                        className={cn(
                          'flex flex-col items-center justify-center p-2 rounded-lg transition-all text-center',
                          selectedCategory === cat
                            ? 'border-2 border-secondary bg-secondary-fixed/20'
                            : 'border border-outline-variant bg-surface-bright hover:border-secondary',
                        )}
                      >
                        <span className="text-lg mb-0.5" aria-hidden="true">
                          {CATEGORY_EMOJIS[cat]}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-medium leading-tight',
                            selectedCategory === cat
                              ? 'font-bold text-secondary'
                              : 'text-on-surface-variant',
                          )}
                        >
                          {CATEGORY_LABELS[cat]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Amount + Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="add-item-amount"
                  className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
                >
                  Quantity / Amount
                </Label>
                <Input
                  id="add-item-amount"
                  placeholder="e.g. 2, 500g"
                  {...form.register('amount')}
                  disabled={isLoading}
                  className="text-base md:text-sm"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-error">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="add-item-price"
                  className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
                >
                  Estimated Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-on-surface-variant font-bold text-sm">
                    $
                  </span>
                  <Input
                    id="add-item-price"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register('price')}
                    disabled={isLoading}
                    className="pl-6 text-base md:text-sm"
                  />
                </div>
                {form.formState.errors.price && (
                  <p className="text-xs text-error">
                    {form.formState.errors.price.message}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label
                htmlFor="add-item-notes"
                className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
              >
                Notes
              </Label>
              <textarea
                id="add-item-notes"
                placeholder="Add specific brands, sizes or dietary requirements..."
                {...form.register('notes')}
                disabled={isLoading}
                rows={3}
                maxLength={1000}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-base md:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-secondary bg-surface-bright"
              />
              {form.formState.errors.notes && (
                <p className="text-xs text-error">
                  {form.formState.errors.notes.message}
                </p>
              )}
            </div>

            {/* Image URL */}
            <div className="space-y-1.5">
              <Label
                htmlFor="add-item-imageUrl"
                className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
              >
                Image URL{' '}
                <span className="text-xs normal-case font-normal text-text-muted">
                  (optional)
                </span>
              </Label>
              <Input
                id="add-item-imageUrl"
                placeholder="https://example.com/image.jpg"
                type="url"
                {...form.register('imageUrl')}
                disabled={isLoading}
                className="text-base md:text-sm"
              />
              {form.formState.errors.imageUrl && (
                <p className="text-xs text-error">
                  {form.formState.errors.imageUrl.message}
                </p>
              )}
              {isValidImageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border border-outline-variant">
                  <img
                    src={watchImageUrl}
                    alt="Item preview"
                    className="max-w-xs max-h-48 rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Links */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                Links{' '}
                <span className="text-xs normal-case font-normal text-text-muted">
                  (optional, max 10)
                </span>
              </Label>
              <LinksInput control={form.control} />
              {form.formState.errors.links && (
                <p className="text-xs text-error">
                  {form.formState.errors.links.message}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-surface-container-low border-t border-border-muted flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-on-surface-variant opacity-60">
              <Info className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">
                Auto-syncs across shared devices
              </span>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !form.formState.isValid}
                className="gap-2"
              >
                Add to List
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
