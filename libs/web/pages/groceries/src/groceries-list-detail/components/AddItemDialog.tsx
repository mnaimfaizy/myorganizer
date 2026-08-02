'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { CatalogItem, GroceryCategoryType } from '@myorganizer/core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Form,
} from '@myorganizer/web-ui';
import { Info, Lock } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import {
  AddItemDetailsFields,
  AddItemMetadataFields,
  addItemSchema,
} from './AddItemFormFields';
import type { AddItemFormValues } from './AddItemFormFields';

export interface AddItemFormResult {
  name: string;
  category: GroceryCategoryType;
  catalogItemId?: string;
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
  catalog?: CatalogItem[];
  mode?: 'list' | 'catalog';
}

export function AddItemDialog({
  isOpen,
  onClose,
  onAdd,
  isLoading = false,
  catalog = [],
  mode = 'list',
}: AddItemDialogProps) {
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<
    string | undefined
  >();
  const form = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemSchema, undefined, { mode: 'sync' }),
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

  const nameValue = form.watch('name');
  const selectedCategory = form.watch('category');
  const imageUrl = form.watch('imageUrl');
  const matchingCatalogItems = useMemo(() => {
    const query = nameValue.trim().toLowerCase();
    if (!query) return [];
    return catalog
      .filter((item) => item.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [catalog, nameValue]);

  const handleSelectCatalogItem = useCallback(
    (item: CatalogItem) => {
      setSelectedCatalogItemId(item.id);
      form.setValue('name', item.name, { shouldValidate: true });
      form.setValue('category', item.category, { shouldValidate: true });
      form.setValue(
        'price',
        item.price === undefined ? '' : String(item.price),
        {
          shouldValidate: true,
        },
      );
      setActiveSuggestion(0);
    },
    [form],
  );

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSelectedCatalogItemId(undefined);
      setActiveSuggestion(0);
      form.setValue('name', event.target.value, { shouldValidate: true });
    },
    [form],
  );

  const handleNameKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (matchingCatalogItems.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSuggestion((index) =>
          Math.min(index + 1, matchingCatalogItems.length - 1),
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSuggestion((index) => Math.max(index - 1, 0));
      } else if (
        event.key === 'Enter' &&
        matchingCatalogItems[activeSuggestion]
      ) {
        event.preventDefault();
        handleSelectCatalogItem(matchingCatalogItems[activeSuggestion]);
      } else if (event.key === 'Escape') {
        setActiveSuggestion(0);
      }
    },
    [activeSuggestion, handleSelectCatalogItem, matchingCatalogItems],
  );

  const resetForm = useCallback(() => {
    form.reset();
    setSelectedCatalogItemId(undefined);
    setActiveSuggestion(0);
  }, [form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onAdd({
        name: values.name,
        category: values.category,
        ...(selectedCatalogItemId
          ? { catalogItemId: selectedCatalogItemId }
          : {}),
        amount: values.amount || undefined,
        price: values.price ? Number(values.price) : undefined,
        notes: values.notes || undefined,
        imageUrl: values.imageUrl || undefined,
        links: values.links?.length ? values.links : undefined,
      });
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetForm();
        onClose();
      }
    },
    [onClose, resetForm],
  );

  const handleCancel = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl gap-0 overflow-hidden p-0">
        <Form {...form}>
          <form onSubmit={handleSubmit}>
            <div className="border-b border-border-muted px-6 py-5">
              <div className="mb-1 flex items-start gap-3">
                <DialogTitle className="text-xl font-semibold text-primary">
                  {mode === 'catalog' ? 'New staple' : 'Add New Item'}
                </DialogTitle>
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-action-cyan/20 bg-primary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-action-cyan">
                  <Lock className="h-3 w-3" />
                  Encrypted Data
                </span>
              </div>
              <DialogDescription className="text-sm text-on-surface-variant">
                Stored securely in your private vault.
              </DialogDescription>
            </div>

            <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
              <AddItemMetadataFields
                control={form.control}
                matchingCatalogItems={matchingCatalogItems}
                activeSuggestion={activeSuggestion}
                selectedCategory={selectedCategory}
                onNameChange={handleNameChange}
                onNameKeyDown={handleNameKeyDown}
                onSelectCatalogItem={handleSelectCatalogItem}
                isLoading={isLoading}
              />
              <AddItemDetailsFields
                control={form.control}
                imageUrl={imageUrl}
                isLoading={isLoading}
                showAmount={mode !== 'catalog'}
              />
            </div>

            <div className="flex items-center justify-between border-t border-border-muted bg-surface-container-low px-6 py-4">
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
                  disabled={isLoading || !form.formState.isValid}
                  className="gap-2"
                >
                  Add to {mode === 'catalog' ? 'catalog' : 'List'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
