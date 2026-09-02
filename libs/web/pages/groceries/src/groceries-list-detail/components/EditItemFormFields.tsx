'use client';

import { Checkbox, Input, Label, cn } from '@myorganizer/web-ui';
import { useCallback } from 'react';
import type { SyntheticEvent } from 'react';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../shared/constants/categories';
import type { EditItemFormValues } from '../schemas';
import { LinksInput } from './LinksInput';

export interface EditItemCoreFieldsProps {
  control: Control<EditItemFormValues>;
  register: UseFormRegister<EditItemFormValues>;
  errors: FieldErrors<EditItemFormValues>;
  selectedCategory: EditItemFormValues['category'];
  isLoading?: boolean;
}

export function EditItemCoreFields({
  control,
  register,
  errors,
  selectedCategory,
  isLoading = false,
}: EditItemCoreFieldsProps) {
  return (
    <>
      {/* Item Name */}
      <div className="space-y-1.5">
        <Label
          htmlFor="item-name"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Item Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="item-name"
          placeholder="e.g., Organic Bananas"
          {...register('name')}
          disabled={isLoading}
          maxLength={200}
          autoFocus
          className="text-base md:text-sm"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Category icon grid */}
      <div className="space-y-1.5">
        <Label
          id="edit-item-category-label"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Category
        </Label>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <div
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-labelledby="edit-item-category-label"
            >
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="radio"
                  aria-checked={selectedCategory === cat}
                  data-category={cat}
                  onClick={() => field.onChange(cat)}
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
          )}
        />
      </div>
    </>
  );
}

export interface EditItemDetailsFieldsProps {
  control: Control<EditItemFormValues>;
  register: UseFormRegister<EditItemFormValues>;
  errors: FieldErrors<EditItemFormValues>;
  watchImageUrl?: string;
  isLoading?: boolean;
}

export function EditItemDetailsFields({
  control,
  register,
  errors,
  watchImageUrl,
  isLoading = false,
}: EditItemDetailsFieldsProps) {
  const isValidImageUrl = Boolean(
    watchImageUrl && watchImageUrl.startsWith('http'),
  );

  const handleImageError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      event.currentTarget.style.display = 'none';
    },
    [],
  );

  return (
    <>
      {/* Amount + Price */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="item-amount"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Quantity / Amount
          </Label>
          <Input
            id="item-amount"
            placeholder="e.g., 2L, 1 dozen"
            {...register('amount')}
            disabled={isLoading}
            className="text-base md:text-sm"
          />
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="item-price"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Estimated Price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-sm font-bold text-muted-foreground">
              $
            </span>
            <Input
              id="item-price"
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              {...register('price')}
              disabled={isLoading}
              className="pl-6 text-base md:text-sm"
            />
          </div>
          {errors.price && (
            <p className="text-xs text-destructive">{errors.price.message}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label
          htmlFor="item-notes"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Notes
        </Label>
        <textarea
          id="item-notes"
          placeholder="e.g., Get organic if available"
          {...register('notes')}
          disabled={isLoading}
          rows={3}
          maxLength={1000}
          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand md:text-sm"
        />
        {errors.notes && (
          <p className="text-xs text-destructive">{errors.notes.message}</p>
        )}
      </div>

      {/* Image URL */}
      <div className="space-y-1.5">
        <Label
          htmlFor="item-imageUrl"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Image URL{' '}
          <span className="text-xs font-normal normal-case text-muted-foreground">
            (optional)
          </span>
        </Label>
        <Input
          id="item-imageUrl"
          placeholder="https://example.com/image.jpg"
          type="url"
          {...register('imageUrl')}
          disabled={isLoading}
          className="text-base md:text-sm"
        />
        {errors.imageUrl && (
          <p className="text-xs text-destructive">{errors.imageUrl.message}</p>
        )}
        {/* Image preview */}
        {isValidImageUrl && (
          <div className="mt-2 overflow-hidden rounded-lg border border-border">
            <img
              src={watchImageUrl}
              alt="Item preview"
              className="max-h-48 max-w-xs rounded"
              onError={handleImageError}
            />
          </div>
        )}
      </div>

      {/* Links */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Links{' '}
          <span className="text-xs font-normal normal-case text-muted-foreground">
            (optional, max 10)
          </span>
        </Label>
        <LinksInput control={control} />
        {errors.links && (
          <p className="text-xs text-destructive">{errors.links.message}</p>
        )}
      </div>

      {/* Mark as done (edit-only) */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-3">
        <Checkbox
          id="item-checked"
          {...register('checked')}
          disabled={isLoading}
        />
        <Label
          htmlFor="item-checked"
          className="grow cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Mark as done
        </Label>
      </div>
    </>
  );
}
