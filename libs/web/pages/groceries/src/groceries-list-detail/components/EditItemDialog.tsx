'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { GroceryItem } from '@myorganizer/core';
import {
  Button,
  Dialog,
  DialogContent,
  Form,
} from '@myorganizer/web-ui';
import { Info, Lock } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { editItemSchema, type EditItemFormValues } from '../schemas';
import {
  EditItemCoreFields,
  EditItemDetailsFields,
} from './EditItemFormFields';

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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        form.reset();
        onClose();
      }
    },
    [form, onClose],
  );

  const handleCancel = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl p-0 gap-0 overflow-hidden">
        <Form {...form}>
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-border-muted">
              <div className="flex items-start gap-3 mb-1">
                <h2 className="text-xl font-semibold text-primary">
                  Edit Item
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
              <EditItemCoreFields
                control={form.control}
                register={form.register}
                errors={form.formState.errors}
                selectedCategory={selectedCategory}
                isLoading={isLoading}
              />
              <EditItemDetailsFields
                control={form.control}
                register={form.register}
                errors={form.formState.errors}
                watchImageUrl={watchImageUrl}
                isLoading={isLoading}
              />
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
                  onClick={handleCancel}
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
