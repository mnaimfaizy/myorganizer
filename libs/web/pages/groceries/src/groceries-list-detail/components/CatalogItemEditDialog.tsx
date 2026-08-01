'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { CatalogItem, GroceryCategoryType } from '@myorganizer/core';
import { GROCERY_PREDEFINED_CATEGORIES } from '@myorganizer/core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  cn,
} from '@myorganizer/web-ui';
import { Lock } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../shared/constants/categories';
import { LinksInput } from './LinksInput';

const catalogItemEditSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(200),
  category: z.enum(GROCERY_PREDEFINED_CATEGORIES),
  price: z
    .string()
    .refine(
      (value) =>
        value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0),
      'Price must be a valid number',
    ),
  notes: z.string().max(1000),
  imageUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  links: z.array(z.string().url('Each link must be a valid URL')).max(10),
});

type CatalogItemEditFormValues = z.infer<typeof catalogItemEditSchema>;

export interface CatalogItemEditChanges {
  id: string;
  name: string;
  category: GroceryCategoryType;
  price?: number;
  notes?: string;
  imageUrl?: string;
  links?: string[];
}

interface CatalogItemEditDialogProps {
  item: CatalogItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (changes: CatalogItemEditChanges) => Promise<void>;
  isLoading?: boolean;
}

export function CatalogItemEditDialog({
  item,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}: CatalogItemEditDialogProps) {
  const form = useForm<CatalogItemEditFormValues>({
    resolver: zodResolver(catalogItemEditSchema, undefined, { mode: 'sync' }),
    mode: 'onChange',
    defaultValues: {
      name: '',
      category: 'other',
      price: '',
      notes: '',
      imageUrl: '',
      links: [],
    },
  });

  useEffect(() => {
    form.reset({
      name: item?.name ?? '',
      category: item?.category ?? 'other',
      price: item?.price === undefined ? '' : String(item.price),
      notes: item?.notes ?? '',
      imageUrl: item?.imageUrl ?? '',
      links: item?.links ?? [],
    });
  }, [form, item?.id]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!item) return;
    await onSave({
      id: item.id,
      name: values.name,
      category: values.category,
      price: values.price === '' ? undefined : Number(values.price),
      notes: values.notes || undefined,
      imageUrl: values.imageUrl || undefined,
      links: values.links.length ? values.links : undefined,
    });
    onClose();
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const selectedCategory = form.watch('category');

  return (
    <Dialog open={isOpen && item !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl gap-0 overflow-hidden p-0">
        <Form {...form}>
          <form onSubmit={handleSubmit}>
            <div className="border-b border-border-muted px-6 py-5">
              <div className="mb-1 flex items-start gap-3">
                <DialogTitle className="text-xl font-semibold text-primary">
                  Edit Catalog Item
                </DialogTitle>
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-action-cyan/20 bg-primary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-action-cyan">
                  <Lock className="h-3 w-3" /> Encrypted Data
                </span>
              </div>
              <DialogDescription className="text-sm text-on-surface-variant">
                Changes apply to this Catalog Item and are shared by every
                Grocery List reference. Stored securely in your private vault.
              </DialogDescription>
            </div>
            <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catalog Item Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoFocus
                        disabled={isLoading}
                        maxLength={200}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel id="catalog-item-category-label">
                      Category
                    </FormLabel>
                    <div
                      className="grid grid-cols-4 gap-2"
                      role="group"
                      aria-labelledby="catalog-item-category-label"
                    >
                      {CATEGORY_ORDER.map((category) => (
                        <button
                          key={category}
                          type="button"
                          disabled={isLoading}
                          aria-pressed={selectedCategory === category}
                          onClick={() => field.onChange(category)}
                          className={cn(
                            'rounded-lg p-2 text-center',
                            selectedCategory === category
                              ? 'border-2 border-secondary bg-secondary-fixed/20'
                              : 'border border-outline-variant bg-surface-bright',
                          )}
                        >
                          <span aria-hidden="true">
                            {CATEGORY_EMOJIS[category]}
                          </span>
                          <span className="ml-1 text-xs">
                            {CATEGORY_LABELS[category]}
                          </span>
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Price</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={3}
                        maxLength={1000}
                        disabled={isLoading}
                        className="w-full resize-none rounded-lg border border-outline-variant bg-surface-bright px-3 py-2"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input {...field} type="url" disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Links</FormLabel>
                <LinksInput control={form.control} disabled={isLoading} />
                <FormMessage />
              </FormItem>
            </div>
            <div className="flex justify-end gap-3 border-t border-border-muted bg-surface-container-low px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !form.formState.isValid}
              >
                Save Catalog Item
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
