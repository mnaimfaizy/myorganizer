'use client';

import { GroceryCategoryType } from '@myorganizer/core';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorganizer/web-ui';
import { memo } from 'react';
import { Controller } from 'react-hook-form';
import { CATEGORY_LABELS, getCategoryEmoji } from '../constants/categories';

interface CategorySelectProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}

/**
 * Category selector component for grocery items
 * Renders all predefined categories with emoji labels
 * Accessible: Full keyboard navigation, ARIA labels
 */
function CategorySelectComponent({ control }: CategorySelectProps) {
  return (
    <Controller
      control={control}
      name="category"
      render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger id="item-category" aria-label="Select a category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([categoryValue, label]) => {
              const category = categoryValue as GroceryCategoryType;
              const emoji = getCategoryEmoji(category);
              return (
                <SelectItem key={category} value={category}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true">{emoji}</span>
                    <span>{label}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
    />
  );
}

export const CategorySelect = memo(CategorySelectComponent);
