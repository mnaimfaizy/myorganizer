'use client';

import type { CatalogItem } from '@myorganizer/core';
import { GROCERY_PREDEFINED_CATEGORIES } from '@myorganizer/core';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  cn,
} from '@myorganizer/web-ui';
import type { Control } from 'react-hook-form';
import { useCallback } from 'react';
import type {
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  SyntheticEvent,
} from 'react';
import { z } from 'zod';
import { LinksInput } from './LinksInput';
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../shared/constants/categories';

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

interface AddItemMetadataFieldsProps {
  control: Control<AddItemFormValues>;
  matchingCatalogItems: CatalogItem[];
  activeSuggestion: number;
  selectedCategory: AddItemFormValues['category'];
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelectCatalogItem: (item: CatalogItem) => void;
  isLoading: boolean;
}

interface CategoryButtonsProps {
  onChange: (value: AddItemFormValues['category']) => void;
  selectedCategory: AddItemFormValues['category'];
  isLoading: boolean;
}

function CategoryButtons({
  onChange,
  selectedCategory,
  isLoading,
}: CategoryButtonsProps) {
  const handleCategoryClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const category = event.currentTarget.dataset.category;
      if (category) {
        onChange(category as AddItemFormValues['category']);
      }
    },
    [onChange],
  );

  return (
    <div className="grid grid-cols-4 gap-2">
      {CATEGORY_ORDER.map((cat) => (
        <button
          key={cat}
          type="button"
          role="radio"
          aria-checked={selectedCategory === cat}
          data-category={cat}
          onClick={handleCategoryClick}
          disabled={isLoading}
          className={cn(
            'flex flex-col items-center justify-center rounded-lg p-2 text-center transition-all',
            selectedCategory === cat
              ? 'border-2 border-secondary bg-secondary-fixed/20'
              : 'border border-outline-variant bg-surface-bright hover:border-secondary',
          )}
        >
          <span className="mb-0.5 text-lg" aria-hidden="true">
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
  );
}

export function AddItemMetadataFields({
  control,
  matchingCatalogItems,
  activeSuggestion,
  selectedCategory,
  onNameChange,
  onNameKeyDown,
  onSelectCatalogItem,
  isLoading,
}: AddItemMetadataFieldsProps) {
  const handleSuggestionMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    [],
  );

  const handleSuggestionClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const itemId = event.currentTarget.dataset.catalogItemId;
      const item = matchingCatalogItems.find(
        (catalogItem) => catalogItem.id === itemId,
      );
      if (item) {
        onSelectCatalogItem(item);
      }
    },
    [matchingCatalogItems, onSelectCatalogItem],
  );

  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Item Name <span className="text-error">*</span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="e.g. Organic Almond Milk"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="add-item-name-suggestions"
                aria-expanded={matchingCatalogItems.length > 0}
                aria-activedescendant={
                  matchingCatalogItems[activeSuggestion]
                    ? `catalog-suggestion-${matchingCatalogItems[activeSuggestion].id}`
                    : undefined
                }
                autoComplete="off"
                onChange={onNameChange}
                onKeyDown={onNameKeyDown}
                disabled={isLoading}
                maxLength={200}
                autoFocus
                className="text-base md:text-sm"
              />
            </FormControl>
            {matchingCatalogItems.length > 0 && (
              <div
                id="add-item-name-suggestions"
                role="listbox"
                aria-label="Existing catalog items"
                className="rounded-lg border border-outline-variant bg-surface-bright"
              >
                {matchingCatalogItems.map((item, index) => (
                  <button
                    key={item.id}
                    id={`catalog-suggestion-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeSuggestion}
                    data-catalog-item-id={item.id}
                    onMouseDown={handleSuggestionMouseDown}
                    onClick={handleSuggestionClick}
                    disabled={isLoading}
                    className={cn(
                      'block w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-low',
                      index === activeSuggestion && 'bg-surface-container-low',
                    )}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-xs text-on-surface-variant">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="category"
        render={({ field }) => (
          <FormItem>
            <FormLabel
              id="add-item-category-label"
              className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
            >
              Category
            </FormLabel>
            <div role="radiogroup" aria-labelledby="add-item-category-label">
              <CategoryButtons
                onChange={field.onChange}
                selectedCategory={selectedCategory}
                isLoading={isLoading}
              />
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

interface AddItemDetailsFieldsProps {
  control: Control<AddItemFormValues>;
  imageUrl: string;
  isLoading: boolean;
}

export function AddItemDetailsFields({
  control,
  imageUrl,
  isLoading,
}: AddItemDetailsFieldsProps) {
  const handleImageError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      event.currentTarget.style.display = 'none';
    },
    [],
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Quantity / Amount
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g. 2, 500g"
                  disabled={isLoading}
                  className="text-base md:text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Estimated Price
              </FormLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-bold text-on-surface-variant">
                  $
                </span>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isLoading}
                    className="pl-6 text-base md:text-sm"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Notes
            </FormLabel>
            <FormControl>
              <textarea
                {...field}
                placeholder="Add specific brands, sizes or dietary requirements..."
                disabled={isLoading}
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-lg border border-outline-variant bg-surface-bright px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-secondary md:text-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="imageUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Image URL{' '}
              <span className="text-xs font-normal normal-case text-text-muted">
                (optional)
              </span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="https://example.com/image.jpg"
                type="url"
                disabled={isLoading}
                className="text-base md:text-sm"
              />
            </FormControl>
            <FormMessage />
            {imageUrl.startsWith('http') && (
              <div className="mt-2 overflow-hidden rounded-lg border border-outline-variant">
                <img
                  src={imageUrl}
                  alt="Item preview"
                  className="max-h-48 max-w-xs rounded"
                  onError={handleImageError}
                />
              </div>
            )}
          </FormItem>
        )}
      />

      <FormItem>
        <FormLabel className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Links{' '}
          <span className="text-xs font-normal normal-case text-text-muted">
            (optional, max 10)
          </span>
        </FormLabel>
        <LinksInput control={control} disabled={isLoading} />
      </FormItem>
    </>
  );
}
