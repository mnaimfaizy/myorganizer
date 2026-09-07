'use client';

import { Input, Label, cn } from '@myorganizer/web-ui';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../shared/constants/categories';
import type { EditItemFormValues } from '../schemas';

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
          render={({ field: { onChange } }) => (
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
                  onClick={() => onChange(cat)}
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
