'use client';

import type { CatalogItem } from '@myorganizer/core';
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
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../shared/constants/categories';
import type { AddItemFormValues } from '../schemas';

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
              ? 'border-2 border-brand bg-brand/10'
              : 'border border-border bg-card hover:border-brand',
          )}
        >
          <span className="mb-0.5 text-lg" aria-hidden="true">
            {CATEGORY_EMOJIS[cat]}
          </span>
          <span
            className={cn(
              'text-[10px] font-medium leading-tight',
              selectedCategory === cat
                ? 'font-bold text-brand'
                : 'text-muted-foreground',
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
            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Item Name <span className="text-destructive">*</span>
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
                className="rounded-lg border border-border bg-card"
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
                      'block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted',
                      index === activeSuggestion && 'bg-muted',
                    )}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
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
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
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
