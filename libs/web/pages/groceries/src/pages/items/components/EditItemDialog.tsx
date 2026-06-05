'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { GroceryItem } from '@myorganizer/core';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@myorganizer/web-ui';
import { useForm } from 'react-hook-form';
import { CategorySelect } from '../../../shared/components/CategorySelect';
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
    resolver: zodResolver(editItemSchema) as any,

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

  const watchImageUrl = form.watch('imageUrl');
  const isValidImageUrl = watchImageUrl && watchImageUrl.startsWith('http');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto md:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Make changes to your grocery item below
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Item Name */}
            <div className="space-y-2">
              <Label htmlFor="item-name" className="font-body-medium">
                Item Name *
              </Label>
              <Input
                id="item-name"
                placeholder="e.g., Organic Bananas"
                {...form.register('name')}
                disabled={isLoading}
                maxLength={200}
                className="text-base md:text-sm"
                autoFocus
              />
              {form.formState.errors.name && (
                <p className="text-xs text-error">
                  {form.formState.errors.name.message}
                </p>
              )}
              <p className="text-xs text-text-muted">
                {form.watch('name').length} / 200 characters
              </p>
            </div>

            {/* Category and Amount (two columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="item-category" className="font-body-medium">
                  Category
                </Label>
                <CategorySelect control={form.control} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-amount" className="font-body-medium">
                  Amount{' '}
                  <span className="text-xs text-text-muted">(optional)</span>
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
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="item-price" className="font-body-medium">
                Price{' '}
                <span className="text-xs text-text-muted">(optional)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-text-muted text-sm">
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

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="item-notes" className="font-body-medium">
                Notes{' '}
                <span className="text-xs text-text-muted">(optional)</span>
              </Label>
              <textarea
                id="item-notes"
                placeholder="e.g., Get organic if available"
                {...form.register('notes')}
                disabled={isLoading}
                rows={3}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-base md:text-sm resize-none"
              />
              {form.formState.errors.notes && (
                <p className="text-xs text-error">
                  {form.formState.errors.notes.message}
                </p>
              )}
              <p className="text-xs text-text-muted">
                {(form.watch('notes') || '').length} / 1000 characters
              </p>
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="item-imageUrl" className="font-body-medium">
                Image URL{' '}
                <span className="text-xs text-text-muted">(optional)</span>
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
            <div className="space-y-2">
              <Label className="font-body-medium">
                Links{' '}
                <span className="text-xs text-text-muted">
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

            {/* Checked State */}
            <div className="flex items-center gap-3 p-md bg-surface-container-low rounded-lg border border-outline-variant">
              <Checkbox
                id="item-checked"
                {...form.register('checked')}
                disabled={isLoading}
              />
              <Label
                htmlFor="item-checked"
                className="font-body-medium cursor-pointer grow"
              >
                Mark as done
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading || !form.formState.isDirty || !form.formState.isValid
              }
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
