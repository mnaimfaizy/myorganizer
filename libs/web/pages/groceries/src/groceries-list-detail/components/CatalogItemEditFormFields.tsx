'use client';

import type { GroceryCategoryType } from '@myorganizer/core';
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
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../shared/constants/categories';
import type { CatalogItemEditFormValues } from './CatalogItemEditDialog';
import { LinksInput } from './LinksInput';

export interface CatalogItemEditFormFieldsProps {
  control: Control<CatalogItemEditFormValues>;
  selectedCategory: GroceryCategoryType;
  isLoading?: boolean;
}

export function CatalogItemEditFormFields({
  control,
  selectedCategory,
  isLoading = false,
}: CatalogItemEditFormFieldsProps) {
  return (
    <>
      <FormField
        control={control}
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
        control={control}
        name="category"
        render={({ field }) => (
          <FormItem>
            <FormLabel id="catalog-item-category-label">Category</FormLabel>
            <div
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-labelledby="catalog-item-category-label"
            >
              {CATEGORY_ORDER.map((category) => (
                <button
                  key={category}
                  type="button"
                  role="radio"
                  aria-checked={selectedCategory === category}
                  data-category={category}
                  disabled={isLoading}
                  onClick={() => field.onChange(category)}
                  className={cn(
                    'rounded-lg p-2 text-center',
                    selectedCategory === category
                      ? 'border-2 border-brand bg-brand/10'
                      : 'border border-border bg-card',
                  )}
                >
                  <span aria-hidden="true">{CATEGORY_EMOJIS[category]}</span>
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
          control={control}
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
        control={control}
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
                className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2"
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
        <LinksInput control={control} disabled={isLoading} />
        <FormMessage />
      </FormItem>
    </>
  );
}
