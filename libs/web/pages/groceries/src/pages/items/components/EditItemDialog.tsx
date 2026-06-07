'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { GroceryItem } from '@myorganizer/core';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  Input,
  Label,
  cn,
} from '@myorganizer/web-ui';
import { Info, Lock } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../../shared/constants/categories';
import { editItemSchema, type EditItemFormValues } from '../schemas';
import { LinksInput } from './LinksInput';

interface EditItemDialogProps {
  item: GroceryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<GroceryItem> & { id: string }) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Complete edit item dialog
 * Handles all item fields: core (name, checked), category, and extended fields (amount, price, notes, image, links)
 */
export function EditItemDialog({
  item,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}: EditItemDialogProps) {
  const form = useForm<EditItemFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(editItemSchema, undefined, { mode: 'sync' }) as any,
    mode: 'onChange',

    defaultValues: (item
      ? {
          name: item.name,
          checked: item.checked,
          category: item.category,
          amount: item.amount ?? '',
          price: item.price ? item.price.toString() : '',
          notes: item.notes ?? '',
          imageUrl: item.imageUrl ?? '',
          links: item.links ?? [],
        }
      : {
          name: '',
          checked: false,
          category: 'other',
          amount: '',
          price: '',
          notes: '',
          imageUrl: '',
          links: [],
        }) as any,
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!item) return;

    try {
      // Only send changed fields
      const changes: Partial<GroceryItem> & { id: string } = {
        id: item.id,
      };

      if (values.name !== item.name) changes.name = values.name;
      if (values.checked !== item.checked) changes.checked = values.checked;
      if (values.category !== item.category) changes.category = values.category;
      if (values.amount !== item.amount)
        changes.amount = values.amount || undefined;

      // Convert price string to number
      const priceNum = values.price ? parseFloat(values.price) : undefined;
      if (priceNum !== item.price) changes.price = priceNum;

      if (values.notes !== item.notes)
        changes.notes = values.notes || undefined;
      if (values.imageUrl !== item.imageUrl)
        changes.imageUrl = values.imageUrl || undefined;
      if (JSON.stringify(values.links) !== JSON.stringify(item.links ?? []))
        changes.links = values.links?.length ? values.links : undefined;

      await onSave(changes);
      onClose();
    } catch (err) {
      console.error('Failed to save item:', err);
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      onClose();
    }
  };

  // Re-initialise form values whenever the item prop changes.
  // isValid is re-evaluated by RHF on the first onChange interaction; the Save
  // button is also guarded by !isDirty so the initial isValid=false state is
  // not visible to users. Calling form.trigger() here caused async Zod
  // validation to run outside React's act() boundary in tests, hanging the
  // Jest runner.
  useEffect(() => {
    if (item) {
      form.reset(
        {
          name: item.name,
          checked: item.checked,
          category: item.category,
          amount: item.amount ?? '',
          price: item.price ? item.price.toString() : '',
          notes: item.notes ?? '',
          imageUrl: item.imageUrl ?? '',
          links: item.links ?? [],
        },
        { keepDirty: false, keepErrors: false },
      );
    }
    // Safe: form reference is stable and won't change; we only want to reset when item changes
  }, [item?.id, form]);

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
              <h2 className="text-xl font-semibold text-primary">Edit Item</h2>
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
                htmlFor="item-name"
                className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
              >
                Item Name <span className="text-error">*</span>
              </Label>
              <Input
                id="item-name"
                placeholder="e.g., Organic Bananas"
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

            {/* Category icon grid */}
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
                  htmlFor="item-amount"
                  className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
                >
                  Quantity / Amount
                </Label>
                <Input
                  id="item-amount"
                  placeholder="e.g., 2L, 1 dozen"
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
                  htmlFor="item-price"
                  className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
                >
                  Estimated Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-on-surface-variant font-bold text-sm">
                    $
                  </span>
                  <Input
                    id="item-price"
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
                htmlFor="item-notes"
                className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
              >
                Notes
              </Label>
              <textarea
                id="item-notes"
                placeholder="e.g., Get organic if available"
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
                htmlFor="item-imageUrl"
                className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
              >
                Image URL{' '}
                <span className="text-xs normal-case font-normal text-text-muted">
                  (optional)
                </span>
              </Label>
              <Input
                id="item-imageUrl"
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
              {/* Image preview */}
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

            {/* Mark as done (edit-only) */}
            <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant">
              <Checkbox
                id="item-checked"
                {...form.register('checked')}
                disabled={isLoading}
              />
              <Label
                htmlFor="item-checked"
                className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide cursor-pointer grow"
              >
                Mark as done
              </Label>
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
                disabled={
                  isLoading ||
                  !form.formState.isDirty ||
                  !form.formState.isValid
                }
                className="gap-2"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
