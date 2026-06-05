'use client';

import { GroceryCategoryType, GroceryItem } from '@myorganizer/core';
import { cn } from '@myorganizer/web-ui';
import { useMemo } from 'react';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getCategoryEmoji,
} from '../constants/categories';

interface CategoryFilterBarProps {
  items: GroceryItem[];
  activeCategory: GroceryCategoryType | 'all';
  onCategoryChange: (category: GroceryCategoryType | 'all') => void;
}

/**
 * Horizontal scrollable category filter bar
 * Shows only categories that have items in the current list
 */
export function CategoryFilterBar({
  items,
  activeCategory,
  onCategoryChange,
}: CategoryFilterBarProps) {
  // Get unique categories in use, sorted by CATEGORY_ORDER
  const categoriesInUse = useMemo(() => {
    const categoriesSet = new Set<GroceryCategoryType>(
      items.map((item) => (item.category as GroceryCategoryType) || 'other'),
    );

    // Sort by CATEGORY_ORDER
    return CATEGORY_ORDER.filter((cat) => categoriesSet.has(cat));
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto py-md">
      {/* "All" button */}
      <button
        onClick={() => onCategoryChange('all')}
        className={cn(
          'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
          activeCategory === 'all'
            ? 'bg-secondary text-on-secondary'
            : 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80',
        )}
      >
        All
      </button>

      {/* Category buttons */}
      {categoriesInUse.map((category) => {
        const label = CATEGORY_LABELS[category];
        const emoji = getCategoryEmoji(category);

        return (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2',
              activeCategory === category
                ? 'bg-secondary text-on-secondary'
                : 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80',
            )}
            aria-pressed={activeCategory === category}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
